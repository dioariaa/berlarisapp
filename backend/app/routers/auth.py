from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..audit import write_audit_log
from ..database import get_db
from ..models import User
from ..schemas import LoginRequest, LoginResponse, UserRead
from ..security import create_access_token, get_current_user, verify_password

router = APIRouter(prefix="/auth", tags=["authentication"])


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest, request: Request, db: Session = Depends(get_db)) -> LoginResponse:
    email = payload.email.lower()
    user = db.scalar(select(User).where(User.email == email))
    if not user or not verify_password(payload.password, user.password_hash):
        write_audit_log(
            db,
            request,
            action="LOGIN_FAILED",
            entity_type="AUTH",
            entity_id=user.id if user else None,
            user=user,
            actor_name=user.name if user else "Unknown",
            actor_email=email,
            new_values={"reason": "invalid_credentials"},
        )
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "INVALID_CREDENTIALS", "message": "Email atau password tidak valid."},
        )
    if not user.is_active:
        write_audit_log(
            db,
            request,
            action="LOGIN_FAILED",
            entity_type="AUTH",
            entity_id=user.id,
            user=user,
            new_values={"reason": "inactive_user"},
        )
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "USER_INACTIVE", "message": "Akun tidak aktif."},
        )

    user.last_login_at = datetime.now(timezone.utc)
    write_audit_log(
        db,
        request,
        action="LOGIN_SUCCESS",
        entity_type="AUTH",
        entity_id=user.id,
        user=user,
    )
    db.commit()
    db.refresh(user)
    token, expires_in = create_access_token(user)
    return LoginResponse(access_token=token, expires_in=expires_in, user=user)


@router.get("/me", response_model=UserRead)
def me(user: User = Depends(get_current_user)) -> User:
    return user


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    write_audit_log(
        db,
        request,
        action="LOGOUT",
        entity_type="AUTH",
        entity_id=user.id,
        user=user,
    )
    db.commit()
