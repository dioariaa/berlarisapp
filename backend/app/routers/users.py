import math

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from ..audit import model_snapshot, write_audit_log
from ..database import get_db
from ..models import User, UserRole
from ..schemas import UserCreate, UserPage, UserRead, UserUpdate
from ..security import hash_password, require_superadmin

router = APIRouter(prefix="/users", tags=["users"])
USER_AUDIT_FIELDS = ["id", "name", "email", "role", "is_active", "last_login_at"]


def ensure_not_last_superadmin(db: Session, user: User, next_role: UserRole, next_active: bool) -> None:
    removes_superadmin_access = (
        user.role == UserRole.SUPERADMIN
        and user.is_active
        and (next_role != UserRole.SUPERADMIN or not next_active)
    )
    if not removes_superadmin_access:
        return
    active_superadmins = db.scalar(
        select(func.count(User.id)).where(
            User.role == UserRole.SUPERADMIN,
            User.is_active.is_(True),
        )
    ) or 0
    if active_superadmins <= 1:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "LAST_SUPERADMIN",
                "message": "Superadmin aktif terakhir tidak dapat dinonaktifkan atau diturunkan rolenya.",
            },
        )


@router.get("", response_model=UserPage)
def list_users(
    search: str | None = Query(default=None, max_length=150),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
    _: User = Depends(require_superadmin),
    db: Session = Depends(get_db),
) -> UserPage:
    statement = select(User)
    count_statement = select(func.count(User.id))
    if search:
        term = f"%{search.strip()}%"
        search_filter = or_(User.name.ilike(term), User.email.ilike(term))
        statement = statement.where(search_filter)
        count_statement = count_statement.where(search_filter)
    total = db.scalar(count_statement) or 0
    items = list(
        db.scalars(
            statement.order_by(User.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        ).all()
    )
    return UserPage(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        pages=math.ceil(total / page_size) if total else 0,
    )


@router.post("", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: UserCreate,
    request: Request,
    current_user: User = Depends(require_superadmin),
    db: Session = Depends(get_db),
) -> User:
    email = payload.email.lower()
    if db.scalar(select(User.id).where(User.email == email)):
        raise HTTPException(
            status_code=409,
            detail={"code": "EMAIL_EXISTS", "message": "Email sudah digunakan."},
        )
    user = User(
        name=payload.name,
        email=email,
        password_hash=hash_password(payload.password),
        role=payload.role,
        is_active=payload.is_active,
    )
    db.add(user)
    db.flush()
    write_audit_log(
        db,
        request,
        "CREATE_USER",
        "USER",
        user.id,
        current_user,
        new_values=model_snapshot(user, USER_AUDIT_FIELDS),
    )
    db.commit()
    db.refresh(user)
    return user


@router.put("/{user_id}", response_model=UserRead)
def update_user(
    user_id: int,
    payload: UserUpdate,
    request: Request,
    current_user: User = Depends(require_superadmin),
    db: Session = Depends(get_db),
) -> User:
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User tidak ditemukan.")
    email = payload.email.lower()
    duplicate = db.scalar(select(User.id).where(User.email == email, User.id != user_id))
    if duplicate:
        raise HTTPException(
            status_code=409,
            detail={"code": "EMAIL_EXISTS", "message": "Email sudah digunakan."},
        )
    if user.id == current_user.id and not payload.is_active:
        raise HTTPException(
            status_code=400,
            detail={"code": "SELF_DEACTIVATION", "message": "Superadmin tidak dapat menonaktifkan akunnya sendiri."},
        )
    ensure_not_last_superadmin(db, user, payload.role, payload.is_active)
    old_values = model_snapshot(user, USER_AUDIT_FIELDS)
    user.name = payload.name
    user.email = email
    user.role = payload.role
    user.is_active = payload.is_active
    if payload.password:
        user.password_hash = hash_password(payload.password)
    db.flush()
    write_audit_log(
        db,
        request,
        "UPDATE_USER",
        "USER",
        user.id,
        current_user,
        old_values=old_values,
        new_values=model_snapshot(user, USER_AUDIT_FIELDS),
    )
    db.commit()
    db.refresh(user)
    return user


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def deactivate_user(
    user_id: int,
    request: Request,
    current_user: User = Depends(require_superadmin),
    db: Session = Depends(get_db),
) -> None:
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User tidak ditemukan.")
    if user.id == current_user.id:
        raise HTTPException(
            status_code=400,
            detail={"code": "SELF_DEACTIVATION", "message": "Superadmin tidak dapat menonaktifkan akunnya sendiri."},
        )
    ensure_not_last_superadmin(db, user, user.role, False)
    old_values = model_snapshot(user, USER_AUDIT_FIELDS)
    user.is_active = False
    db.flush()
    write_audit_log(
        db,
        request,
        "DELETE_USER",
        "USER",
        user.id,
        current_user,
        old_values=old_values,
        new_values=model_snapshot(user, USER_AUDIT_FIELDS),
    )
    db.commit()
