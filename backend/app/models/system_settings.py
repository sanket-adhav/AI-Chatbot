from datetime import datetime
from sqlalchemy import Integer, String, Boolean, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column
from app.db.database import Base


class SystemSettings(Base):
    __tablename__ = "system_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    default_model: Mapped[str] = mapped_column(String(100), default="gemini-2.5-flash")
    rag_enabled_globally: Mapped[bool] = mapped_column(Boolean, default=True)
    daily_token_limit_per_user: Mapped[int] = mapped_column(Integer, default=100000)
    max_message_length: Mapped[int] = mapped_column(Integer, default=4000)
    maintenance_mode: Mapped[bool] = mapped_column(Boolean, default=False)
    max_conversations_per_user: Mapped[int] = mapped_column(Integer, default=50)
    
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())
