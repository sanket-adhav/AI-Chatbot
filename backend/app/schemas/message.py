from datetime import datetime
from pydantic import BaseModel, Field
from typing import Optional, List

class MessageCreate(BaseModel):
    content: str = Field(..., min_length=1, max_length=32000)
    use_documents: bool = False
    model_name: Optional[str] = None


class MessageOut(BaseModel):
    id: int
    conversation_id: int
    role: str
    content: str
    image_url: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ChatResponse(BaseModel):
    user_message: MessageOut
    assistant_message: MessageOut


class MessageSearchResult(BaseModel):
    message_id: int
    conversation_id: int
    conv_title: str
    role: str
    content: str
    created_at: datetime

    model_config = {"from_attributes": True}


class SearchResponse(BaseModel):
    results: List[MessageSearchResult]
    total: int
    page: int
    page_size: int
    query: str
