import io
import json
import logging
from datetime import datetime

from fastapi import APIRouter, Depends, Request, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, HRFlowable
from reportlab.lib.enums import TA_LEFT, TA_RIGHT

from app.db.database import get_db
from app.core.rate_limit import limiter
from app.core.security import get_current_user
from app.models.user import User
from app.models.message import Message
from app.models.conversation import Conversation

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/conversations", tags=["Export"])


def _get_authorized_conversation(db: Session, conv_id: int, user_id: int) -> Conversation:
    conv = (
        db.query(Conversation)
        .filter(Conversation.id == conv_id, Conversation.user_id == user_id)
        .first()
    )
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found.")
    return conv


def _get_messages(db: Session, conv_id: int) -> list:
    return (
        db.query(Message)
        .filter(Message.conversation_id == conv_id)
        .order_by(Message.created_at.asc())
        .all()
    )


# ── JSON Export ────────────────────────────────────────────────────────────────

@router.get("/{conv_id}/export/json")
@limiter.limit("10/minute")
def export_json(
    request: Request,
    conv_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Export a conversation as a structured JSON file."""
    conv = _get_authorized_conversation(db, conv_id, current_user.id)
    messages = _get_messages(db, conv_id)

    logger.info(f"User {current_user.id} exporting conv {conv_id} as JSON")

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


# ── PDF Export ─────────────────────────────────────────────────────────────────

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

    # Custom styles
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

    # Header
    story.append(Paragraph(f"💬 {conv.title}", title_style))
    story.append(Paragraph(f"Chat ID: {conv.id} | Created: {conv.created_at.strftime('%Y-%m-%d %H:%M')} UTC", meta_style))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#7c5cfc"), spaceAfter=16))

    for msg in messages:
        is_user = msg.role == "user"
        label = "You" if is_user else "🤖 Assistant"
        style = user_bubble if is_user else ai_bubble

        # Escape content for HTML-like rendering in PDF
        safe_content = (
            msg.content
            .replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
            .replace("\n", "<br/>")
        )

        story.append(Paragraph(f"<b>{label}</b>", meta_style))
        story.append(Paragraph(safe_content, style))
        story.append(Paragraph(
            msg.created_at.strftime("%Y-%m-%d %H:%M:%S UTC"),
            timestamp_style,
        ))

    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.lightgrey))
    story.append(Spacer(1, 0.3 * cm))
    story.append(Paragraph(
        f"Exported on {datetime.utcnow().strftime('%Y-%m-%d %H:%M')} UTC · AI Chatbot Platform",
        meta_style,
    ))

    doc.build(story)
    return buffer.getvalue()


@router.get("/{conv_id}/export/pdf")
@limiter.limit("5/minute")
def export_pdf(
    request: Request,
    conv_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Export a conversation as a formatted PDF file."""
    conv = _get_authorized_conversation(db, conv_id, current_user.id)
    messages = _get_messages(db, conv_id)

    logger.info(f"User {current_user.id} exporting conv {conv_id} as PDF")

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
