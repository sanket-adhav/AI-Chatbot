import sqlalchemy as sa
from sqlalchemy.orm import Session
from sqlalchemy.sql import func, desc, or_
from app.models.message import Message
from app.models.conversation import Conversation
from app.models.agent import Agent
from datetime import datetime, timedelta

def get_analytics_summary(db: Session, user_id: int, days: int = 30):
    start_date = datetime.utcnow() - timedelta(days=days)

    # Total messages
    total_messages = (
        db.query(func.count(Message.id))
        .select_from(Message)
        .join(Conversation, Message.conversation_id == Conversation.id)
        .filter(Conversation.user_id == user_id)
        .filter(Message.created_at >= start_date)
        .scalar() or 0
    )
    
    # Total conversations
    total_conversations = (
        db.query(func.count(Conversation.id))
        .select_from(Conversation)
        .filter(Conversation.user_id == user_id)
        .filter(Conversation.updated_at >= start_date)
        .scalar() or 0
    )
    
    # Total tokens & RAG usage & Response time (only from model messages)
    stats = (
        db.query(
            func.sum(Message.prompt_tokens).label("prompt_tokens"),
            func.sum(Message.completion_tokens).label("completion_tokens"),
            func.sum(Message.total_tokens).label("total_tokens"),
            func.sum(func.cast(Message.used_rag, sa.Integer)).label("rag_count"),
            func.avg(Message.response_time_ms).label("avg_response_time")
        )
        .select_from(Message)
        .join(Conversation, Message.conversation_id == Conversation.id)
        .filter(Conversation.user_id == user_id)
        .filter(Message.role == "model")
        .filter(Message.created_at >= start_date)
        .first()
    )
    
    prompt_tokens = int(stats.prompt_tokens) if stats and stats.prompt_tokens else 0
    completion_tokens = int(stats.completion_tokens) if stats and stats.completion_tokens else 0
    total_tokens = int(stats.total_tokens) if stats and stats.total_tokens else 0
    rag_count = int(stats.rag_count) if stats and stats.rag_count else 0
    avg_response_time = int(stats.avg_response_time) if stats and stats.avg_response_time else 0
    
    # Cost Estimate: $0.15 / 1M prompt tokens and $0.60 / 1M completion tokens
    estimated_cost = (prompt_tokens / 1_000_000 * 0.15) + (completion_tokens / 1_000_000 * 0.60)
    
    # Calculate RAG %
    model_msg_count = (
        db.query(func.count(Message.id))
        .select_from(Message)
        .join(Conversation, Message.conversation_id == Conversation.id)
        .filter(Conversation.user_id == user_id)
        .filter(Message.role == "user")
        .filter(Message.created_at >= start_date)
        .scalar() or 0
    )
    total_rag_usage = round((rag_count / model_msg_count * 100), 1) if model_msg_count > 0 else 0
    
    most_used = (
        db.query(Agent.name, func.count(Message.id).label("cnt"))
        .select_from(Message)
        .join(Conversation, Message.conversation_id == Conversation.id)
        .join(Agent, Agent.id == Message.agent_id)
        .filter(Conversation.user_id == user_id)
        .filter(Message.created_at >= start_date)
        .filter(Message.role == "model")
        .group_by(Agent.name)
        .order_by(desc("cnt"))
        .first()
    )
    most_used_agent = most_used.name if most_used else "N/A"
    
    # Peak Usage Hour
    from sqlalchemy import extract
    peak_hour_row = (
        db.query(extract('hour', Message.created_at).label('hr'), func.count(Message.id).label('cnt'))
        .select_from(Message)
        .join(Conversation, Message.conversation_id == Conversation.id)
        .filter(Conversation.user_id == user_id)
        .filter(Message.created_at >= start_date)
        .group_by('hr')
        .order_by(desc('cnt'))
        .first()
    )
    peak_usage_hour = f"{int(peak_hour_row.hr):02d}:00" if peak_hour_row else "N/A"
    
    return {
        "total_messages": total_messages,
        "total_tokens": total_tokens,
        "prompt_tokens": prompt_tokens,
        "completion_tokens": completion_tokens,
        "estimated_cost": estimated_cost,
        "total_conversations": total_conversations,
        "total_rag_usage": total_rag_usage,
        "avg_response_time": avg_response_time,
        "most_used_agent": most_used_agent,
        "peak_usage_hour": peak_usage_hour
    }

def get_daily_analytics(db: Session, user_id: int, days: int = 30):
    start_date = datetime.utcnow() - timedelta(days=days)
    
    # Using cross-platform approach: cast to Date
    from sqlalchemy.types import Date
    
    daily_stats = (
        db.query(
            func.cast(Message.created_at, Date).label("date"),
            func.count(Message.id).label("messages_count"),
            func.sum(Message.total_tokens).label("tokens_used")
        )
        .select_from(Message)
        .join(Conversation, Message.conversation_id == Conversation.id)
        .filter(Conversation.user_id == user_id)
        .filter(Message.created_at >= start_date)
        .group_by(func.cast(Message.created_at, Date))
        .order_by(func.cast(Message.created_at, Date))
        .all()
    )
    
    return [
        {
            "date": stat.date.isoformat() if hasattr(stat.date, "isoformat") else str(stat.date),
            "messages_count": stat.messages_count,
            "tokens_used": int(stat.tokens_used) if stat.tokens_used else 0
        }
        for stat in daily_stats
    ]

def get_agent_analytics(db: Session, user_id: int, days: int = 30):
    start_date = datetime.utcnow() - timedelta(days=days)

    agent_stats = (
        db.query(
            Agent.name.label("agent_name"),
            func.count(Message.id).label("usage_count"),
            func.sum(Message.total_tokens).label("total_tokens")
        )
        .select_from(Message)
        .join(Conversation, Message.conversation_id == Conversation.id)
        .join(Agent, Message.agent_id == Agent.id)
        .filter(Conversation.user_id == user_id)
        .filter(Message.role == "model")
        .filter(Message.created_at >= start_date)
        .group_by(Agent.name)
        .order_by(desc("usage_count"))
        .all()
    )
    
    total_model_messages = sum(stat.usage_count for stat in agent_stats)
    
    return [
        {
            "agent_name": stat.agent_name,
            "usage_count": stat.usage_count,
            "total_tokens": stat.total_tokens or 0,
            "usage_percentage": round((stat.usage_count / total_model_messages * 100), 1) if total_model_messages else 0
        }
        for stat in agent_stats
    ]
