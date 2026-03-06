import os
import shutil
from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.document import Document
from app.models.user import User
from app.schemas.schemas import DocumentResponse
from app.core.security import get_current_user
from app.services.document_service import document_service

router = APIRouter(prefix="/documents", tags=["documents"])

UPLOAD_DIR = "uploads/documents"
os.makedirs(UPLOAD_DIR, exist_ok=True)


@router.get("", response_model=List[DocumentResponse])
def get_documents(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieve all documents uploaded by the current user."""
    docs = db.query(Document).filter(Document.user_id == current_user.id).order_by(Document.created_at.desc()).all()
    return docs


@router.post("/upload", response_model=DocumentResponse)
def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Upload a new PDF document, start processing in background."""
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")
        
    # Generate unique filename to avoid collisions
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    safe_filename = file.filename.replace(" ", "_").replace("/", "")
    unique_filename = f"{current_user.id}_{timestamp}_{safe_filename}"
    file_path = os.path.join(UPLOAD_DIR, unique_filename)
    
    # Save file
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not save file: {str(e)}")
        
    # Create DB entry
    db_doc = Document(
        user_id=current_user.id,
        filename=file.filename,
        file_path=file_path,
        status="processing"
    )
    db.add(db_doc)
    db.commit()
    db.refresh(db_doc)
    
    # Trigger background processing
    background_tasks.add_task(document_service.process_document_background, db, db_doc.id)
    
    return db_doc


@router.delete("/{document_id}")
def delete_document(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a document, its physical file, and its vector embeddings."""
    doc = db.query(Document).filter(Document.id == document_id, Document.user_id == current_user.id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
        
    # 1. Delete from vector store
    document_service.delete_document_from_vector_store(doc.id)
    
    # 2. Delete physical file
    if os.path.exists(doc.file_path):
        try:
            os.remove(doc.file_path)
        except Exception as e:
            # Log error but don't fail deletion
            pass
            
    # 3. Delete from DB
    db.delete(doc)
    db.commit()
    
    return {"message": "Document deleted successfully"}
