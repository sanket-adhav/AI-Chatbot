from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from app.schemas.agent import AgentOut

class FolderCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)


class FolderOut(BaseModel):
    id: int
    name: str
    user_id: int
    created_at: datetime

    model_config = {"from_attributes": True}


class ConversationCreate(BaseModel):
    title: str = Field(default="New Chat", max_length=200)
    agent_id: int


class ConversationUpdate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)


class ConversationOut(BaseModel):
    id: int
    title: str
    agent_id: int
    agent: AgentOut
    folder_id: Optional[int] = None
    is_pinned: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ConversationListItem(BaseModel):
    id: int
    title: str
    agent_id: int
    folder_id: Optional[int] = None
    is_pinned: bool
    updated_at: datetime

    model_config = {"from_attributes": True}
