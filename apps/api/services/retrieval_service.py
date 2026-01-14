from sqlalchemy import text
from sqlalchemy.engine import Engine
from typing import List, Dict, Any, Optional
from openai import OpenAI
import json


class RetrievalService:
    """Service for RAG retrieval using pgvector."""
    
    def __init__(
        self, 
        db_engine: Engine, 
        openai_client: OpenAI,
        embedding_model: str = "text-embedding-3-small",
        top_k: int = 5
    ):
        self.db = db_engine
        self.openai = openai_client
        self.embedding_model = embedding_model
        self.top_k = top_k
    
    async def get_embedding(self, text: str) -> List[float]:
        """Generate embedding for a text query."""
        response = self.openai.embeddings.create(
            model=self.embedding_model,
            input=text
        )
        return response.data[0].embedding
    
    async def retrieve_chunks(
        self, 
        query: str, 
        course_id: str,
        top_k: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """
        Retrieve relevant document chunks for a query using vector similarity.
        Only retrieves from the specified course (strict course-only filtering).
        """
        k = top_k or self.top_k
        
        # Generate query embedding
        query_embedding = await self.get_embedding(query)
        embedding_str = f"[{','.join(map(str, query_embedding))}]"
        
        # Vector similarity search with course filtering
        search_query = text("""
            SELECT 
                dc.id,
                dc."contentFileId",
                dc."chunkText",
                dc."chunkIndex",
                dc.metadata,
                cf.filename,
                1 - (dc.embedding <=> :embedding::vector) as similarity
            FROM "DocumentChunk" dc
            JOIN "ContentFile" cf ON dc."contentFileId" = cf.id
            WHERE dc."courseId" = :course_id
            AND dc.embedding IS NOT NULL
            ORDER BY dc.embedding <=> :embedding::vector
            LIMIT :limit
        """)
        
        with self.db.connect() as conn:
            results = conn.execute(search_query, {
                "embedding": embedding_str,
                "course_id": course_id,
                "limit": k
            }).fetchall()
            
            chunks = []
            for row in results:
                metadata = row.metadata if isinstance(row.metadata, dict) else json.loads(row.metadata)
                chunks.append({
                    "id": row.id,
                    "content_file_id": row.contentFileId,
                    "chunk_text": row.chunkText,
                    "chunk_index": row.chunkIndex,
                    "filename": row.filename,
                    "source_title": metadata.get("source_title", row.filename),
                    "page_number": metadata.get("page_number"),
                    "section_heading": metadata.get("section_heading"),
                    "similarity": float(row.similarity) if row.similarity else 0.0
                })
            
            return chunks
    
    async def format_context(self, chunks: List[Dict[str, Any]]) -> str:
        """Format retrieved chunks into context string for the LLM."""
        if not chunks:
            return ""
        
        context_parts = []
        for i, chunk in enumerate(chunks, 1):
            source_info = f"[Source {i}] {chunk['source_title']}"
            if chunk.get('page_number'):
                source_info += f", Page {chunk['page_number']}"
            if chunk.get('section_heading'):
                source_info += f" - {chunk['section_heading']}"
            
            context_parts.append(f"{source_info}\n{chunk['chunk_text']}\n")
        
        return "\n---\n".join(context_parts)
    
    async def check_has_content(self, course_id: str) -> bool:
        """Check if a course has any indexed content."""
        query = text("""
            SELECT COUNT(*) as count
            FROM "DocumentChunk"
            WHERE "courseId" = :course_id
            AND embedding IS NOT NULL
        """)
        
        with self.db.connect() as conn:
            result = conn.execute(query, {"course_id": course_id}).fetchone()
            return result.count > 0 if result else False
