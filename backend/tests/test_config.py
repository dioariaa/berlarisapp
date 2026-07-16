import pytest

from app.config import Settings


def test_normalizes_supabase_postgres_url():
    settings = Settings(
        environment="production",
        database_url="postgresql://user:password@db.example.supabase.co:5432/postgres?sslmode=require",
    )
    settings.validate_runtime()
    assert settings.database_url.startswith("postgresql+psycopg://")


def test_rejects_sqlite_outside_test_environment():
    settings = Settings(environment="production", database_url="sqlite+pysqlite:///local.db")
    with pytest.raises(ValueError, match="SQLite hanya diizinkan"):
        settings.validate_runtime()
