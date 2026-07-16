import os

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

os.environ["ENVIRONMENT"] = "test"
os.environ["DATABASE_URL"] = "sqlite+pysqlite:///:memory:"
os.environ["JWT_SECRET_KEY"] = "test-secret-key-that-is-long-enough-for-jwt-security"
os.environ["JWT_ALGORITHM"] = "HS256"
os.environ["ACCESS_TOKEN_EXPIRE_MINUTES"] = "60"
os.environ["TRUSTED_HOSTS"] = "testserver,localhost,127.0.0.1"
os.environ["CORS_ORIGINS"] = "http://testserver"
os.environ["FRONTEND_URL"] = "http://testserver"
os.environ["BACKEND_URL"] = "http://testserver"
os.environ["FORCE_HTTPS"] = "false"

from app.database import Base, get_db
from app.main import app
from app.models import User, UserRole
from app.security import create_access_token, hash_password


@pytest.fixture()
def auth_context():
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    testing_session = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    Base.metadata.create_all(engine)
    with testing_session() as db:
        superadmin = User(
            name="Super Admin",
            email="superadmin@example.com",
            password_hash=hash_password("StrongPassword123!"),
            role=UserRole.SUPERADMIN,
            is_active=True,
        )
        admin = User(
            name="Admin HR",
            email="admin@example.com",
            password_hash=hash_password("StrongPassword123!"),
            role=UserRole.ADMIN,
            is_active=True,
        )
        db.add_all([superadmin, admin])
        db.commit()
        db.refresh(superadmin)
        db.refresh(admin)
        super_token, _ = create_access_token(superadmin)
        admin_token, _ = create_access_token(admin)

    def override_get_db():
        db = testing_session()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield {
            "client": test_client,
            "superadmin_headers": {"Authorization": f"Bearer {super_token}"},
            "admin_headers": {"Authorization": f"Bearer {admin_token}"},
        }
    app.dependency_overrides.clear()
    Base.metadata.drop_all(engine)


@pytest.fixture()
def client(auth_context) -> TestClient:
    return auth_context["client"]


@pytest.fixture()
def superadmin_headers(auth_context) -> dict[str, str]:
    return auth_context["superadmin_headers"]


@pytest.fixture()
def admin_headers(auth_context) -> dict[str, str]:
    return auth_context["admin_headers"]
