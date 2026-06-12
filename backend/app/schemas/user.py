from datetime import datetime
from pydantic import BaseModel, Field
from typing import Optional

class UserOut(BaseModel):
    id: int
    username: str
    email: str
    created_at: datetime
    avatar_url: str | None = None
    system_prompt: str | None = None
    theme_preference: str
    role: str
    last_login: Optional[datetime] = None
    is_suspended: bool = False

    model_config = {"from_attributes": True}


class AdminUserListItem(BaseModel):
    id: int
    username: str
    email: str
    role: str
    created_at: datetime
    last_login: Optional[datetime] = None
    is_suspended: bool
    total_messages: int = 0
    total_tokens: int = 0

    model_config = {"from_attributes": True}


class UserStats(BaseModel):
    user_id: int
    joined_date: datetime
    total_conversations: int
    total_messages: int
    prompt_tokens: int
    completion_tokens: int
    avg_response_time_ms: float

    model_config = {"from_attributes": True}


class UserUpdate(BaseModel):
    username: str | None = Field(None, min_length=3, max_length=50)
    password: str | None = Field(None, min_length=6, max_length=128)
    avatar_url: str | None = None
    system_prompt: str | None = None
    theme_preference: str | None = Field(None, max_length=50)
