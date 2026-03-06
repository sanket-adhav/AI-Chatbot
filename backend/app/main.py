from fastapi import FastAPI, Request, status, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.core.config import settings
from app.core.rate_limit import limiter
from app.core.errors import not_found_handler, general_exception_handler
from app.db.database import engine, SessionLocal
from app.db.database import Base

# Import all models so Base knows about them before create_all
import app.models  # noqa: F401

from app.api import agents, conversations, messages, health
from app.api import auth as auth_router
from app.api import search as search_router
from app.api import export as export_router
from app.api import uploads as uploads_router
from app.api import stream as stream_router
from app.api import documents as documents_router
from app.api import analytics as analytics_router
from app.api import admin as admin_router
from app.services.agent_service import seed_agents
from app.models.user import User
from app.models.system_settings import SystemSettings
from app.services.auth_service import hash_password


def create_app() -> FastAPI:
    app = FastAPI(
        title="AI Chatbot Platform",
        description="Production-ready multi-agent AI chatbot with Gemini integration",
        version="1.0.0",
        docs_url="/api/docs",
        redoc_url="/api/redoc",
    )

    # ── CORS ──────────────────────────────────────────────────────────────────
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ── Rate Limiting ─────────────────────────────────────────────────────────
    app.state.limiter = limiter
    app.add_middleware(SlowAPIMiddleware)
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

    # ── Error Handlers ────────────────────────────────────────────────────────
    app.add_exception_handler(Exception, general_exception_handler)

    # ── Routers ───────────────────────────────────────────────────────────────
    app.include_router(health.router)
    app.include_router(auth_router.router)
    app.include_router(agents.router)
    from app.api import folders
    app.include_router(folders.router)
    app.include_router(conversations.router)
    app.include_router(messages.router)
    app.include_router(search_router.router)
    app.include_router(export_router.router)
    app.include_router(uploads_router.router)
    app.include_router(stream_router.router)
    app.include_router(documents_router.router)
    app.include_router(analytics_router.router)
    app.include_router(admin_router.router)

    # Maintenance Mode Middleware
    @app.middleware("http")
    async def maintenance_middleware(request: Request, call_next):
        # Exclude admin routes from maintenance mode so we can turn it off!
        if request.url.path.startswith("/admin") or request.url.path.startswith("/api/admin"):
            return await call_next(request)
            
        db = SessionLocal()
        try:
            system_settings = db.query(SystemSettings).first()
            if system_settings and system_settings.maintenance_mode:
                return JSONResponse(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    content={"detail": "System is currently under maintenance. Please try again later."}
                )
        finally:
            db.close()
            
        return await call_next(request)

    # Serve uploaded images
    from pathlib import Path
    uploads_path = Path(__file__).parent.parent / "uploads"
    uploads_path.mkdir(exist_ok=True)
    app.mount("/uploads", StaticFiles(directory=str(uploads_path)), name="uploads")

    # ── Startup ───────────────────────────────────────────────────────────────
    @app.on_event("startup")
    def startup():
        Base.metadata.create_all(bind=engine)
        db = SessionLocal()
        try:
            seed_agents(db)

            # Admin auto-creation
            if settings.admin_email and settings.admin_password and settings.admin_username:
                admin_user = db.query(User).filter(User.email == settings.admin_email).first()
                if not admin_user:
                    print(f"Creating hidden admin user: {settings.admin_email}")
                    new_admin = User(
                        username=settings.admin_username,
                        email=settings.admin_email,
                        hashed_password=hash_password(settings.admin_password),
                        role="admin"
                    )
                    db.add(new_admin)
                    db.commit()

            # System Settings initialization
            settings_exists = db.query(SystemSettings).first()
            if not settings_exists:
                print("Initializing global system settings...")
                default_settings = SystemSettings()
                db.add(default_settings)
                db.commit()

        finally:
            db.close()

    return app


app = create_app()
