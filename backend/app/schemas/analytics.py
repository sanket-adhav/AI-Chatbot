from datetime import datetime
from pydantic import BaseModel, ConfigDict
from typing import Optional

class AuditLogOut(BaseModel):
    id: int
    user_id: Optional[int]
    username: Optional[str] = None
    action: str
    description: str
    timestamp: datetime

    model_config = ConfigDict(from_attributes=True)
