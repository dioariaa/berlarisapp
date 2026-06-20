from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..schemas import DashboardSummary
from ..security import require_admin
from ..services import get_dashboard_summary

router = APIRouter(prefix="/dashboard", tags=["dashboard"], dependencies=[Depends(require_admin)])


@router.get("/summary", response_model=DashboardSummary)
def dashboard_summary(
    month: int = Query(default_factory=lambda: date.today().month, ge=1, le=12),
    year: int = Query(default_factory=lambda: date.today().year, ge=2000, le=2100),
    db: Session = Depends(get_db),
) -> DashboardSummary:
    return get_dashboard_summary(db, month, year)
