import io
import uuid
import logging
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.core.rate_limit import limiter
from app.core.security import get_current_user
from app.models.user import User
from app.schemas.schemas import ChatResponse, MessageOut
from app.services.chat_service import get_conversation, send_message_with_image

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/conversations", tags=["Image Upload"])

ALLOWED_MIME = {"image/jpeg", "image/png", "image/webp", "image/gif"}
MAX_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB

UPLOAD_DIR = Path(__file__).parent.parent.parent / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)


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
    """
    Upload an image (with optional text) and get a multimodal Gemini response.
    Accepts multipart/form-data with 'image' file + optional 'content' text.
    """
    # ── Authorization ────────────────────────────────────────────────────────
    get_conversation(db, conv_id, user_id=current_user.id)

    # ── MIME validation ──────────────────────────────────────────────────────
    if image.content_type not in ALLOWED_MIME:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported file type '{image.content_type}'. Allowed: JPEG, PNG, WebP, GIF.",
        )

    # ── Size validation ──────────────────────────────────────────────────────
    image_bytes = await image.read()
    if len(image_bytes) > MAX_SIZE_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"Image too large ({len(image_bytes) // 1024} KB). Max 5 MB.",
        )

    logger.info(
        f"User {current_user.id} uploading {image.filename!r} "
        f"({image.content_type}, {len(image_bytes)} bytes) to conv {conv_id}"
    )

    # ── Save file locally ────────────────────────────────────────────────────
    ext = image.filename.rsplit(".", 1)[-1].lower() if "." in (image.filename or "") else "jpg"
    filename = f"{uuid.uuid4().hex}.{ext}"
    file_path = UPLOAD_DIR / filename
    file_path.write_bytes(image_bytes)

    # Relative URL for serving via /uploads static mount
    file_url = f"/uploads/{filename}"

    # ── Call service ─────────────────────────────────────────────────────────
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
