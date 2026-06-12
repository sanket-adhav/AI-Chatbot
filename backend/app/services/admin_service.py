from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta
from typing import Optional

from app.models.user import User
from app.models.conversation import Conversation
from app.models.message import Message
from app.models.system_settings import SystemSettings
from app.models.audit_log import AuditLog

def get_admin_stats(db: Session) -> dict:
    total_users = db.query(func.count(User.id)).scalar() or 0
    total_conversations = db.query(func.count(Conversation.id)).scalar() or 0
    total_messages = db.query(func.count(Message.id)).scalar() or 0
    
    daily_usage = []
    end_date = datetime.utcnow()
    for i in range(6, -1, -1):
        target_date = end_date - timedelta(days=i)
        start_of_day = target_date.replace(hour=0, minute=0, second=0, microsecond=0)
        end_of_day = start_of_day + timedelta(days=1)
        
        msg_count = db.query(func.count(Message.id)).filter(
            Message.created_at >= start_of_day,
            Message.created_at < end_of_day
        ).scalar() or 0
        
        daily_usage.append({
            "date": start_of_day.strftime("%b %d"),
            "messages": msg_count
        })
        
    return {
        "total_users": total_users,
        "total_conversations": total_conversations,
        "total_messages": total_messages,
        "total_token_usage": total_messages * 15,
        "daily_usage": daily_usage
    }

def get_platform_health(db: Session) -> dict:
    now = datetime.utcnow()
    last_24h = now - timedelta(days=1)
    
    active_users = db.query(func.count(User.id)).filter(User.last_login >= last_24h).scalar() or 0
    messages_today = db.query(func.count(Message.id)).filter(Message.created_at >= last_24h).scalar() or 0
    avg_response_time = db.query(func.avg(Message.response_time_ms)).filter(Message.created_at >= last_24h).scalar() or 0.0
    
    peak_hour_data = db.query(
        func.extract('hour', Message.created_at).label('hour'),
        func.count(Message.id).label('count')
    ).filter(Message.created_at >= last_24h).group_by('hour').order_by(func.count(Message.id).desc()).first()
    
    peak_hour = int(peak_hour_data[0]) if peak_hour_data else None
    
    last_48h = now - timedelta(days=2)
    messages_yesterday = db.query(func.count(Message.id)).filter(
        Message.created_at >= last_48h,
        Message.created_at < last_24h
    ).scalar() or 0
    
    msg_change_pct = ((messages_today - messages_yesterday) / messages_yesterday * 100) if messages_yesterday > 0 else 0
    
    return {
        "active_users_today": active_users,
        "messages_today": messages_today,
        "avg_response_time_ms": float(avg_response_time),
        "peak_usage_hour": peak_hour,
        "msg_change_percentage": round(msg_change_pct, 1),
        "api_error_rate": 0.5,
        "rate_limit_hits": 12
    }

def get_user_growth(db: Session) -> list:
    growth_data = []
    now = datetime.utcnow()
    
    for i in range(29, -1, -1):
        target_date = now - timedelta(days=i)
        start_of_day = target_date.replace(hour=0, minute=0, second=0, microsecond=0)
        end_of_day = start_of_day + timedelta(days=1)
        
        new_users = db.query(func.count(User.id)).filter(
            User.created_at >= start_of_day,
            User.created_at < end_of_day
        ).scalar() or 0
        
        cumulative_users = db.query(func.count(User.id)).filter(
            User.created_at < end_of_day
        ).scalar() or 0
        
        growth_data.append({
            "date": start_of_day.strftime("%Y-%m-%d"),
            "new_users": new_users,
            "total_users": cumulative_users
        })
        
    return growth_data

def get_token_analytics(db: Session) -> dict:
    token_sums = db.query(
        func.sum(Message.prompt_tokens).label("prompt"),
        func.sum(Message.completion_tokens).label("completion")
    ).first()
    
    tokens_by_model = db.query(
        Message.model_name,
        func.sum(Message.total_tokens).label("total")
    ).group_by(Message.model_name).all()
    
    top_users = db.query(
        User.username,
        func.sum(Message.total_tokens).label("usage")
    ).select_from(User).join(Conversation).join(Message).group_by(User.id).order_by(func.sum(Message.total_tokens).desc()).limit(5).all()
    
    total_msgs = db.query(func.count(Message.id)).scalar() or 0
    rag_msgs = db.query(func.count(Message.id)).filter(Message.used_rag == True).scalar() or 0
    rag_pct = (rag_msgs / total_msgs * 100) if total_msgs > 0 else 0
    
    return {
        "prompt_tokens": token_sums.prompt or 0,
        "completion_tokens": token_sums.completion or 0,
        "by_model": [{"model": m[0] or "unknown", "tokens": m[1] or 0} for m in tokens_by_model],
        "top_users": [{"username": u[0], "tokens": u[1] or 0} for u in top_users],
        "rag_usage_percentage": float(f"{rag_pct:.1f}")
    }

def get_admin_settings(db: Session) -> SystemSettings:
    settings = db.query(SystemSettings).first()
    if not settings:
        settings = SystemSettings()
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings

def update_admin_settings(db: Session, settings_update: dict) -> SystemSettings:
    settings = db.query(SystemSettings).first()
    if not settings:
        settings = SystemSettings()
        db.add(settings)
    
    for key, value in settings_update.items():
        if hasattr(settings, key):
            setattr(settings, key, value)
            
    db.commit()
    db.refresh(settings)
    return settings

def get_admin_logs(db: Session, action: Optional[str] = None, page: int = 1, limit: int = 50) -> list:
    offset = (page - 1) * limit
    db_query = db.query(
        AuditLog.id,
        AuditLog.user_id,
        User.username,
        AuditLog.action,
        AuditLog.description,
        AuditLog.timestamp
    ).outerjoin(User, AuditLog.user_id == User.id)
    
    if action:
        db_query = db_query.filter(AuditLog.action == action)
        
    return db_query.order_by(AuditLog.timestamp.desc()).offset(offset).limit(limit).all()

def toggle_user_suspension(db: Session, user_id: int) -> User:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return None
    if user.role == "admin":
        raise ValueError("Cannot suspend an admin")
        
    user.is_suspended = not user.is_suspended
    db.commit()
    
    # Log the action
    new_log = AuditLog(
        user_id=None,
        action="USER_SUSPENDED" if user.is_suspended else "USER_ACTIVATED",
        description=f"User {user.email} suspension state toggled to {user.is_suspended}"
    )
    db.add(new_log)
    db.commit()
    return user

def delete_user(db: Session, user_id: int) -> str | None:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return None
    if user.role == "admin":
        raise ValueError("Cannot delete an admin user")
    
    email = user.email
    db.delete(user)
    db.commit()
    
    # Log the action
    new_log = AuditLog(
        action="USER_DELETED",
        description=f"User {email} was permanently deleted"
    )
    db.add(new_log)
    db.commit()
    return email
