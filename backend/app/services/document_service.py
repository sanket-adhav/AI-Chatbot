import os
import logging
from sqlalchemy.orm import Session
import chromadb
import google.generativeai as genai
from pypdf import PdfReader
from langchain_text_splitters import RecursiveCharacterTextSplitter

from app.models.document import Document
from app.core.config import settings

logger = logging.getLogger(__name__)

# Initialize ChromaDB
CHROMA_DATA_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "chroma_db")
os.makedirs(CHROMA_DATA_PATH, exist_ok=True)
chroma_client = chromadb.PersistentClient(path=CHROMA_DATA_PATH)
collection = chroma_client.get_or_create_collection(name="user_documents")

# Configure GenAI
genai.configure(api_key=settings.gemini_api_key)


class DocumentService:
    def __init__(self):
        self.embedding_model = "models/gemini-embedding-001"
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=800,
            chunk_overlap=150,
            separators=["\n\n", "\n", " ", ""]
        )

    def extract_text_from_pdf(self, file_path: str) -> str:
        """Extracts text from a PDF file."""
        text = ""
        try:
            reader = PdfReader(file_path)
            for page in reader.pages:
                extracted = page.extract_text()
                if extracted:
                    text += extracted + "\n\n"
        except Exception as e:
            logger.error(f"Error extracting PDF {file_path}: {e}")
            raise
        return text

    def get_embedding(self, text: str) -> list[float]:
        """Generates embedding using Gemini."""
        response = genai.embed_content(
            model=self.embedding_model,
            content=text,
            task_type="retrieval_document"
        )
        return response['embedding']

    def process_document_background(self, db_session: Session, document_id: int):
        """Background task to extract, chunk, embed, and store document in ChromaDB."""
        doc = db_session.query(Document).filter(Document.id == document_id).first()
        if not doc:
            logger.error(f"Document {document_id} not found for processing.")
            return

        try:
            # 1. Extract text
            raw_text = self.extract_text_from_pdf(doc.file_path)
            if not raw_text.strip():
                raise ValueError("No text could be extracted from the PDF.")

            # 2. Chunk text
            chunks = self.text_splitter.split_text(raw_text)

            # 3. Prepare data for ChromaDB
            ids = []
            documents = []
            metadatas = []
            embeddings = []

            for i, chunk in enumerate(chunks):
                chunk_id = f"doc_{doc.id}_chunk_{i}"
                embedding = self.get_embedding(chunk)
                
                ids.append(chunk_id)
                documents.append(chunk)
                embeddings.append(embedding)
                metadatas.append({
                    "document_id": doc.id,
                    "user_id": doc.user_id,
                    "filename": doc.filename,
                    "chunk_index": i
                })

            # 4. Upsert to ChromaDB
            if ids:
                collection.upsert(
                    ids=ids,
                    embeddings=embeddings,
                    documents=documents,
                    metadatas=metadatas
                )

            # 5. Update status
            doc.status = "ready"
            db_session.commit()
            logger.info(f"Successfully processed document {document_id}")

        except Exception as e:
            logger.error(f"Failed to process document {document_id}: {e}")
            doc.status = "failed"
            db_session.commit()

    def search_documents(self, query: str, user_id: int, top_k: int = 4) -> str:
        """Returns relevant context strings from ChromaDB for a given user query."""
        try:
            # Embed the user query
             # use task_type="retrieval_query" for the query in gemini-embedding-001
            response = genai.embed_content(
                model=self.embedding_model,
                content=query,
                task_type="retrieval_query"
            )
            query_embedding = response['embedding']

            # Search ChromaDB, strongly filtering by user_id for security
            results = collection.query(
                query_embeddings=[query_embedding],
                n_results=top_k,
                where={"user_id": user_id}
            )

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
            logger.error(f"Error searching documents for user {user_id}: {e}")
            return ""

    def delete_document_from_vector_store(self, document_id: int):
        """Deletes all chunks associated with a document ID from ChromaDB."""
        try:
            collection.delete(where={"document_id": document_id})
        except Exception as e:
            logger.error(f"Failed to delete document {document_id} from Chroma: {e}")

document_service = DocumentService()
