from datetime import date
from typing import Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..schemas import DashboardSummary
from ..security import require_admin
from ..services import get_dashboard_summary

router = APIRouter(prefix="/dashboard", tags=["dashboard"], dependencies=[Depends(require_admin)])


@router.get("/summary", response_model=DashboardSummary)
def dashboard_summary(
    period_type: Literal["monthly", "yearly", "custom"] = "yearly",
    month: int | None = Query(default=None, ge=1, le=12),
    year: int | None = Query(default_factory=lambda: date.today().year, ge=2000, le=2100),
    date_from: date | None = None,
    date_to: date | None = None,
    db: Session = Depends(get_db),
) -> DashboardSummary:
    return get_dashboard_summary(
        db,
        period_type=period_type,
        month=month,
        year=year,
        date_from=date_from,
        date_to=date_to,
    )
