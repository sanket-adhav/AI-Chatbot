import os
import logging
import chromadb

logger = logging.getLogger(__name__)

# Initialize ChromaDB persistent storage path
CHROMA_DATA_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), "data", "chroma_db")
os.makedirs(CHROMA_DATA_PATH, exist_ok=True)
chroma_client = chromadb.PersistentClient(path=CHROMA_DATA_PATH)
collection = chroma_client.get_or_create_collection(name="user_documents")

def upsert_chunks(ids: list[str], embeddings: list[list[float]], documents: list[str], metadatas: list[dict]):
    """Upserts document chunks to ChromaDB collection."""
    try:
        collection.upsert(
            ids=ids,
            embeddings=embeddings,
            documents=documents,
            metadatas=metadatas
        )
    except Exception as e:
        logger.error(f"Failed to upsert to ChromaDB: {e}")
        raise

def delete_by_document_id(document_id: int):
    """Deletes all chunks associated with a document ID from ChromaDB."""
    try:
        collection.delete(where={"document_id": document_id})
    except Exception as e:
        logger.error(f"Failed to delete document {document_id} from Chroma: {e}")

def query_vector_store(query_embedding: list[float], user_id: int, top_k: int = 4) -> dict:
    """Queries ChromaDB vector collection, strictly filtered by user_id."""
    return collection.query(
        query_embeddings=[query_embedding],
        n_results=top_k,
        where={"user_id": user_id}
    )
