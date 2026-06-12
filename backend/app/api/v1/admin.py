from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session
from typing import List, Optional

from app.core.database import get_db
from app.core.security import get_current_admin_user
from app.models.user import User
from app.schemas import AdminUserListItem, UserStats, AuditLogOut
from app.services import admin_service

router = APIRouter(prefix="/admin", tags=["Admin"])
router.dependencies = [Depends(get_current_admin_user)]


@router.get("/stats")
def get_admin_stats(db: Session = Depends(get_db)):
    return admin_service.get_admin_stats(db)


@router.get("/platform-health")
def get_platform_health(db: Session = Depends(get_db)):
    return admin_service.get_platform_health(db)


@router.get("/user-growth")
def get_user_growth(db: Session = Depends(get_db)):
    return admin_service.get_user_growth(db)


@router.get("/token-analytics")
def get_token_analytics(db: Session = Depends(get_db)):
    return admin_service.get_token_analytics(db)


@router.get("/settings")
def get_admin_settings(db: Session = Depends(get_db)):
    return admin_service.get_admin_settings(db)


@router.patch("/settings")
def update_admin_settings(settings_update: dict, db: Session = Depends(get_db)):
    return admin_service.update_admin_settings(db, settings_update)


@router.get("/logs", response_model=List[AuditLogOut])
def get_admin_logs(
    action: Optional[str] = None,
    page: int = 1,
    limit: int = 50,
    db: Session = Depends(get_db)
):
    logs = admin_service.get_admin_logs(db, action, page, limit)
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
    from datetime import datetime
    
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
    from datetime import datetime
    from sqlalchemy import func
    from app.models.message import Message
    
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
    status: Optional[str] = None,
    page: int = 1,
    limit: int = 20,
    db: Session = Depends(get_db)
):
    from sqlalchemy import func
    from app.models.message import Message
    from app.models.conversation import Conversation
    from datetime import timedelta
    
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
        from datetime import datetime
        week_ago = datetime.utcnow() - timedelta(days=7)
        db_query = db_query.filter(User.created_at >= week_ago)
        
    users = db_query.order_by(User.created_at.desc()).offset(offset).limit(limit).all()
    
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
        
    from sqlalchemy import func
    from app.models.message import Message
    from app.models.conversation import Conversation

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
    try:
        user = admin_service.toggle_user_suspension(db, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        return {"status": "success", "is_suspended": user.is_suspended}
    except ValueError as e:
        raise HTTPException(status_code=403, detail=str(e))


@router.delete("/users/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_db)):
    try:
        email = admin_service.delete_user(db, user_id)
        if not email:
            raise HTTPException(status_code=404, detail="User not found")
        return {"status": "success"}
    except ValueError as e:
        raise HTTPException(status_code=403, detail=str(e))


@router.patch("/users/{user_id}/status")
def block_unblock_user_legacy(user_id: int, action: str, db: Session = Depends(get_db)):
    return toggle_user_suspension(user_id, db)
