from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.core.rate_limit import limiter
from app.schemas.schemas import AgentOut, AgentCreate
from app.services.agent_service import get_all_agents, get_agent_by_id, delete_agent
from app.api.auth import get_current_user
from app.models.user import User
from app.models.agent import Agent
from fastapi import HTTPException

router = APIRouter(prefix="/agents", tags=["Agents"])


@router.get("", response_model=list[AgentOut])
@limiter.limit("30/minute")
def list_agents(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return get_all_agents(db, current_user.id)


@router.post("", response_model=AgentOut, status_code=status.HTTP_201_CREATED)
@limiter.limit("10/minute")
def create_agent(
    request: Request,
    agent_in: AgentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Check if agent name already exists for this user or globally
    existing = db.query(Agent).filter(Agent.name == agent_in.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="An agent with this name already exists")
        
    new_agent = Agent(
        name=agent_in.name,
        description=agent_in.description,
        instruction_template=agent_in.instruction_template,
        avatar_icon=agent_in.avatar_icon,
        user_id=current_user.id,
        is_public=False
    )
    db.add(new_agent)
    db.commit()
    db.refresh(new_agent)
    return new_agent


@router.get("/{agent_id}", response_model=AgentOut)
@limiter.limit("30/minute")
def get_agent(request: Request, agent_id: int, db: Session = Depends(get_db)):
    agent = get_agent_by_id(db, agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail=f"Agent {agent_id} not found.")
    return agent


@router.delete("/{agent_id}", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("10/minute")
def remove_agent(
    request: Request,
    agent_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    success = delete_agent(db, agent_id, current_user.id)
    if not success:
        raise HTTPException(status_code=404, detail="Agent not found or not owned by you")
    return None
