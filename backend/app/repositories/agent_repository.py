from sqlalchemy.orm import Session
from app.models.agent import Agent

class AgentRepository:
    @staticmethod
    def get_by_id(db: Session, agent_id: int) -> Agent | None:
        return db.query(Agent).filter(Agent.id == agent_id).first()

    @staticmethod
    def get_by_name(db: Session, name: str) -> Agent | None:
        return db.query(Agent).filter(Agent.name == name).first()

    @staticmethod
    def get_all(db: Session) -> list[Agent]:
        return db.query(Agent).all()

    @staticmethod
    def get_user_agents(db: Session, user_id: int) -> list[Agent]:
        return db.query(Agent).filter((Agent.user_id == user_id) | (Agent.is_public == True)).all()

    @staticmethod
    def create(db: Session, agent: Agent) -> Agent:
        db.add(agent)
        db.commit()
        db.refresh(agent)
        return agent

    @staticmethod
    def delete(db: Session, agent: Agent) -> None:
        db.delete(agent)
        db.commit()
