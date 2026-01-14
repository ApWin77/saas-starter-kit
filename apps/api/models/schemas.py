from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum


class MessageSender(str, Enum):
    USER = "USER"
    ASSISTANT = "ASSISTANT"


class AnswerMode(str, Enum):
    COURSE_GROUNDED = "COURSE_GROUNDED"
    OUTSIDE_MATERIAL = "OUTSIDE_MATERIAL"


class Citation(BaseModel):
    chunk_id: str
    content_file_id: str
    source_title: str
    page_number: Optional[int] = None
    section_heading: Optional[str] = None
    snippet: str


class ChatThreadCreate(BaseModel):
    course_id: Optional[str] = None
    title: Optional[str] = None


class ChatThreadResponse(BaseModel):
    id: str
    course_id: str
    user_id: str
    title: Optional[str] = None
    created_at: datetime
    message_count: int = 0
    last_message_preview: Optional[str] = None

    class Config:
        from_attributes = True


class ChatMessageCreate(BaseModel):
    text: str = Field(..., min_length=1, max_length=4000)


class ChatMessageResponse(BaseModel):
    id: str
    thread_id: str
    sender: MessageSender
    text: str
    answer_mode: Optional[AnswerMode] = None
    citations: List[Citation] = []
    created_at: datetime

    class Config:
        from_attributes = True


class SendMessageRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=4000)


class SendMessageResponse(BaseModel):
    user_message: ChatMessageResponse
    assistant_message: ChatMessageResponse
    citations: List[Citation] = []


class ThreadListResponse(BaseModel):
    threads: List[ChatThreadResponse]
    total: int
    has_more: bool


class MessageListResponse(BaseModel):
    messages: List[ChatMessageResponse]
    total: int
    has_more: bool


class ErrorResponse(BaseModel):
    error: str
    detail: Optional[str] = None
