from fastapi import FastAPI, Request, status, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.core.config import settings
from app.core.rate_limit import limiter
from app.core.exceptions import not_found_handler, general_exception_handler
from app.core.database import engine, SessionLocal, Base

# Import all models so Base knows about them before create_all
import app.models  # noqa: F401

from app.api.v1 import auth, agents, chats, documents, analytics, admin, health
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
    app.include_router(auth.router)
    app.include_router(agents.router)
    app.include_router(chats.folders_router)
    app.include_router(chats.router)
    app.include_router(chats.search_router)
    app.include_router(documents.router)
    app.include_router(analytics.router)
    app.include_router(admin.router)

    # Maintenance Mode Middleware
    @app.middleware("http")
    async def maintenance_middleware(request: Request, call_next):
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
    uploads_path = Path(__file__).parent.parent / "data" / "uploads"
    uploads_path.mkdir(exist_ok=True, parents=True)
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
