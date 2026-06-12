import google.generativeai as genai
from app.core.config import settings

genai.configure(api_key=settings.gemini_api_key)

EMBEDDING_MODEL = "models/gemini-embedding-001"

def get_embedding(text: str) -> list[float]:
    """Generates embedding using Gemini for document indexing."""
    response = genai.embed_content(
        model=EMBEDDING_MODEL,
        content=text,
        task_type="retrieval_document"
    )
    return response['embedding']

def get_query_embedding(query: str) -> list[float]:
    """Generates query embedding using Gemini for semantic search queries."""
    response = genai.embed_content(
        model=EMBEDDING_MODEL,
        content=query,
        task_type="retrieval_query"
    )
    return response['embedding']
