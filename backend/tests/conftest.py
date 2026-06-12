import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import Base, get_db
from app.main import app
from app.services.auth_service import hash_password
from app.models.user import User
from app.models.system_settings import SystemSettings

# Use an in-memory SQLite database for testing
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(name="db_session", scope="function")
def db_session_fixture():
    # Create tables
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    
    # Initialize default system settings
    default_settings = SystemSettings()
    db.add(default_settings)
    db.commit()
    
    try:
        yield db
    finally:
        db.close()
        # Drop tables
        Base.metadata.drop_all(bind=engine)

@pytest.fixture(name="client", scope="function")
def client_fixture(db_session):
    from app.core.rate_limit import limiter
    limiter.enabled = False
    
    def override_get_db():
        try:
            yield db_session
        finally:
            pass
            
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()

@pytest.fixture(name="test_user", scope="function")
def test_user_fixture(db_session):
    user = User(
        username="testuser",
        email="testuser@example.com",
        hashed_password=hash_password("password123"),
        role="user"
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user

@pytest.fixture(name="test_admin", scope="function")
def test_admin_fixture(db_session):
    admin = User(
        username="testadmin",
        email="testadmin@example.com",
        hashed_password=hash_password("adminpass123"),
        role="admin"
    )
    db_session.add(admin)
    db_session.commit()
    db_session.refresh(admin)
    return admin

@pytest.fixture(name="user_token", scope="function")
def user_token_fixture(client, test_user):
    response = client.post(
        "/auth/login",
        json={"email": test_user.email, "password": "password123"}
    )
    assert response.status_code == 200
    return response.json()["access_token"]

@pytest.fixture(name="admin_token", scope="function")
def admin_token_fixture(client, test_admin):
    response = client.post(
        "/auth/login",
        json={"email": test_admin.email, "password": "adminpass123"}
    )
    assert response.status_code == 200
    return response.json()["access_token"]
