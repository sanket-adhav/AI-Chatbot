import logging
from sqlalchemy.orm import Session
from app.models.document import Document
from app.services.rag.document_loader import extract_text_from_pdf
from app.services.rag.text_splitter import split_text
from app.services.ai.embeddings_service import get_embedding
from app.services.rag.vector_store import upsert_chunks

logger = logging.getLogger(__name__)

def process_document_background(db_session: Session, document_id: int):
    """Background task to extract, chunk, embed, and store document in ChromaDB."""
    doc = db_session.query(Document).filter(Document.id == document_id).first()
    if not doc:
        logger.error(f"Document {document_id} not found for processing.")
        return

    try:
        # 1. Extract text
        raw_text = extract_text_from_pdf(doc.file_path)
        if not raw_text.strip():
            raise ValueError("No text could be extracted from the PDF.")

        # 2. Chunk text
        chunks = split_text(raw_text)

        # 3. Prepare data for ChromaDB
        ids = []
        documents = []
        metadatas = []
        embeddings = []

        for i, chunk in enumerate(chunks):
            chunk_id = f"doc_{doc.id}_chunk_{i}"
            embedding = get_embedding(chunk)
            
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
            upsert_chunks(ids, embeddings, documents, metadatas)

        # 5. Update status
        doc.status = "ready"
        db_session.commit()
        logger.info(f"Successfully processed document {document_id}")

    except Exception as e:
        logger.error(f"Failed to process document {document_id}: {e}")
        doc.status = "failed"
        db_session.commit()
