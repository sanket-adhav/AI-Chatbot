from pydantic_settings import BaseSettings
from pydantic import Field


class Settings(BaseSettings):
    gemini_api_key: str = Field(..., env="GEMINI_API_KEY")
    database_url: str = Field("sqlite:///./chatbot.db", env="DATABASE_URL")
    rate_limit: str = Field("20/minute", env="RATE_LIMIT")
    allowed_origins: str = Field("http://localhost:5173,http://localhost:5174,http://localhost:5175", env="ALLOWED_ORIGINS")
    gemini_model: str = Field("gemini-2.5-flash", env="GEMINI_MODEL")

    # JWT
    jwt_secret: str = Field("change-me-in-production-use-random-32-chars", env="JWT_SECRET")
    jwt_algorithm: str = Field("HS256", env="JWT_ALGORITHM")
    access_token_expire_minutes: int = Field(15, env="ACCESS_TOKEN_EXPIRE_MINUTES")
    refresh_token_expire_days: int = Field(7, env="REFRESH_TOKEN_EXPIRE_DAYS")

    # Admin Account
    admin_email: str | None = Field(None, env="ADMIN_EMAIL")
    admin_password: str | None = Field(None, env="ADMIN_PASSWORD")
    admin_username: str | None = Field(None, env="ADMIN_USERNAME")

    @property
    def origins_list(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",")]

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
