import logging
from fastapi import APIRouter, Depends, Query, Request, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.db.database import get_db
from app.core.rate_limit import limiter
from app.core.security import get_current_user
from app.models.user import User
from app.models.message import Message
from app.models.conversation import Conversation
from app.schemas.schemas import SearchResponse, MessageSearchResult

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Search"])


def _build_search_result(msg: Message, conv: Conversation) -> MessageSearchResult:
    return MessageSearchResult(
        message_id=msg.id,
        conversation_id=conv.id,
        conv_title=conv.title,
        role=msg.role,
        content=msg.content,
        created_at=msg.created_at,
    )


# ── Global search across all user chats ────────────────────────────────────────

@router.get("/search", response_model=SearchResponse)
@limiter.limit("30/minute")
def global_search(
    request: Request,
    q: str = Query(..., min_length=1, max_length=200, description="Search query"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Search messages across all conversations belonging to the current user."""
    if not q.strip():
        raise HTTPException(status_code=400, detail="Search query cannot be empty.")

    logger.info(f"User {current_user.id} searching globally for: {q!r}")

    # Join messages → conversations, filter by user ownership + ILIKE
    base_q = (
        db.query(Message, Conversation)
        .join(Conversation, Message.conversation_id == Conversation.id)
        .filter(
            Conversation.user_id == current_user.id,
            Message.content.ilike(f"%{q}%"),
        )
        .order_by(Message.created_at.asc())
    )

    total = base_q.count()
    rows = base_q.offset((page - 1) * page_size).limit(page_size).all()

    results = [_build_search_result(msg, conv) for msg, conv in rows]

    return SearchResponse(
        results=results,
        total=total,
        page=page,
        page_size=page_size,
        query=q,
    )


# ── Search within a single conversation ────────────────────────────────────────

@router.get("/conversations/{conv_id}/search", response_model=SearchResponse)
@limiter.limit("30/minute")
def search_in_conversation(
    request: Request,
    conv_id: int,
    q: str = Query(..., min_length=1, max_length=200),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Search messages within a specific conversation."""
    if not q.strip():
        raise HTTPException(status_code=400, detail="Search query cannot be empty.")

    conv = (
        db.query(Conversation)
        .filter(Conversation.id == conv_id, Conversation.user_id == current_user.id)
        .first()
    )
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found.")

    logger.info(f"User {current_user.id} searching conv {conv_id} for: {q!r}")

    base_q = (
        db.query(Message)
        .filter(
            Message.conversation_id == conv_id,
            Message.content.ilike(f"%{q}%"),
        )
        .order_by(Message.created_at.asc())
    )

    total = base_q.count()
    msgs = base_q.offset((page - 1) * page_size).limit(page_size).all()

    results = [_build_search_result(msg, conv) for msg in msgs]

    return SearchResponse(
        results=results,
        total=total,
        page=page,
        page_size=page_size,
        query=q,
    )
