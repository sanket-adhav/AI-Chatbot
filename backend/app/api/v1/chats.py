import io
import json
import logging
import time
from datetime import datetime
from typing import List, Optional, AsyncGenerator

from fastapi import APIRouter, Depends, Request, HTTPException, status, File, Form, UploadFile, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import delete
from pydantic import BaseModel
from pathlib import Path
import uuid

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, HRFlowable
from reportlab.lib.enums import TA_LEFT, TA_RIGHT

from app.core.database import get_db
from app.core.rate_limit import limiter
from app.core.security import get_current_user
from app.models.user import User
from app.models.message import Message
from app.models.conversation import Conversation
from app.models.folder import Folder
from app.schemas import (
    ConversationCreate, ConversationOut, ConversationListItem, ConversationUpdate,
    MessageCreate, MessageOut, ChatResponse, FolderCreate, FolderOut,
    SearchResponse, MessageSearchResult
)
from app.services.chat_service import (
    create_conversation, get_conversation, list_conversations, delete_conversation,
    send_message, get_messages, prepare_stream_message, send_message_with_image
)
from app.services.ai.gemini_service import stream_gemini_response

logger = logging.getLogger(__name__)

# Primary conversations router
router = APIRouter(prefix="/conversations", tags=["Conversations"])

# Folders router
folders_router = APIRouter(prefix="/folders", tags=["Folders"])

# Search router
search_router = APIRouter(tags=["Search"])

# Constants for uploads
ALLOWED_MIME = {"image/jpeg", "image/png", "image/webp", "image/gif"}
MAX_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB
UPLOAD_DIR = Path(__file__).parent.parent.parent.parent / "data" / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True, parents=True)


# ── CONVERSATIONS ENDPOINTS ───────────────────────────────────────────────────

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
    
    if body.folder_id is not None:
        folder = db.query(Folder).filter(Folder.id == body.folder_id, Folder.user_id == current_user.id).first()
        if not folder:
            raise HTTPException(status_code=404, detail="Folder not found")
            
    conv.folder_id = body.folder_id
    db.add(conv)
    db.commit()
    db.refresh(conv, ["agent"])
    return conv


# ── MESSAGES ENDPOINTS ────────────────────────────────────────────────────────

@router.post("/{conv_id}/messages", response_model=ChatResponse, status_code=201)
@limiter.limit("20/minute")
def post_message(
    request: Request,
    conv_id: int,
    body: MessageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
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
    get_conversation(db, conv_id, user_id=current_user.id)
    db.execute(delete(Message).where(Message.id == msg_id, Message.conversation_id == conv_id))
    db.commit()


# ── SSE STREAMING ENDPOINT ─────────────────────────────────────────────────────

@router.post("/{conv_id}/messages/stream")
@limiter.limit("20/minute")
async def stream_message(
    request: Request,
    conv_id: int,
    body: MessageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    get_conversation(db, conv_id, user_id=current_user.id)

    user_msg, instruction, history = prepare_stream_message(
        db, conv_id, body.content, use_documents=body.use_documents, user_id=current_user.id, model_name=body.model_name
    )

    async def event_generator() -> AsyncGenerator[str, None]:
        import time
        start_time = time.time()
        full_text = ""
        assistant_msg_id = None
        token_usage = {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}

        yield f"data: {json.dumps({'user_msg_id': user_msg.id})}\n\n"

        try:
            async for item in stream_gemini_response(instruction, history, body.content, model_name=body.model_name):
                if isinstance(item, dict) and "token_usage" in item:
                    token_usage = item["token_usage"]
                else:
                    full_text += item
                    yield f"data: {json.dumps({'chunk': item})}\n\n"

        except Exception as exc:
            logger.error(f"Streaming error conv={conv_id}: {exc}")
            yield f"data: {json.dumps({'error': str(exc)})}\n\n"
            return

        response_time_ms = int((time.time() - start_time) * 1000)
        try:
            assistant_msg = Message(
                conversation_id=conv_id,
                role="model",
                content=full_text,
                prompt_tokens=token_usage.get("prompt_tokens", 0),
                completion_tokens=token_usage.get("completion_tokens", 0),
                total_tokens=token_usage.get("total_tokens", 0),
                response_time_ms=response_time_ms,
                used_rag=body.use_documents,
                agent_id=user_msg.agent_id
            )
            db.add(assistant_msg)
            
            conv = db.query(Conversation).filter(Conversation.id == conv_id).first()
            if conv:
                conv.total_tokens += token_usage.get("total_tokens", 0)
                from sqlalchemy.sql import func
                conv.updated_at = func.now()
                db.add(conv)
            
            db.commit()
            db.refresh(assistant_msg)
            assistant_msg_id = assistant_msg.id

        except Exception as db_exc:
            logger.error(f"Failed to save streamed assistant message: {db_exc}")

        yield f"data: {json.dumps({'done': True, 'msg_id': assistant_msg_id, 'conv_id': conv_id})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


# ── MULTIMODAL IMAGE UPLOAD ENDPOINT ──────────────────────────────────────────

@router.post("/{conv_id}/messages/image", response_model=ChatResponse, status_code=201)
@limiter.limit("10/minute")
async def post_image_message(
    request: Request,
    conv_id: int,
    image: UploadFile = File(...),
    content: str = Form(default=""),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    get_conversation(db, conv_id, user_id=current_user.id)

    if image.content_type not in ALLOWED_MIME:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported file type '{image.content_type}'. Allowed: JPEG, PNG, WebP, GIF.",
        )

    image_bytes = await image.read()
    if len(image_bytes) > MAX_SIZE_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"Image too large ({len(image_bytes) // 1024} KB). Max 5 MB.",
        )

    ext = image.filename.rsplit(".", 1)[-1].lower() if "." in (image.filename or "") else "jpg"
    filename = f"{uuid.uuid4().hex}.{ext}"
    file_path = UPLOAD_DIR / filename
    file_path.write_bytes(image_bytes)

    file_url = f"/uploads/{filename}"

    try:
        user_msg, assistant_msg = send_message_with_image(
            db=db,
            conv_id=conv_id,
            user_content=content,
            image_bytes=image_bytes,
            mime_type=image.content_type,
            file_url=file_url,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Image message processing failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to process image message.")

    return ChatResponse(
        user_message=MessageOut.model_validate(user_msg),
        assistant_message=MessageOut.model_validate(assistant_msg),
    )


# ── FOLDERS ENDPOINTS ─────────────────────────────────────────────────────────

@folders_router.get("", response_model=List[FolderOut])
def get_folders(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return db.query(Folder).filter(Folder.user_id == current_user.id).all()


@folders_router.post("", response_model=FolderOut, status_code=status.HTTP_201_CREATED)
def create_folder(
    folder_in: FolderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    db_folder = Folder(name=folder_in.name, user_id=current_user.id)
    db.add(db_folder)
    db.commit()
    db.refresh(db_folder)
    return db_folder


@folders_router.delete("/{folder_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_folder(
    folder_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    folder = db.query(Folder).filter(Folder.id == folder_id, Folder.user_id == current_user.id).first()
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")
    
    db.delete(folder)
    db.commit()
    return None


# ── SEARCH ENDPOINTS ──────────────────────────────────────────────────────────

def _build_search_result(msg: Message, conv: Conversation) -> MessageSearchResult:
    return MessageSearchResult(
        message_id=msg.id,
        conversation_id=conv.id,
        conv_title=conv.title,
        role=msg.role,
        content=msg.content,
        created_at=msg.created_at,
    )


@search_router.get("/search", response_model=SearchResponse)
@limiter.limit("30/minute")
def global_search(
    request: Request,
    q: str = Query(..., min_length=1, max_length=200, description="Search query"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not q.strip():
        raise HTTPException(status_code=400, detail="Search query cannot be empty.")

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


@search_router.get("/conversations/{conv_id}/search", response_model=SearchResponse)
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
    if not q.strip():
        raise HTTPException(status_code=400, detail="Search query cannot be empty.")

    conv = db.query(Conversation).filter(Conversation.id == conv_id, Conversation.user_id == current_user.id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found.")

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


# ── EXPORTS ENDPOINTS ─────────────────────────────────────────────────────────

def _get_authorized_conversation(db: Session, conv_id: int, user_id: int) -> Conversation:
    conv = db.query(Conversation).filter(Conversation.id == conv_id, Conversation.user_id == user_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found.")
    return conv


def _build_pdf(conv: Conversation, messages: list) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=2 * cm,
        leftMargin=2 * cm,
        topMargin=2 * cm,
        bottomMargin=2 * cm,
    )
    styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        "ChatTitle",
        parent=styles["Heading1"],
        fontSize=20,
        textColor=colors.HexColor("#7c5cfc"),
        spaceAfter=6,
    )
    meta_style = ParagraphStyle(
        "Meta",
        parent=styles["Normal"],
        fontSize=9,
        textColor=colors.grey,
        spaceAfter=4,
    )
    user_bubble = ParagraphStyle(
        "UserBubble",
        parent=styles["Normal"],
        fontSize=11,
        textColor=colors.HexColor("#1a1a2e"),
        backColor=colors.HexColor("#ede9fe"),
        borderPadding=(8, 10, 8, 10),
        borderRadius=8,
        leading=16,
        spaceAfter=2,
        alignment=TA_RIGHT,
    )
    ai_bubble = ParagraphStyle(
        "AIBubble",
        parent=styles["Normal"],
        fontSize=11,
        textColor=colors.HexColor("#0f0f1e"),
        backColor=colors.HexColor("#f0f0ff"),
        borderPadding=(8, 10, 8, 10),
        borderRadius=8,
        leading=16,
        spaceAfter=2,
        alignment=TA_LEFT,
    )
    timestamp_style = ParagraphStyle(
        "Timestamp",
        parent=styles["Normal"],
        fontSize=8,
        textColor=colors.grey,
        spaceAfter=10,
        alignment=TA_LEFT,
    )

    story = []
    story.append(Paragraph(f"💬 {conv.title}", title_style))
    story.append(Paragraph(f"Chat ID: {conv.id} | Created: {conv.created_at.strftime('%Y-%m-%d %H:%M')} UTC", meta_style))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#7c5cfc"), spaceAfter=16))

    for msg in messages:
        is_user = msg.role == "user"
        label = "You" if is_user else "🤖 Assistant"
        style = user_bubble if is_user else ai_bubble

        safe_content = (
            msg.content
            .replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
            .replace("\n", "<br/>")
        )

        story.append(Paragraph(f"<b>{label}</b>", meta_style))
        story.append(Paragraph(safe_content, style))
        story.append(Paragraph(msg.created_at.strftime("%Y-%m-%d %H:%M:%S UTC"), timestamp_style))

    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.lightgrey))
    story.append(Spacer(1, 0.3 * cm))
    story.append(Paragraph(f"Exported on {datetime.utcnow().strftime('%Y-%m-%d %H:%M')} UTC · AI Chatbot Platform", meta_style))

    doc.build(story)
    return buffer.getvalue()


@router.get("/{conv_id}/export/json")
@limiter.limit("10/minute")
def export_json(
    request: Request,
    conv_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    conv = _get_authorized_conversation(db, conv_id, current_user.id)
    messages = get_messages(db, conv_id)

    payload = {
        "export_version": "1.0",
        "exported_at": datetime.utcnow().isoformat() + "Z",
        "conversation": {
            "id": conv.id,
            "title": conv.title,
            "agent_id": conv.agent_id,
            "created_at": conv.created_at.isoformat(),
            "updated_at": conv.updated_at.isoformat(),
        },
        "messages": [
            {
                "id": msg.id,
                "role": msg.role,
                "content": msg.content,
                "created_at": msg.created_at.isoformat(),
            }
            for msg in messages
        ],
        "message_count": len(messages),
    }

    json_bytes = json.dumps(payload, indent=2, ensure_ascii=False).encode("utf-8")
    safe_title = "".join(c if c.isalnum() or c in (" ", "-", "_") else "_" for c in conv.title)[:50]
    filename = f"chat_{safe_title}_{conv_id}.json"

    return StreamingResponse(
        io.BytesIO(json_bytes),
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/{conv_id}/export/pdf")
@limiter.limit("5/minute")
def export_pdf(
    request: Request,
    conv_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    conv = _get_authorized_conversation(db, conv_id, current_user.id)
    messages = get_messages(db, conv_id)

    try:
        pdf_bytes = _build_pdf(conv, messages)
    except Exception as e:
        logger.error(f"PDF generation failed for conv {conv_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate PDF.")

    safe_title = "".join(c if c.isalnum() or c in (" ", "-", "_") else "_" for c in conv.title)[:50]
    filename = f"chat_{safe_title}_{conv_id}.pdf"

    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
