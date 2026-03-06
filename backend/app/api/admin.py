from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta
from typing import List, Optional

from app.db.database import get_db
from app.core.security import get_current_admin_user
from app.models.user import User
from app.models.conversation import Conversation
from app.models.message import Message
from app.models.system_settings import SystemSettings
from app.models.audit_log import AuditLog
from app.schemas.schemas import AdminUserListItem, UserStats, AuditLogOut

router = APIRouter(prefix="/admin", tags=["Admin"])
# All endpoints require admin privileges
router.dependencies = [Depends(get_current_admin_user)]

@router.get("/stats")
def get_admin_stats(db: Session = Depends(get_db)):
    total_users = db.query(func.count(User.id)).scalar() or 0
    total_conversations = db.query(func.count(Conversation.id)).scalar() or 0
    total_messages = db.query(func.count(Message.id)).scalar() or 0
    
    # Generate daily usage graph data for the past 7 days
    daily_usage = []
    end_date = datetime.utcnow()
    for i in range(6, -1, -1):
        target_date = end_date - timedelta(days=i)
        start_of_day = target_date.replace(hour=0, minute=0, second=0, microsecond=0)
        end_of_day = start_of_day + timedelta(days=1)
        
        # Count messages for the day
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
        "total_token_usage": total_messages * 15, # Mock token usage for now
        "daily_usage": daily_usage
    }

@router.get("/platform-health")
def get_platform_health(db: Session = Depends(get_db)):
    now = datetime.utcnow()
    last_24h = now - timedelta(days=1)
    
    # Active Users Today
    active_users = db.query(func.count(User.id)).filter(User.last_login >= last_24h).scalar() or 0
    
    # Messages Today
    messages_today = db.query(func.count(Message.id)).filter(Message.created_at >= last_24h).scalar() or 0
    
    # Avg Global Response Time
    avg_response_time = db.query(func.avg(Message.response_time_ms)).filter(Message.created_at >= last_24h).scalar() or 0.0
    
    # Peak Usage Hour (last 24h)
    # This is a bit complex for simple SQL, we can approximate by grouping by hour
    peak_hour_data = db.query(
        func.extract('hour', Message.created_at).label('hour'),
        func.count(Message.id).label('count')
    ).filter(Message.created_at >= last_24h).group_by('hour').order_by(func.count(Message.id).desc()).first()
    
    peak_hour = int(peak_hour_data[0]) if peak_hour_data else None
    
    # Comparison with yesterday
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
        "api_error_rate": 0.5, # Mock: would need an ErrorLog table or similar
        "rate_limit_hits": 12 # Mock
    }

@router.get("/user-growth")
def get_user_growth(db: Session = Depends(get_db)):
    # Last 30 days growth
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

@router.get("/token-analytics")
def get_token_analytics(db: Session = Depends(get_db)):
    # Total Prompt & Completion Tokens
    token_sums = db.query(
        func.sum(Message.prompt_tokens).label("prompt"),
        func.sum(Message.completion_tokens).label("completion")
    ).first()
    
    # Tokens by Model
    tokens_by_model = db.query(
        Message.model_name,
        func.sum(Message.total_tokens).label("total")
    ).group_by(Message.model_name).all()
    
    # Top 5 Heavy Users
    top_users = db.query(
        User.username,
        func.sum(Message.total_tokens).label("usage")
    ).select_from(User).join(Conversation).join(Message).group_by(User.id).order_by(func.sum(Message.total_tokens).desc()).limit(5).all()
    
    # RAG Usage %
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

@router.get("/settings")
def get_admin_settings(db: Session = Depends(get_db)):
    settings = db.query(SystemSettings).first()
    if not settings:
        settings = SystemSettings()
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings

@router.patch("/settings")
def update_admin_settings(settings_update: dict, db: Session = Depends(get_db)):
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

@router.get("/logs", response_model=List[AuditLogOut])
def get_admin_logs(
    action: Optional[str] = None,
    page: int = 1,
    limit: int = 50,
    db: Session = Depends(get_db)
):
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
        
    logs = db_query.order_by(AuditLog.timestamp.desc()).offset(offset).limit(limit).all()
    
    # Map to AuditLogOut
    return [
       {
           "id": row[0],
           "user_id": row[1],
           "username": row[2] or "System",
           "action": row[3],
           "description": row[4],
           "timestamp": row[5]
       } for row in logs
    ]

@router.get("/export/users")
def export_users_csv(db: Session = Depends(get_db)):
    import csv
    import io
    
    users = db.query(User).all()
    
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["ID", "Username", "Email", "Role", "Created At", "Last Login", "Is Suspended"])
    
    for u in users:
        writer.writerow([
            u.id, 
            u.username, 
            u.email, 
            u.role, 
            u.created_at.strftime("%Y-%m-%d %H:%M:%S") if u.created_at else "",
            u.last_login.strftime("%Y-%m-%d %H:%M:%S") if u.last_login else "Never",
            u.is_suspended
        ])
    
    response = Response(content=output.getvalue(), media_type="text/csv")
    response.headers["Content-Disposition"] = f"attachment; filename=users_export_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.csv"
    return response

@router.get("/export/token-analytics")
def export_token_analytics_csv(db: Session = Depends(get_db)):
    import csv
    import io
    
    tokens_by_model = db.query(
        Message.model_name,
        func.sum(Message.prompt_tokens),
        func.sum(Message.completion_tokens),
        func.sum(Message.total_tokens)
    ).group_by(Message.model_name).all()
    
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Model Name", "Prompt Tokens", "Completion Tokens", "Total Tokens"])
    
    for m in tokens_by_model:
        writer.writerow([m[0] or "unknown", m[1] or 0, m[2] or 0, m[3] or 0])
    
    response = Response(content=output.getvalue(), media_type="text/csv")
    response.headers["Content-Disposition"] = f"attachment; filename=token_analytics_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.csv"
    return response

@router.get("/users", response_model=List[AdminUserListItem])
def get_admin_users(
    query: Optional[str] = None,
    status: Optional[str] = None, # "all", "active", "suspended", "new"
    page: int = 1,
    limit: int = 20,
    db: Session = Depends(get_db)
):
    offset = (page - 1) * limit
    db_query = db.query(User)
    
    if query:
        db_query = db_query.filter(
            (User.username.ilike(f"%{query}%")) | (User.email.ilike(f"%{query}%"))
        )
    
    if status == "suspended":
        db_query = db_query.filter(User.is_suspended == True)
    elif status == "active":
        db_query = db_query.filter(User.is_suspended == False)
    elif status == "new":
        week_ago = datetime.utcnow() - timedelta(days=7)
        db_query = db_query.filter(User.created_at >= week_ago)
        
    users = db_query.order_by(User.created_at.desc()).offset(offset).limit(limit).all()
    
    # Enrich with counts
    results = []
    for u in users:
        msg_data = db.query(
            func.count(Message.id),
            func.sum(Message.total_tokens)
        ).select_from(Conversation).join(Message).filter(Conversation.user_id == u.id).first()
        
        results.append({
            "id": u.id,
            "username": u.username,
            "email": u.email,
            "role": u.role,
            "created_at": u.created_at,
            "last_login": u.last_login,
            "is_suspended": u.is_suspended,
            "total_messages": msg_data[0] or 0,
            "total_tokens": msg_data[1] or 0
        })
        
    return results

@router.get("/users/{user_id}/stats", response_model=UserStats)
def get_user_detailed_stats(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    conv_count = db.query(func.count(Conversation.id)).filter(Conversation.user_id == user_id).scalar() or 0
    
    msg_stats = db.query(
        func.count(Message.id),
        func.sum(Message.prompt_tokens),
        func.sum(Message.completion_tokens),
        func.avg(Message.response_time_ms)
    ).select_from(Conversation).join(Message).filter(Conversation.user_id == user_id).first()
    
    return {
        "user_id": user_id,
        "joined_date": user.created_at,
        "total_conversations": conv_count,
        "total_messages": msg_stats[0] or 0,
        "prompt_tokens": msg_stats[1] or 0,
        "completion_tokens": msg_stats[2] or 0,
        "avg_response_time_ms": float(msg_stats[3]) if msg_stats[3] else 0.0
    }

@router.patch("/users/{user_id}/suspend")
def toggle_user_suspension(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.role == "admin":
        raise HTTPException(status_code=403, detail="Cannot suspend an admin")
        
    user.is_suspended = not user.is_suspended
    db.commit()
    
    # Log the action
    from app.models.audit_log import AuditLog
    new_log = AuditLog(
        user_id=None, # Should be current admin id if available, but for now None is okay or user_id for subject
        action="USER_SUSPENDED" if user.is_suspended else "USER_ACTIVATED",
        description=f"User {user.email} suspension state toggled to {user.is_suspended}"
    )
    db.add(new_log)
    db.commit()
    
    return {"status": "success", "is_suspended": user.is_suspended}

@router.delete("/users/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.role == "admin":
        raise HTTPException(status_code=403, detail="Cannot delete an admin user")
    
    email = user.email
    db.delete(user)
    db.commit()
    
    # Log the action
    from app.models.audit_log import AuditLog
    new_log = AuditLog(
        action="USER_DELETED",
        description=f"User {email} was permanently deleted"
    )
    db.add(new_log)
    db.commit()
    
    return {"status": "success"}

@router.patch("/users/{user_id}/status")
def block_unblock_user_legacy(user_id: int, action: str, db: Session = Depends(get_db)):
    # Redirect to suspend logic for compatibility
    return toggle_user_suspension(user_id, db)
