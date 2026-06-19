from sqlalchemy import select

from .config import get_settings
from .database import SessionLocal
from .models import User, UserRole
from .security import hash_password


def seed_superadmin() -> None:
    settings = get_settings()
    if not all(
        [
            settings.first_superadmin_name,
            settings.first_superadmin_email,
            settings.first_superadmin_password,
        ]
    ):
        raise RuntimeError(
            "FIRST_SUPERADMIN_NAME, FIRST_SUPERADMIN_EMAIL, dan "
            "FIRST_SUPERADMIN_PASSWORD wajib diisi."
        )

    email = settings.first_superadmin_email.lower().strip()
    with SessionLocal() as db:
        existing = db.scalar(select(User).where(User.email == email))
        if existing:
            changed = False
            if existing.role != UserRole.SUPERADMIN:
                existing.role = UserRole.SUPERADMIN
                changed = True
            if not existing.is_active:
                existing.is_active = True
                changed = True
            if settings.first_superadmin_overwrite_password:
                existing.password_hash = hash_password(settings.first_superadmin_password)
                changed = True
            if changed:
                db.commit()
                print("Superadmin yang ada berhasil diperbarui.")
            else:
                print("Superadmin sudah tersedia; tidak ada perubahan.")
            return

        user = User(
            name=settings.first_superadmin_name.strip(),
            email=email,
            password_hash=hash_password(settings.first_superadmin_password),
            role=UserRole.SUPERADMIN,
            is_active=True,
        )
        db.add(user)
        db.commit()
        print("Superadmin pertama berhasil dibuat.")


if __name__ == "__main__":
    seed_superadmin()
