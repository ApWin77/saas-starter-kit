from pydantic_settings import BaseSettings
from pydantic import field_validator
from functools import lru_cache
from pathlib import Path


# Find the project root .env file
def find_env_file():
    current = Path(__file__).resolve()
    for parent in current.parents:
        env_path = parent / ".env"
        if env_path.exists():
            return str(env_path)
    return ".env"


class Settings(BaseSettings):
    # Database (uses psycopg3 driver)
    database_url: str = "postgresql+psycopg://postgres:postgres@localhost:5432/saas"
    
    @field_validator('database_url')
    @classmethod
    def convert_to_psycopg3(cls, v: str) -> str:
        """Convert postgresql:// to postgresql+psycopg:// for psycopg3 driver."""
        if v.startswith('postgresql://'):
            return v.replace('postgresql://', 'postgresql+psycopg://', 1)
        if v.startswith('postgres://'):
            return v.replace('postgres://', 'postgresql+psycopg://', 1)
        return v
    
    # OpenAI
    openai_api_key: str = ""
    openai_model: str = "gpt-4-turbo-preview"
    openai_embedding_model: str = "text-embedding-3-small"
    
    # Token limits
    max_tokens_per_user_per_day: int = 50000
    max_tokens_per_request: int = 4000
    
    # Rate limiting
    rate_limit_requests_per_minute: int = 20
    
    # Course configuration
    default_course_id: str = "default-course-id"
    
    # RAG settings
    retrieval_top_k: int = 5
    embedding_dimension: int = 1536
    
    # Server
    cors_origins: str = "http://localhost:3000"
    
    class Config:
        env_file = find_env_file()
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
