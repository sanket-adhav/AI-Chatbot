from datetime import datetime
from pydantic import BaseModel, Field, EmailStr, ConfigDict
from typing import Optional, List


# ── Agent ──────────────────────────────────────────────────────────────────────

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


# ── Folders ────────────────────────────────────────────────────────────────────

class FolderCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)

class FolderOut(BaseModel):
    id: int
    name: str
    user_id: int
    created_at: datetime

    model_config = {"from_attributes": True}

# ── Conversation ───────────────────────────────────────────────────────────────

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


# ── Message ────────────────────────────────────────────────────────────────────

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


# ── Search ─────────────────────────────────────────────────────────────────────

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


# ── Auth ───────────────────────────────────────────────────────────────────────

class UserRegister(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: str = Field(..., max_length=255)
    password: str = Field(..., min_length=6, max_length=128)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


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


# ── Admin ──────────────────────────────────────────────────────────────────────
class AuditLogOut(BaseModel):
    id: int
    user_id: Optional[int]
    username: Optional[str] = None
    action: str
    description: str
    timestamp: datetime

    model_config = ConfigDict(from_attributes=True)


# ── Documents ──────────────────────────────────────────────────────────────────

class DocumentResponse(BaseModel):
    id: int
    user_id: int
    filename: str
    file_path: str
    status: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
