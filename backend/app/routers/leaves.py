from datetime import date
import math
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, joinedload

from ..database import get_db
from ..audit import model_snapshot, write_audit_log
from ..models import Employee, EmployeeLeave, LeaveType, User
from ..schemas import (
    EmployeeLeaveAggregate,
    LeaveCreate,
    LeavePage,
    LeaveRead,
    LeaveSummary,
    LeaveUpdate,
)
from ..services import create_leave, get_leave_aggregates_by_employee, get_summary, update_leave
from ..security import require_admin

router = APIRouter(prefix="/employee-leaves", tags=["employee-leaves"], dependencies=[Depends(require_admin)])
LEAVE_AUDIT_FIELDS = [
    "id", "employee_id", "leave_type", "start_date", "end_date", "total_days", "description"
]


@router.get("/summary", response_model=LeaveSummary)
def leave_summary(
    month: int = Query(default_factory=lambda: date.today().month, ge=1, le=12),
    year: int = Query(default_factory=lambda: date.today().year, ge=2000, le=2100),
    db: Session = Depends(get_db),
) -> LeaveSummary:
    return get_summary(db, month, year)


@router.get("/by-employee", response_model=list[EmployeeLeaveAggregate])
def leaves_by_employee(
    period_type: Literal["monthly", "yearly", "custom"] = "yearly",
    month: int | None = Query(default=None, ge=1, le=12),
    year: int | None = Query(default_factory=lambda: date.today().year, ge=2000, le=2100),
    date_from: date | None = None,
    date_to: date | None = None,
    employee_id: int | None = Query(default=None, ge=1),
    include_zero: bool = False,
    db: Session = Depends(get_db),
) -> list[EmployeeLeaveAggregate]:
    return get_leave_aggregates_by_employee(
        db,
        period_type=period_type,
        month=month,
        year=year,
        date_from=date_from,
        date_to=date_to,
        employee_id=employee_id,
        include_zero=include_zero,
    )


@router.get("", response_model=LeavePage)
def list_leaves(
    employee_id: int | None = None,
    employee_name: str | None = Query(default=None, max_length=150),
    leave_type: LeaveType | None = None,
    month: int | None = Query(default=None, ge=1, le=12),
    year: int | None = Query(default=None, ge=2000, le=2100),
    start_date: date | None = None,
    end_date: date | None = None,
    search: str | None = Query(default=None, max_length=150),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
    db: Session = Depends(get_db),
) -> LeavePage:
    statement = select(EmployeeLeave).join(Employee).options(joinedload(EmployeeLeave.employee))
    count_statement = select(func.count(EmployeeLeave.id)).join(Employee)
    if employee_id:
        statement = statement.where(EmployeeLeave.employee_id == employee_id)
        count_statement = count_statement.where(EmployeeLeave.employee_id == employee_id)
    if employee_name:
        name_filter = Employee.nama.ilike(f"%{employee_name.strip()}%")
        statement = statement.where(name_filter)
        count_statement = count_statement.where(name_filter)
    if leave_type:
        statement = statement.where(EmployeeLeave.leave_type == leave_type)
        count_statement = count_statement.where(EmployeeLeave.leave_type == leave_type)
    if month and year:
        from calendar import monthrange

        period_start = date(year, month, 1)
        period_end = date(year, month, monthrange(year, month)[1])
        statement = statement.where(
            EmployeeLeave.start_date <= period_end,
            EmployeeLeave.end_date >= period_start,
        )
        count_statement = count_statement.where(
            EmployeeLeave.start_date <= period_end,
            EmployeeLeave.end_date >= period_start,
        )
    if start_date:
        statement = statement.where(EmployeeLeave.end_date >= start_date)
        count_statement = count_statement.where(EmployeeLeave.end_date >= start_date)
    if end_date:
        statement = statement.where(EmployeeLeave.start_date <= end_date)
        count_statement = count_statement.where(EmployeeLeave.start_date <= end_date)
    if search:
        term = f"%{search.strip()}%"
        search_filter = or_(Employee.nama.ilike(term), EmployeeLeave.description.ilike(term))
        statement = statement.where(search_filter)
        count_statement = count_statement.where(search_filter)
    total = db.scalar(count_statement) or 0
    items = list(
        db.scalars(
            statement.order_by(EmployeeLeave.start_date.desc(), EmployeeLeave.id.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        ).unique().all()
    )
    return LeavePage(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        pages=math.ceil(total / page_size) if total else 0,
    )


@router.get("/{leave_id}", response_model=LeaveRead)
def get_leave(leave_id: int, db: Session = Depends(get_db)) -> EmployeeLeave:
    leave = db.scalar(
        select(EmployeeLeave)
        .options(joinedload(EmployeeLeave.employee))
        .where(EmployeeLeave.id == leave_id)
    )
    if not leave:
        raise HTTPException(status_code=404, detail="Data cuti tidak ditemukan.")
    return leave


@router.post("", response_model=LeaveRead, status_code=status.HTTP_201_CREATED)
def add_leave(
    payload: LeaveCreate,
    request: Request,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> EmployeeLeave:
    leave = create_leave(db, payload)
    write_audit_log(
        db, request, "CREATE_LEAVE", "EMPLOYEE_LEAVE", leave.id, current_user,
        new_values=model_snapshot(leave, LEAVE_AUDIT_FIELDS),
    )
    db.commit()
    return leave


@router.put("/{leave_id}", response_model=LeaveRead)
def edit_leave(
    leave_id: int,
    payload: LeaveUpdate,
    request: Request,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> EmployeeLeave:
    leave = db.get(EmployeeLeave, leave_id)
    if not leave:
        raise HTTPException(status_code=404, detail="Data cuti tidak ditemukan.")
    old_values = model_snapshot(leave, LEAVE_AUDIT_FIELDS)
    updated = update_leave(db, leave, payload)
    write_audit_log(
        db, request, "UPDATE_LEAVE", "EMPLOYEE_LEAVE", updated.id, current_user,
        old_values=old_values,
        new_values=model_snapshot(updated, LEAVE_AUDIT_FIELDS),
    )
    db.commit()
    return updated


@router.delete("/{leave_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_leave(
    leave_id: int,
    request: Request,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> Response:
    leave = db.get(EmployeeLeave, leave_id)
    if not leave:
        raise HTTPException(status_code=404, detail="Data cuti tidak ditemukan.")
    old_values = model_snapshot(leave, LEAVE_AUDIT_FIELDS)
    write_audit_log(
        db, request, "DELETE_LEAVE", "EMPLOYEE_LEAVE", leave.id, current_user,
        old_values=old_values,
    )
    db.delete(leave)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
