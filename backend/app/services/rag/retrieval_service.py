import logging
from app.services.ai.embeddings_service import get_query_embedding
from app.services.rag.vector_store import query_vector_store

logger = logging.getLogger(__name__)

def retrieve_document_context(query: str, user_id: int, top_k: int = 4) -> str:
    """Returns relevant context strings from ChromaDB for a given user query."""
    try:
        # Embed the user query
        query_embedding = get_query_embedding(query)

        # Search ChromaDB
        results = query_vector_store(query_embedding, user_id, top_k)

        # Extract documents
        if not results or not results['documents']:
            return ""
        
        docs = results['documents'][0]
        if not docs:
            return ""

        # Connect chunks into a single context string
        context = "--- DOCUMENT CONTEXT START ---\n"
        for i, chunk in enumerate(docs):
            context += f"\n[Excerpt {i+1}]:\n{chunk}\n"
        context += "\n--- DOCUMENT CONTEXT END ---\n"
        return context

    except Exception as e:
        logger.error(f"Error retrieving document context for user {user_id}: {e}")
        return ""
