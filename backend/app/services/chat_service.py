import time
from sqlalchemy.orm import Session
from sqlalchemy.sql import func
from fastapi import HTTPException

from app.models.conversation import Conversation
from app.models.message import Message
from app.schemas.schemas import ConversationCreate
from app.services.agent_service import get_agent_by_id
from app.services.gemini_service import get_gemini_response, get_gemini_vision_response, stream_gemini_response
from app.services.document_service import document_service


# ── Conversation CRUD ─────────────────────────────────────────────────────────

def create_conversation(db: Session, data: ConversationCreate, user_id: int | None = None) -> Conversation:
    agent = get_agent_by_id(db, data.agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail=f"Agent {data.agent_id} not found.")
        
    # Security: Ensure the user can only use public agents or their own agents
    if not agent.is_public and agent.user_id != user_id:
        raise HTTPException(status_code=403, detail="You do not have permission to use this agent.")
        
    conv = Conversation(title=data.title, agent_id=data.agent_id, user_id=user_id)
    db.add(conv)
    db.commit()
    db.refresh(conv)
    return conv


def get_conversation(db: Session, conv_id: int, user_id: int | None = None) -> Conversation:
    q = db.query(Conversation).filter(Conversation.id == conv_id)
    if user_id is not None:
        q = q.filter(Conversation.user_id == user_id)
    conv = q.first()
    if not conv:
        raise HTTPException(status_code=404, detail=f"Conversation {conv_id} not found.")
    return conv


def list_conversations(db: Session, user_id: int | None = None) -> list[Conversation]:
    q = db.query(Conversation)
    if user_id is not None:
        q = q.filter(Conversation.user_id == user_id)
    return q.order_by(Conversation.updated_at.desc()).all()


def delete_conversation(db: Session, conv_id: int, user_id: int | None = None) -> None:
    conv = get_conversation(db, conv_id, user_id=user_id)
    db.delete(conv)
    db.commit()


# ── Message CRUD ──────────────────────────────────────────────────────────────

def get_messages(db: Session, conv_id: int) -> list[Message]:
    get_conversation(db, conv_id)  # validates existence
    return (
        db.query(Message)
        .filter(Message.conversation_id == conv_id)
        .order_by(Message.created_at.asc())
        .all()
    )


def send_message(db: Session, conv_id: int, user_content: str, use_documents: bool = False, user_id: int | None = None, model_name: str | None = None):
    """
    Persist the user message, call Gemini with full history, persist assistant reply.
    Returns (user_msg, assistant_msg).
    """
    conv = get_conversation(db, conv_id)
    agent = get_agent_by_id(db, conv.agent_id)

    # Load existing history for Gemini context
    past_messages = get_messages(db, conv_id)
    history = [
        {"role": msg.role, "parts": [msg.content]}
        for msg in past_messages
    ]

    # Persist user message
    user_msg = Message(
        conversation_id=conv_id, 
        role="user", 
        content=user_content,
        used_rag=use_documents,
        agent_id=agent.id
    )
    db.add(user_msg)
    
    # Auto-title conversation if this is the first message
    if not past_messages:
        # Truncate to 50 chars
        new_title = user_content[:50].strip()
        if len(user_content) > 50:
            new_title += "…"
        conv.title = new_title
        db.add(conv)

    db.commit()
    db.refresh(user_msg)
    
    # Combine Agent instruction + User's global system prompt
    final_instruction = agent.instruction_template
    if conv.user and conv.user.system_prompt:
        final_instruction += f"\n\n[USER GLOBAL INSTRUCTIONS]:\n{conv.user.system_prompt}"
        
    if use_documents and user_id is not None:
        doc_context = document_service.search_documents(user_content, user_id)
        if doc_context:
            final_instruction += f"\n\n[DOCUMENT CONTEXT]:\nYou are a document-aware assistant. Use ONLY the provided context below to answer accurately. If the answer is not in the context, say you don't know based on the documents.\n{doc_context}"

    # Call Gemini
    start_time = time.time()
    try:
        reply_text, token_usage = get_gemini_response(
            instruction=final_instruction,
            history=history,
            user_message=user_content,
            model_name=model_name,
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Gemini API error: {str(e)}")
    response_time_ms = int((time.time() - start_time) * 1000)

    # Persist assistant reply
    assistant_msg = Message(
        conversation_id=conv_id, 
        role="model", 
        content=reply_text,
        prompt_tokens=token_usage.get("prompt_tokens", 0),
        completion_tokens=token_usage.get("completion_tokens", 0),
        total_tokens=token_usage.get("total_tokens", 0),
        response_time_ms=response_time_ms,
        used_rag=use_documents,
        agent_id=agent.id
    )
    db.add(assistant_msg)
    
    conv.total_tokens += token_usage.get("total_tokens", 0)
    db.add(conv)
    
    db.commit()
    db.refresh(assistant_msg)

    # Update conversation updated_at via touch
    db.query(Conversation).filter(Conversation.id == conv_id).update(
        {"updated_at": user_msg.created_at}
    )
    db.commit()

    return user_msg, assistant_msg


def update_conversation(db: Session, conv_id: int, title: str, user_id: int | None = None) -> Conversation:
    conv = get_conversation(db, conv_id, user_id)
    conv.title = title
    db.add(conv)
    db.commit()
    db.refresh(conv)
    return conv


def prepare_stream_message(db: Session, conv_id: int, user_content: str, use_documents: bool = False, user_id: int | None = None, model_name: str | None = None):
    """
    Persists the user message and returns everything needed to start a Gemini stream:
    Returns (user_msg, agent_instruction, history).
    The caller is responsible for streaming + saving the assistant reply.
    """
    conv = get_conversation(db, conv_id)
    agent = get_agent_by_id(db, conv.agent_id)

    # Build Gemini chat history from past messages
    past_messages = get_messages(db, conv_id)
    history = [
        {"role": msg.role, "parts": [msg.content]}
        for msg in past_messages
    ]

    # Auto-title if this is the first message in the conversation
    if not past_messages:
        new_title = user_content[:50].strip()
        if len(user_content) > 50:
            new_title += "…"
        conv.title = new_title
        db.add(conv)

    # Persist user message now (before streaming starts)
    user_msg = Message(
        conversation_id=conv_id,
        role="user",
        content=user_content,
        used_rag=use_documents,
        agent_id=agent.id
    )
    db.add(user_msg)
    db.commit()
    db.refresh(user_msg)
    
    final_instruction = agent.instruction_template
    if use_documents and user_id is not None:
        doc_context = document_service.search_documents(user_content, user_id)
        if doc_context:
            final_instruction += f"\n\n[DOCUMENT CONTEXT]:\nYou are a document-aware assistant. Use ONLY the provided context below to answer accurately. If the answer is not in the context, say you don't know based on the documents.\n{doc_context}"

    return user_msg, final_instruction, history


def send_message_with_image(
    db: Session,
    conv_id: int,
    user_content: str,
    image_bytes: bytes,
    mime_type: str,
    file_url: str,
    model_name: str | None = None,
):
    """
    Persist user message with image reference, call Gemini vision API,
    persist assistant reply. Returns (user_msg, assistant_msg).
    """
    conv = get_conversation(db, conv_id)
    agent = get_agent_by_id(db, conv.agent_id)

    # Load existing history (text only for Gemini chat context)
    past_messages = get_messages(db, conv_id)
    history = [
        {"role": msg.role, "parts": [msg.content]}
        for msg in past_messages
    ]

    # Display text for the user message bubble
    display_text = user_content if user_content else "📷 Image uploaded for analysis."

    # Auto-title if first message
    if not past_messages:
        new_title = (user_content or "Image analysis")[:50].strip()
        if len(user_content) > 50:
            new_title += "…"
        conv.title = new_title
        db.add(conv)

    # Persist user message with image reference
    user_msg = Message(
        conversation_id=conv_id,
        role="user",
        content=display_text,
        image_url=file_url,
        used_rag=False,
        agent_id=agent.id
    )
    db.add(user_msg)
    db.commit()
    db.refresh(user_msg)

    # Call Gemini vision API
    start_time = time.time()
    try:
        reply_text, token_usage = get_gemini_vision_response(
            instruction=agent.instruction_template,
            history=history,
            user_message=user_content,
            image_bytes=image_bytes,
            mime_type=mime_type,
            model_name=model_name,
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Gemini vision API error: {str(e)}")
    response_time_ms = int((time.time() - start_time) * 1000)

    # Persist assistant reply
    assistant_msg = Message(
        conversation_id=conv_id, 
        role="model", 
        content=reply_text,
        prompt_tokens=token_usage.get("prompt_tokens", 0),
        completion_tokens=token_usage.get("completion_tokens", 0),
        total_tokens=token_usage.get("total_tokens", 0),
        response_time_ms=response_time_ms,
        used_rag=False,
        agent_id=agent.id
    )
    db.add(assistant_msg)
    
    conv.total_tokens += token_usage.get("total_tokens", 0)
    db.add(conv)
    
    db.commit()
    db.refresh(assistant_msg)

    # Touch conversation updated_at
    db.query(Conversation).filter(Conversation.id == conv_id).update(
        {"updated_at": user_msg.created_at}
    )
    db.commit()

    return user_msg, assistant_msg
