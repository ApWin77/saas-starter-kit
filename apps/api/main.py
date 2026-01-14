from fastapi import FastAPI, HTTPException, Depends, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import create_engine
from openai import OpenAI
from typing import Optional
import time
from collections import defaultdict

from config import get_settings
from models import (
    ChatThreadCreate,
    ChatThreadResponse,
    SendMessageRequest,
    SendMessageResponse,
)
from models.schemas import ThreadListResponse, MessageListResponse, ErrorResponse
from services import AuthService, ChatService, RetrievalService, BudgetService


# Initialize FastAPI app
app = FastAPI(
    title="AI Course Tutor API",
    description="Backend API for the AI Course Tutor chat system",
    version="1.0.0"
)

# Settings
settings = get_settings()

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Database engine
engine = create_engine(settings.database_url)

# OpenAI client
openai_client = OpenAI(api_key=settings.openai_api_key) if settings.openai_api_key else None

# Services
auth_service = AuthService(engine)
budget_service = BudgetService(engine, settings.max_tokens_per_user_per_day)
retrieval_service = RetrievalService(
    engine, 
    openai_client,
    settings.openai_embedding_model,
    settings.retrieval_top_k
) if openai_client else None
chat_service = ChatService(
    engine,
    openai_client,
    retrieval_service,
    budget_service,
    settings.openai_model,
    settings.max_tokens_per_request
) if openai_client and retrieval_service else None

# Simple in-memory rate limiter
rate_limit_store = defaultdict(list)


# Rate limiting middleware
@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    # Skip rate limiting for non-chat endpoints
    if not request.url.path.startswith("/api/student/chat"):
        return await call_next(request)
    
    # Get user identifier (IP or user ID from session)
    client_ip = request.client.host if request.client else "unknown"
    
    # Clean old entries
    current_time = time.time()
    rate_limit_store[client_ip] = [
        t for t in rate_limit_store[client_ip] 
        if current_time - t < 60
    ]
    
    # Check rate limit
    if len(rate_limit_store[client_ip]) >= settings.rate_limit_requests_per_minute:
        return JSONResponse(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            content={"error": "Rate limit exceeded. Please wait a moment."}
        )
    
    # Record this request
    rate_limit_store[client_ip].append(current_time)
    
    return await call_next(request)


# Dependency to get current user from session
async def get_current_user(request: Request) -> dict:
    # Try to get session token from cookie
    session_token = request.cookies.get("next-auth.session-token")
    if not session_token:
        session_token = request.cookies.get("__Secure-next-auth.session-token")
    
    if not session_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated"
        )
    
    user = await auth_service.validate_session(session_token)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session"
        )
    
    return user


# Health check
@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": time.time()}


# Chat Thread endpoints
@app.post("/api/student/chat/threads", response_model=ChatThreadResponse)
async def create_thread(
    data: ChatThreadCreate,
    user: dict = Depends(get_current_user)
):
    """Create a new chat thread."""
    if not chat_service:
        raise HTTPException(status_code=503, detail="Chat service not configured")
    
    course_id = data.course_id or settings.default_course_id
    
    # Verify enrollment
    enrollment = await auth_service.get_user_enrollment(user["user_id"], course_id)
    if not enrollment:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enrolled in this course"
        )
    
    thread = await chat_service.create_thread(
        user_id=user["user_id"],
        course_id=course_id,
        title=data.title
    )
    
    return thread


@app.get("/api/student/chat/threads", response_model=ThreadListResponse)
async def list_threads(
    course_id: Optional[str] = None,
    limit: int = 20,
    offset: int = 0,
    user: dict = Depends(get_current_user)
):
    """List user's chat threads."""
    if not chat_service:
        raise HTTPException(status_code=503, detail="Chat service not configured")
    
    course_id = course_id or settings.default_course_id
    
    threads, total = await chat_service.list_threads(
        user_id=user["user_id"],
        course_id=course_id,
        limit=limit,
        offset=offset
    )
    
    return ThreadListResponse(
        threads=threads,
        total=total,
        has_more=(offset + limit) < total
    )


@app.get("/api/student/chat/threads/{thread_id}", response_model=ChatThreadResponse)
async def get_thread(
    thread_id: str,
    user: dict = Depends(get_current_user)
):
    """Get a specific chat thread."""
    if not chat_service:
        raise HTTPException(status_code=503, detail="Chat service not configured")
    
    thread = await chat_service.get_thread(thread_id, user["user_id"])
    if not thread:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Thread not found"
        )
    
    return thread


@app.delete("/api/student/chat/threads/{thread_id}")
async def delete_thread(
    thread_id: str,
    user: dict = Depends(get_current_user)
):
    """Delete a chat thread."""
    if not chat_service:
        raise HTTPException(status_code=503, detail="Chat service not configured")
    
    deleted = await chat_service.delete_thread(thread_id, user["user_id"])
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Thread not found"
        )
    
    return {"success": True}


@app.get("/api/student/chat/threads/{thread_id}/messages", response_model=MessageListResponse)
async def get_messages(
    thread_id: str,
    limit: int = 50,
    offset: int = 0,
    user: dict = Depends(get_current_user)
):
    """Get messages for a thread."""
    if not chat_service:
        raise HTTPException(status_code=503, detail="Chat service not configured")
    
    # Verify thread belongs to user
    thread = await chat_service.get_thread(thread_id, user["user_id"])
    if not thread:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Thread not found"
        )
    
    messages = await chat_service.get_messages(thread_id, limit, offset)
    
    return MessageListResponse(
        messages=messages,
        total=len(messages),
        has_more=len(messages) == limit
    )


@app.post("/api/student/chat/threads/{thread_id}/messages", response_model=SendMessageResponse)
async def send_message(
    thread_id: str,
    data: SendMessageRequest,
    user: dict = Depends(get_current_user)
):
    """Send a message and get AI response."""
    if not chat_service:
        raise HTTPException(status_code=503, detail="Chat service not configured")
    
    # Verify thread belongs to user
    thread = await chat_service.get_thread(thread_id, user["user_id"])
    if not thread:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Thread not found"
        )
    
    try:
        # Get course system prompt
        course_prompt = await _get_course_system_prompt(thread.course_id)
        
        user_msg, assistant_msg, citations = await chat_service.send_message(
            thread_id=thread_id,
            user_id=user["user_id"],
            course_id=thread.course_id,
            text=data.text,
            system_prompt=course_prompt
        )
        
        # Add citations to assistant message
        assistant_msg.citations = citations
        
        return SendMessageResponse(
            user_message=user_msg,
            assistant_message=assistant_msg,
            citations=citations
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate response: {str(e)}"
        )


async def _get_course_system_prompt(course_id: str) -> Optional[str]:
    """Get the system prompt for a course."""
    from sqlalchemy import text as sql_text
    
    query = sql_text("""
        SELECT "systemPrompt" FROM "Course" WHERE id = :course_id
    """)
    
    with engine.connect() as conn:
        result = conn.execute(query, {"course_id": course_id}).fetchone()
        return result.systemPrompt if result else None


# Budget endpoint
@app.get("/api/student/chat/budget")
async def get_budget(
    course_id: Optional[str] = None,
    user: dict = Depends(get_current_user)
):
    """Get user's remaining token budget for today."""
    course_id = course_id or settings.default_course_id
    
    remaining = await budget_service.get_remaining_budget(user["user_id"], course_id)
    used = await budget_service.get_usage_today(user["user_id"], course_id)
    
    return {
        "remaining": remaining,
        "used": used,
        "limit": settings.max_tokens_per_user_per_day
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
