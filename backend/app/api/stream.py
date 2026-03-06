import json
import logging
from typing import AsyncGenerator

from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.core.rate_limit import limiter
from app.core.security import get_current_user
from app.models.message import Message
from app.models.conversation import Conversation
from app.models.user import User
from app.schemas.schemas import MessageCreate
from app.services.chat_service import get_conversation, prepare_stream_message
from app.services.gemini_service import stream_gemini_response

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/conversations", tags=["Streaming"])


@router.post("/{conv_id}/messages/stream")
@limiter.limit("20/minute")
async def stream_message(
    request: Request,
    conv_id: int,
    body: MessageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Stream a Gemini response token-by-token using Server-Sent Events (SSE).
    
    Protocol:
      - Each chunk: data: {"chunk": "<text>"}\n\n
      - On completion: data: {"done": true, "msg_id": <int>, "conv_id": <int>}\n\n
      - On error: data: {"error": "<message>"}\n\n
    """
    # ── Auth + validate conversation ownership ────────────────────────────────
    get_conversation(db, conv_id, user_id=current_user.id)

    # ── Persist user message + get streaming params ───────────────────────────
    user_msg, instruction, history = prepare_stream_message(
        db, conv_id, body.content, use_documents=body.use_documents, user_id=current_user.id, model_name=body.model_name
    )

    # ── Define the async SSE generator ───────────────────────────────────────
    async def event_generator() -> AsyncGenerator[str, None]:
        import time
        start_time = time.time()
        full_text = ""
        assistant_msg_id = None
        token_usage = {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}

        # Stream first event: user_message confirmed
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

        # ── Persist assistant reply after streaming completes ─────────────────
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
            
            # Retrieve conversation to update tokens
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
            "X-Accel-Buffering": "no",   # disable nginx buffering
            "Connection": "keep-alive",
        },
    )
