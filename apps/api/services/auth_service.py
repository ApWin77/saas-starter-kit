from sqlalchemy import text
from sqlalchemy.engine import Engine
from typing import Optional, Dict, Any
from datetime import datetime


class AuthService:
    """Service to validate NextAuth sessions from shared Postgres database."""
    
    def __init__(self, db_engine: Engine):
        self.db = db_engine
    
    async def validate_session(self, session_token: str) -> Optional[Dict[str, Any]]:
        """
        Validate a NextAuth session token and return user info.
        Returns None if session is invalid or expired.
        """
        if not session_token:
            return None
        
        query = text("""
            SELECT 
                s.id as session_id,
                s."userId" as user_id,
                s.expires,
                u.email,
                u.name,
                u.image
            FROM "Session" s
            JOIN "User" u ON s."userId" = u.id
            WHERE s."sessionToken" = :token
        """)
        
        with self.db.connect() as conn:
            result = conn.execute(query, {"token": session_token}).fetchone()
            
            if not result:
                return None
            
            # Check if session is expired
            if result.expires < datetime.utcnow():
                return None
            
            return {
                "session_id": result.session_id,
                "user_id": result.user_id,
                "email": result.email,
                "name": result.name,
                "image": result.image,
            }
    
    async def get_user_enrollment(self, user_id: str, course_id: str) -> Optional[Dict[str, Any]]:
        """Check if user is enrolled in a course and get their role."""
        query = text("""
            SELECT id, role, "createdAt"
            FROM "Enrollment"
            WHERE "userId" = :user_id AND "courseId" = :course_id
        """)
        
        with self.db.connect() as conn:
            result = conn.execute(query, {
                "user_id": user_id,
                "course_id": course_id
            }).fetchone()
            
            if not result:
                return None
            
            return {
                "id": result.id,
                "role": result.role,
                "created_at": result.createdAt,
            }
