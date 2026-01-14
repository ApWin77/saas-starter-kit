"""
Unit tests for the Chat Service.
"""
import pytest
from unittest.mock import MagicMock, AsyncMock, patch
from datetime import datetime
import json

# These tests would require pytest and pytest-asyncio
# Run with: pytest apps/api/tests/


class TestChatServiceUnit:
    """Unit tests for ChatService."""

    @pytest.fixture
    def mock_db_engine(self):
        """Create a mock database engine."""
        engine = MagicMock()
        connection = MagicMock()
        engine.connect.return_value.__enter__ = MagicMock(return_value=connection)
        engine.connect.return_value.__exit__ = MagicMock(return_value=False)
        return engine, connection

    @pytest.fixture
    def mock_openai_client(self):
        """Create a mock OpenAI client."""
        client = MagicMock()
        
        # Mock chat completion response
        completion_response = MagicMock()
        completion_response.choices = [
            MagicMock(message=MagicMock(content="This is a test response based on the course materials."))
        ]
        completion_response.usage = MagicMock(total_tokens=150)
        client.chat.completions.create.return_value = completion_response
        
        # Mock embedding response
        embedding_response = MagicMock()
        embedding_response.data = [MagicMock(embedding=[0.1] * 1536)]
        client.embeddings.create.return_value = embedding_response
        
        return client

    @pytest.fixture
    def mock_budget_service(self):
        """Create a mock budget service."""
        service = MagicMock()
        service.check_budget = AsyncMock(return_value=True)
        service.record_usage = AsyncMock(return_value=150)
        service.count_tokens = MagicMock(return_value=50)
        return service

    def test_determine_answer_mode_grounded(self):
        """Test that answers with chunks are marked as grounded."""
        from services.chat_service import ChatService
        
        # Create minimal mock dependencies
        service = ChatService.__new__(ChatService)
        
        chunks = [
            {
                "id": "chunk-1",
                "source_title": "Lecture 3",
                "page_number": 12,
                "chunk_text": "Test content"
            }
        ]
        response_text = "According to Lecture 3, page 12, the concept is..."
        
        result = service._determine_answer_mode(response_text, chunks)
        
        assert result.value == "COURSE_GROUNDED"

    def test_determine_answer_mode_outside(self):
        """Test that answers marked as outside are detected."""
        from services.chat_service import ChatService
        
        service = ChatService.__new__(ChatService)
        
        chunks = []
        response_text = "[Outside Course Material] This is general knowledge..."
        
        result = service._determine_answer_mode(response_text, chunks)
        
        assert result.value == "OUTSIDE_MATERIAL"

    def test_format_citations(self):
        """Test citation formatting."""
        from services.chat_service import ChatService
        
        service = ChatService.__new__(ChatService)
        
        chunks = [
            {
                "id": "chunk-1",
                "content_file_id": "file-1",
                "source_title": "Lecture 3",
                "page_number": 12,
                "section_heading": "Introduction",
                "chunk_text": "This is a test chunk with some content that should be truncated in the snippet."
            }
        ]
        
        citations = service._format_citations(chunks)
        
        assert len(citations) == 1
        assert citations[0].chunk_id == "chunk-1"
        assert citations[0].source_title == "Lecture 3"
        assert citations[0].page_number == 12


class TestBudgetServiceUnit:
    """Unit tests for BudgetService."""

    def test_count_tokens(self):
        """Test token counting."""
        from services.budget_service import BudgetService
        
        service = BudgetService.__new__(BudgetService)
        service._encoder = None
        
        text = "Hello, this is a test message."
        count = service.count_tokens(text)
        
        # Should return a positive integer
        assert isinstance(count, int)
        assert count > 0


class TestRetrievalServiceUnit:
    """Unit tests for RetrievalService."""

    @pytest.fixture
    def mock_retrieval_service(self, mock_db_engine, mock_openai_client):
        """Create a retrieval service with mocks."""
        from services.retrieval_service import RetrievalService
        
        engine, _ = mock_db_engine
        service = RetrievalService(
            db_engine=engine,
            openai_client=mock_openai_client,
            embedding_model="text-embedding-3-small",
            top_k=5
        )
        return service

    @pytest.mark.asyncio
    async def test_get_embedding(self, mock_retrieval_service):
        """Test embedding generation."""
        embedding = await mock_retrieval_service.get_embedding("test query")
        
        assert len(embedding) == 1536
        assert all(isinstance(x, float) for x in embedding)

    @pytest.mark.asyncio
    async def test_format_context(self, mock_retrieval_service):
        """Test context formatting."""
        chunks = [
            {
                "source_title": "Lecture 1",
                "page_number": 5,
                "section_heading": "Intro",
                "chunk_text": "This is the content."
            }
        ]
        
        context = await mock_retrieval_service.format_context(chunks)
        
        assert "Lecture 1" in context
        assert "Page 5" in context
        assert "This is the content." in context

    @pytest.mark.asyncio
    async def test_format_context_empty(self, mock_retrieval_service):
        """Test context formatting with no chunks."""
        context = await mock_retrieval_service.format_context([])
        
        assert context == ""


class TestChatServiceIntegration:
    """Integration tests for ChatService (requires database)."""

    @pytest.mark.integration
    @pytest.mark.asyncio
    async def test_create_thread(self):
        """Test thread creation flow."""
        # This test would require a real or test database
        # Marked as integration test - skip in unit test runs
        pass

    @pytest.mark.integration
    @pytest.mark.asyncio
    async def test_send_message_flow(self):
        """Test full message send and receive flow."""
        # This test would require a real or test database + OpenAI API
        # Marked as integration test - skip in unit test runs
        pass


# Pytest configuration
def pytest_configure(config):
    config.addinivalue_line(
        "markers", "integration: mark test as integration test"
    )
