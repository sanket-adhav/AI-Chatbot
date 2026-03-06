from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.core.rate_limit import limiter
from app.core.security import get_current_user
from app.models.user import User
from app.models.message import Message
from app.schemas.schemas import MessageCreate, MessageOut, ChatResponse
from app.services.chat_service import send_message, get_messages, get_conversation

router = APIRouter(prefix="/conversations", tags=["Messages"])


@router.post("/{conv_id}/messages", response_model=ChatResponse, status_code=201)
@limiter.limit("20/minute")
def post_message(
    request: Request,
    conv_id: int,
    body: MessageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Ensure conversation belongs to user
    get_conversation(db, conv_id, user_id=current_user.id)
    user_msg, assistant_msg = send_message(db, conv_id, body.content, use_documents=body.use_documents, user_id=current_user.id, model_name=body.model_name)
    return ChatResponse(
        user_message=MessageOut.model_validate(user_msg),
        assistant_message=MessageOut.model_validate(assistant_msg),
    )


@router.get("/{conv_id}/messages", response_model=list[MessageOut])
@limiter.limit("30/minute")
def list_messages(
    request: Request,
    conv_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    get_conversation(db, conv_id, user_id=current_user.id)
    return get_messages(db, conv_id)


@router.delete("/{conv_id}/messages/{msg_id}", status_code=204)
@limiter.limit("10/minute")
def remove_message(
    request: Request,
    conv_id: int,
    msg_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Ensure conversation belongs to user
    get_conversation(db, conv_id, user_id=current_user.id)
    
    # Simple direct delete for model messages being regenerated
    from sqlalchemy import delete
    db.execute(delete(Message).where(Message.id == msg_id, Message.conversation_id == conv_id))
    db.commit()
