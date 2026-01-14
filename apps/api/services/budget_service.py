from sqlalchemy import text
from sqlalchemy.engine import Engine
from typing import Optional
from datetime import date
import tiktoken


class BudgetService:
    """Service to track and enforce token usage budgets."""
    
    def __init__(self, db_engine: Engine, max_tokens_per_day: int = 50000):
        self.db = db_engine
        self.max_tokens_per_day = max_tokens_per_day
        self._encoder = None
    
    @property
    def encoder(self):
        if self._encoder is None:
            self._encoder = tiktoken.encoding_for_model("gpt-4")
        return self._encoder
    
    def count_tokens(self, text: str) -> int:
        """Count tokens in a text string."""
        return len(self.encoder.encode(text))
    
    async def get_usage_today(self, user_id: str, course_id: str) -> int:
        """Get user's token usage for today."""
        query = text("""
            SELECT "tokensUsed"
            FROM "TokenUsage"
            WHERE "userId" = :user_id 
            AND "courseId" = :course_id 
            AND date = :today
        """)
        
        with self.db.connect() as conn:
            result = conn.execute(query, {
                "user_id": user_id,
                "course_id": course_id,
                "today": date.today()
            }).fetchone()
            
            return result.tokensUsed if result else 0
    
    async def check_budget(self, user_id: str, course_id: str, estimated_tokens: int = 0) -> bool:
        """Check if user has budget remaining for a request."""
        current_usage = await self.get_usage_today(user_id, course_id)
        return (current_usage + estimated_tokens) < self.max_tokens_per_day
    
    async def record_usage(self, user_id: str, course_id: str, tokens_used: int) -> int:
        """Record token usage and return new total for today."""
        query = text("""
            INSERT INTO "TokenUsage" (id, "userId", "courseId", "tokensUsed", date, "createdAt", "updatedAt")
            VALUES (gen_random_uuid(), :user_id, :course_id, :tokens, :today, NOW(), NOW())
            ON CONFLICT ("userId", "courseId", date)
            DO UPDATE SET 
                "tokensUsed" = "TokenUsage"."tokensUsed" + :tokens,
                "updatedAt" = NOW()
            RETURNING "tokensUsed"
        """)
        
        with self.db.connect() as conn:
            result = conn.execute(query, {
                "user_id": user_id,
                "course_id": course_id,
                "tokens": tokens_used,
                "today": date.today()
            }).fetchone()
            conn.commit()
            
            return result.tokensUsed if result else tokens_used
    
    async def get_remaining_budget(self, user_id: str, course_id: str) -> int:
        """Get remaining token budget for today."""
        current_usage = await self.get_usage_today(user_id, course_id)
        return max(0, self.max_tokens_per_day - current_usage)
