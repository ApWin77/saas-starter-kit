from sqlalchemy import text
from sqlalchemy.engine import Engine
from typing import List, Dict, Any, Optional, Tuple
from openai import OpenAI
from datetime import datetime
import json
import re

from services.retrieval_service import RetrievalService
from services.budget_service import BudgetService
from models.schemas import (
    ChatMessageResponse,
    ChatThreadResponse,
    Citation,
    AnswerMode,
    MessageSender,
)


class ChatService:
    """Service for managing chat threads and generating AI responses."""
    
    def __init__(
        self,
        db_engine: Engine,
        openai_client: OpenAI,
        retrieval_service: RetrievalService,
        budget_service: BudgetService,
        model: str = "gpt-4-turbo-preview",
        max_tokens: int = 4000
    ):
        self.db = db_engine
        self.openai = openai_client
        self.retrieval = retrieval_service
        self.budget = budget_service
        self.model = model
        self.max_tokens = max_tokens
    
    async def create_thread(
        self, 
        user_id: str, 
        course_id: str, 
        title: Optional[str] = None
    ) -> ChatThreadResponse:
        """Create a new chat thread."""
        query = text("""
            INSERT INTO "ChatThread" (id, "courseId", "userId", title, "createdAt")
            VALUES (gen_random_uuid(), :course_id, :user_id, :title, NOW())
            RETURNING id, "courseId", "userId", title, "createdAt"
        """)
        
        with self.db.connect() as conn:
            result = conn.execute(query, {
                "course_id": course_id,
                "user_id": user_id,
                "title": title
            }).fetchone()
            conn.commit()
            
            return ChatThreadResponse(
                id=result.id,
                course_id=result.courseId,
                user_id=result.userId,
                title=result.title,
                created_at=result.createdAt,
                message_count=0
            )
    
    async def get_thread(self, thread_id: str, user_id: str) -> Optional[ChatThreadResponse]:
        """Get a thread by ID if it belongs to the user."""
        query = text("""
            SELECT 
                t.id, t."courseId", t."userId", t.title, t."createdAt",
                COUNT(m.id) as message_count,
                (SELECT text FROM "ChatMessage" WHERE "threadId" = t.id ORDER BY "createdAt" DESC LIMIT 1) as last_message
            FROM "ChatThread" t
            LEFT JOIN "ChatMessage" m ON t.id = m."threadId"
            WHERE t.id = :thread_id AND t."userId" = :user_id
            GROUP BY t.id
        """)
        
        with self.db.connect() as conn:
            result = conn.execute(query, {
                "thread_id": thread_id,
                "user_id": user_id
            }).fetchone()
            
            if not result:
                return None
            
            return ChatThreadResponse(
                id=result.id,
                course_id=result.courseId,
                user_id=result.userId,
                title=result.title,
                created_at=result.createdAt,
                message_count=result.message_count,
                last_message_preview=result.last_message[:100] if result.last_message else None
            )
    
    async def list_threads(
        self, 
        user_id: str, 
        course_id: str,
        limit: int = 20,
        offset: int = 0
    ) -> Tuple[List[ChatThreadResponse], int]:
        """List user's chat threads for a course."""
        count_query = text("""
            SELECT COUNT(*) as total
            FROM "ChatThread"
            WHERE "userId" = :user_id AND "courseId" = :course_id
        """)
        
        list_query = text("""
            SELECT 
                t.id, t."courseId", t."userId", t.title, t."createdAt",
                COUNT(m.id) as message_count,
                (SELECT text FROM "ChatMessage" WHERE "threadId" = t.id ORDER BY "createdAt" DESC LIMIT 1) as last_message
            FROM "ChatThread" t
            LEFT JOIN "ChatMessage" m ON t.id = m."threadId"
            WHERE t."userId" = :user_id AND t."courseId" = :course_id
            GROUP BY t.id
            ORDER BY t."createdAt" DESC
            LIMIT :limit OFFSET :offset
        """)
        
        with self.db.connect() as conn:
            total = conn.execute(count_query, {
                "user_id": user_id,
                "course_id": course_id
            }).fetchone().total
            
            results = conn.execute(list_query, {
                "user_id": user_id,
                "course_id": course_id,
                "limit": limit,
                "offset": offset
            }).fetchall()
            
            threads = [
                ChatThreadResponse(
                    id=r.id,
                    course_id=r.courseId,
                    user_id=r.userId,
                    title=r.title,
                    created_at=r.createdAt,
                    message_count=r.message_count,
                    last_message_preview=r.last_message[:100] if r.last_message else None
                )
                for r in results
            ]
            
            return threads, total
    
    async def get_messages(
        self, 
        thread_id: str,
        limit: int = 50,
        offset: int = 0
    ) -> List[ChatMessageResponse]:
        """Get messages for a thread."""
        query = text("""
            SELECT id, "threadId", sender, text, "answerMode", "retrievedChunkIds", "createdAt"
            FROM "ChatMessage"
            WHERE "threadId" = :thread_id
            ORDER BY "createdAt" ASC
            LIMIT :limit OFFSET :offset
        """)
        
        with self.db.connect() as conn:
            results = conn.execute(query, {
                "thread_id": thread_id,
                "limit": limit,
                "offset": offset
            }).fetchall()
            
            messages = []
            for r in results:
                citations = []
                if r.retrievedChunkIds:
                    chunk_ids = r.retrievedChunkIds if isinstance(r.retrievedChunkIds, list) else json.loads(r.retrievedChunkIds)
                    citations = await self._get_citations_for_chunks(chunk_ids)
                
                messages.append(ChatMessageResponse(
                    id=r.id,
                    thread_id=r.threadId,
                    sender=MessageSender(r.sender),
                    text=r.text,
                    answer_mode=AnswerMode(r.answerMode) if r.answerMode else None,
                    citations=citations,
                    created_at=r.createdAt
                ))
            
            return messages
    
    async def send_message(
        self,
        thread_id: str,
        user_id: str,
        course_id: str,
        text: str,
        system_prompt: Optional[str] = None
    ) -> Tuple[ChatMessageResponse, ChatMessageResponse, List[Citation]]:
        """
        Send a user message and generate AI response.
        Returns tuple of (user_message, assistant_message, citations).
        """
        # Check budget
        estimated_tokens = self.budget.count_tokens(text) + 500  # Buffer for response
        if not await self.budget.check_budget(user_id, course_id, estimated_tokens):
            raise ValueError("Daily token budget exceeded. Please try again tomorrow.")
        
        # Save user message
        user_msg = await self._save_message(
            thread_id=thread_id,
            sender=MessageSender.USER,
            text=text
        )
        
        # Update thread title if first message
        await self._update_thread_title_if_needed(thread_id, text)
        
        # Retrieve relevant chunks
        chunks = await self.retrieval.retrieve_chunks(text, course_id)
        context = await self.retrieval.format_context(chunks)
        
        # Build prompt
        messages = await self._build_prompt(
            user_text=text,
            context=context,
            thread_id=thread_id,
            system_prompt=system_prompt
        )
        
        # Generate response
        response = self.openai.chat.completions.create(
            model=self.model,
            messages=messages,
            max_tokens=self.max_tokens,
            temperature=0.7
        )
        
        assistant_text = response.choices[0].message.content
        
        # Determine answer mode
        answer_mode = self._determine_answer_mode(assistant_text, chunks)
        
        # Extract chunk IDs used
        chunk_ids = [c["id"] for c in chunks] if chunks else []
        
        # Save assistant message
        assistant_msg = await self._save_message(
            thread_id=thread_id,
            sender=MessageSender.ASSISTANT,
            text=assistant_text,
            answer_mode=answer_mode,
            retrieved_chunk_ids=chunk_ids
        )
        
        # Record token usage
        total_tokens = response.usage.total_tokens if response.usage else 0
        await self.budget.record_usage(user_id, course_id, total_tokens)
        
        # Format citations
        citations = self._format_citations(chunks)
        
        return user_msg, assistant_msg, citations
    
    async def _save_message(
        self,
        thread_id: str,
        sender: MessageSender,
        text: str,
        answer_mode: Optional[AnswerMode] = None,
        retrieved_chunk_ids: Optional[List[str]] = None
    ) -> ChatMessageResponse:
        """Save a message to the database."""
        query = text("""
            INSERT INTO "ChatMessage" 
            (id, "threadId", sender, text, "answerMode", "retrievedChunkIds", "createdAt")
            VALUES (gen_random_uuid(), :thread_id, :sender, :text, :answer_mode, :chunk_ids, NOW())
            RETURNING id, "threadId", sender, text, "answerMode", "createdAt"
        """)
        
        with self.db.connect() as conn:
            result = conn.execute(query, {
                "thread_id": thread_id,
                "sender": sender.value,
                "text": text,
                "answer_mode": answer_mode.value if answer_mode else None,
                "chunk_ids": json.dumps(retrieved_chunk_ids) if retrieved_chunk_ids else None
            }).fetchone()
            conn.commit()
            
            return ChatMessageResponse(
                id=result.id,
                thread_id=result.threadId,
                sender=MessageSender(result.sender),
                text=result.text,
                answer_mode=AnswerMode(result.answerMode) if result.answerMode else None,
                citations=[],
                created_at=result.createdAt
            )
    
    async def _update_thread_title_if_needed(self, thread_id: str, first_message: str):
        """Update thread title based on first message if not set."""
        check_query = text("""
            SELECT title, (SELECT COUNT(*) FROM "ChatMessage" WHERE "threadId" = :thread_id) as count
            FROM "ChatThread"
            WHERE id = :thread_id
        """)
        
        with self.db.connect() as conn:
            result = conn.execute(check_query, {"thread_id": thread_id}).fetchone()
            
            if result and not result.title and result.count == 0:
                # Generate title from first message (first 50 chars or first sentence)
                title = first_message[:50]
                if len(first_message) > 50:
                    title += "..."
                
                update_query = text("""
                    UPDATE "ChatThread" SET title = :title WHERE id = :thread_id
                """)
                conn.execute(update_query, {"thread_id": thread_id, "title": title})
                conn.commit()
    
    async def _build_prompt(
        self,
        user_text: str,
        context: str,
        thread_id: str,
        system_prompt: Optional[str] = None
    ) -> List[Dict[str, str]]:
        """Build the prompt messages for the LLM."""
        default_system = """You are a helpful AI tutor. Your primary goal is to help students understand course material.

IMPORTANT RULES:
1. Always base your answers on the provided course materials when available.
2. If you cite information from course materials, reference the specific source (e.g., "According to Lecture 3, page 12...").
3. If you cannot answer from course materials, you may provide general knowledge BUT you must clearly label it by starting with "[Outside Course Material]".
4. Never fabricate citations or make up page numbers.
5. Be encouraging and supportive to students.
6. If a student seems confused, break down concepts into smaller parts."""

        system = system_prompt or default_system
        
        messages = [{"role": "system", "content": system}]
        
        # Get recent conversation history
        history = await self.get_messages(thread_id, limit=10)
        for msg in history[-6:]:  # Last 6 messages for context
            role = "user" if msg.sender == MessageSender.USER else "assistant"
            messages.append({"role": role, "content": msg.text})
        
        # Add context and current question
        if context:
            user_content = f"""Based on the following course materials:

{context}

Student question: {user_text}

Please answer based on the course materials above. If the materials don't contain relevant information, you may provide general knowledge but clearly label it as "[Outside Course Material]"."""
        else:
            user_content = f"""Student question: {user_text}

Note: No relevant course materials were found for this question. If you can answer from general knowledge, please clearly label your response as "[Outside Course Material]"."""
        
        messages.append({"role": "user", "content": user_content})
        
        return messages
    
    def _determine_answer_mode(self, response_text: str, chunks: List[Dict]) -> AnswerMode:
        """Determine if response is grounded in course material or outside."""
        # Check for explicit outside material label
        if "[Outside Course Material]" in response_text or "[outside course material]" in response_text.lower():
            return AnswerMode.OUTSIDE_MATERIAL
        
        # If we had context chunks and response references them, it's grounded
        if chunks and len(chunks) > 0:
            # Simple heuristic: if response mentions any source info, consider grounded
            for chunk in chunks:
                if chunk.get("source_title") and chunk["source_title"].lower() in response_text.lower():
                    return AnswerMode.COURSE_GROUNDED
                if chunk.get("page_number") and f"page {chunk['page_number']}" in response_text.lower():
                    return AnswerMode.COURSE_GROUNDED
        
        # If we had context, assume grounded unless marked otherwise
        if chunks:
            return AnswerMode.COURSE_GROUNDED
        
        return AnswerMode.OUTSIDE_MATERIAL
    
    def _format_citations(self, chunks: List[Dict]) -> List[Citation]:
        """Format chunks into citation objects."""
        citations = []
        for chunk in chunks:
            citations.append(Citation(
                chunk_id=chunk["id"],
                content_file_id=chunk["content_file_id"],
                source_title=chunk.get("source_title", chunk.get("filename", "Unknown")),
                page_number=chunk.get("page_number"),
                section_heading=chunk.get("section_heading"),
                snippet=chunk["chunk_text"][:200] + "..." if len(chunk["chunk_text"]) > 200 else chunk["chunk_text"]
            ))
        return citations
    
    async def _get_citations_for_chunks(self, chunk_ids: List[str]) -> List[Citation]:
        """Get citation info for a list of chunk IDs."""
        if not chunk_ids:
            return []
        
        query = text("""
            SELECT 
                dc.id, dc."contentFileId", dc."chunkText", dc.metadata, cf.filename
            FROM "DocumentChunk" dc
            JOIN "ContentFile" cf ON dc."contentFileId" = cf.id
            WHERE dc.id = ANY(:chunk_ids)
        """)
        
        with self.db.connect() as conn:
            results = conn.execute(query, {"chunk_ids": chunk_ids}).fetchall()
            
            citations = []
            for r in results:
                metadata = r.metadata if isinstance(r.metadata, dict) else json.loads(r.metadata)
                citations.append(Citation(
                    chunk_id=r.id,
                    content_file_id=r.contentFileId,
                    source_title=metadata.get("source_title", r.filename),
                    page_number=metadata.get("page_number"),
                    section_heading=metadata.get("section_heading"),
                    snippet=r.chunkText[:200] + "..." if len(r.chunkText) > 200 else r.chunkText
                ))
            
            return citations
    
    async def delete_thread(self, thread_id: str, user_id: str) -> bool:
        """Delete a thread if it belongs to the user."""
        query = text("""
            DELETE FROM "ChatThread"
            WHERE id = :thread_id AND "userId" = :user_id
            RETURNING id
        """)
        
        with self.db.connect() as conn:
            result = conn.execute(query, {
                "thread_id": thread_id,
                "user_id": user_id
            }).fetchone()
            conn.commit()
            
            return result is not None
