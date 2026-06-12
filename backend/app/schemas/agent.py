from datetime import datetime
from pydantic import BaseModel, Field
from typing import Optional

class AgentCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: str = Field(default="", max_length=255)
    instruction_template: str = Field(..., min_length=1)
    avatar_icon: str = Field(default="🤖", max_length=50)


class AgentOut(BaseModel):
    id: int
    name: str
    description: str
    instruction_template: str
    user_id: Optional[int] = None
    is_public: bool
    avatar_icon: str
    created_at: datetime

    model_config = {"from_attributes": True}
