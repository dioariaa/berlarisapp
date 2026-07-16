from functools import lru_cache

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "BerlarisApp API"
    environment: str = "production"
    database_url: str = Field(min_length=1)
    cors_origins: str = Field(min_length=1)
    debug: bool = False
    database_pool_size: int = Field(default=5, ge=1, le=20)
    database_max_overflow: int = Field(default=10, ge=0, le=40)
    jwt_secret_key: str = Field(min_length=32)
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = Field(default=60, ge=5, le=1440)
    first_superadmin_name: str | None = None
    first_superadmin_email: str | None = None
    first_superadmin_password: str | None = None
    first_superadmin_overwrite_password: bool = False
    frontend_url: str = Field(min_length=1)
    backend_url: str = Field(min_length=1)
    trusted_hosts: str = Field(min_length=1)
    force_https: bool = False

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @field_validator("database_url")
    @classmethod
    def validate_database_url(cls, value: str) -> str:
        normalized = value.strip()
        if normalized.startswith("postgres://"):
            normalized = normalized.replace("postgres://", "postgresql+psycopg://", 1)
        elif normalized.startswith("postgresql://"):
            normalized = normalized.replace("postgresql://", "postgresql+psycopg://", 1)
        if not normalized.startswith(("postgresql+psycopg://", "sqlite")):
            raise ValueError("DATABASE_URL harus berupa URL PostgreSQL Supabase/Neon yang valid.")
        return normalized

    @field_validator("jwt_algorithm")
    @classmethod
    def validate_jwt_algorithm(cls, value: str) -> str:
        if value not in {"HS256", "HS384", "HS512"}:
            raise ValueError("JWT_ALGORITHM harus HS256, HS384, atau HS512.")
        return value

    def validate_runtime(self) -> None:
        if self.environment.lower() != "test" and self.database_url.startswith("sqlite"):
            raise ValueError("SQLite hanya diizinkan saat ENVIRONMENT=test.")

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def trusted_host_list(self) -> list[str]:
        return [host.strip() for host in self.trusted_hosts.split(",") if host.strip()]


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    settings.validate_runtime()
    return settings
