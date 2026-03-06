from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.core.rate_limit import limiter
from app.core.security import get_current_user
from app.models.user import User
from app.schemas.schemas import ConversationCreate, ConversationOut, ConversationListItem, ConversationUpdate
from app.services.chat_service import (
    create_conversation, get_conversation, list_conversations, delete_conversation
)

router = APIRouter(prefix="/conversations", tags=["Conversations"])


@router.post("", response_model=ConversationOut, status_code=201)
@limiter.limit("10/minute")
def new_conversation(
    request: Request,
    body: ConversationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    conv = create_conversation(db, body, user_id=current_user.id)
    db.refresh(conv, ["agent"])
    return conv


@router.get("", response_model=list[ConversationListItem])
@limiter.limit("30/minute")
def list_all_conversations(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return list_conversations(db, user_id=current_user.id)


@router.get("/{conv_id}", response_model=ConversationOut)
@limiter.limit("30/minute")
def get_single_conversation(
    request: Request,
    conv_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    conv = get_conversation(db, conv_id, user_id=current_user.id)
    db.refresh(conv, ["agent"])
    return conv


@router.delete("/{conv_id}", status_code=204)
@limiter.limit("10/minute")
def remove_conversation(
    request: Request,
    conv_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    delete_conversation(db, conv_id, user_id=current_user.id)


@router.patch("/{conv_id}", response_model=ConversationOut)
@limiter.limit("20/minute")
def update_conversation_endpoint(
    request: Request,
    conv_id: int,
    body: ConversationUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    conv = get_conversation(db, conv_id, user_id=current_user.id)
    if body.title is not None:
        conv.title = body.title
    db.add(conv)
    db.commit()
    db.refresh(conv, ["agent"])
    return conv


@router.patch("/{conv_id}/pin", response_model=ConversationOut)
@limiter.limit("20/minute")
def pin_conversation(
    request: Request,
    conv_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    conv = get_conversation(db, conv_id, user_id=current_user.id)
    conv.is_pinned = not conv.is_pinned
    db.add(conv)
    db.commit()
    db.refresh(conv, ["agent"])
    return conv


from pydantic import BaseModel
class MoveRequest(BaseModel):
    folder_id: int | None

@router.patch("/{conv_id}/move", response_model=ConversationOut)
@limiter.limit("20/minute")
def move_conversation(
    request: Request,
    conv_id: int,
    body: MoveRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    conv = get_conversation(db, conv_id, user_id=current_user.id)
    
    # If a folder_id is provided, verify it belongs to the user
    if body.folder_id is not None:
        from app.models.folder import Folder
        folder = db.query(Folder).filter(Folder.id == body.folder_id, Folder.user_id == current_user.id).first()
        from fastapi import HTTPException
        if not folder:
            raise HTTPException(status_code=404, detail="Folder not found")
            
    conv.folder_id = body.folder_id
    db.add(conv)
    db.commit()
    db.refresh(conv, ["agent"])
    return conv
