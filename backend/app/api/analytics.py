from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.services.analytics_service import (
    get_analytics_summary,
    get_daily_analytics,
    get_agent_analytics
)

router = APIRouter(prefix="/analytics", tags=["Analytics"])

@router.get("/summary")
def analytics_summary(
    days: int = 30,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get aggregated summary metrics for the dashboard top cards."""
    return get_analytics_summary(db, current_user.id, days=days)

@router.get("/daily")
def analytics_daily(
    days: int = 30,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get daily message and token counts for the line/area charts."""
    return get_daily_analytics(db, current_user.id, days=days)

@router.get("/agents")
def analytics_agents(
    days: int = 30,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get usage counts per agent for the bar chart."""
    return get_agent_analytics(db, current_user.id, days=days)
