from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.api.auth import get_current_user
from app.models.user import User
from app.models.folder import Folder
from app.schemas.schemas import FolderCreate, FolderOut

router = APIRouter(prefix="/folders", tags=["Folders"])

@router.get("", response_model=List[FolderOut])
def get_folders(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all folders for the authenticated user."""
    folders = db.query(Folder).filter(Folder.user_id == current_user.id).all()
    return folders

@router.post("", response_model=FolderOut, status_code=status.HTTP_201_CREATED)
def create_folder(
    folder_in: FolderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new folder."""
    db_folder = Folder(
        name=folder_in.name,
        user_id=current_user.id
    )
    db.add(db_folder)
    db.commit()
    db.refresh(db_folder)
    return db_folder

@router.delete("/{folder_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_folder(
    folder_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a folder. Conversations inside will have their folder_id set to NULL due to ON DELETE SET NULL."""
    folder = db.query(Folder).filter(Folder.id == folder_id, Folder.user_id == current_user.id).first()
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")
    
    db.delete(folder)
    db.commit()
    return None
