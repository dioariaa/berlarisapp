from datetime import date, datetime
from enum import Enum
from typing import Any

from fastapi import Request
from sqlalchemy.orm import Session

from .models import AuditLog, User


def serialize_value(value: Any) -> Any:
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    if isinstance(value, Enum):
        return value.value
    if isinstance(value, dict):
        return {key: serialize_value(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [serialize_value(item) for item in value]
    return str(value)


def model_snapshot(instance: Any, fields: list[str]) -> dict:
    return {field: serialize_value(getattr(instance, field)) for field in fields}


def write_audit_log(
    db: Session,
    request: Request,
    action: str,
    entity_type: str,
    entity_id: int | str | None,
    user: User | None = None,
    old_values: dict | None = None,
    new_values: dict | None = None,
    actor_name: str | None = None,
    actor_email: str | None = None,
) -> AuditLog:
    forwarded_for = request.headers.get("x-forwarded-for")
    ip_address = forwarded_for.split(",")[0].strip() if forwarded_for else (
        request.client.host if request.client else None
    )
    log = AuditLog(
        user_id=user.id if user else None,
        user_name=user.name if user else (actor_name or "Unknown"),
        user_email=user.email if user else (actor_email or "unknown"),
        action=action,
        entity_type=entity_type,
        entity_id=str(entity_id) if entity_id is not None else None,
        old_values=serialize_value(old_values),
        new_values=serialize_value(new_values),
        ip_address=ip_address,
        user_agent=request.headers.get("user-agent"),
    )
    db.add(log)
    return log
