import calendar
from collections import Counter, defaultdict
from datetime import date

from fastapi import HTTPException, status
from sqlalchemy import and_, func, select
from sqlalchemy.orm import Session, joinedload

from .models import Employee, EmployeeLeave, LeaveType
from .schemas import (
    DashboardSummary,
    LeaveCreate,
    LeaveSummary,
    LeaveTypeCount,
    LeaveUpdate,
    RecentLeave,
    TopEmployeeLeave,
)


def calculate_total_days(start_date: date, end_date: date) -> int:
    return (end_date - start_date).days + 1


def get_employee_or_404(db: Session, employee_id: int) -> Employee:
    employee = db.get(Employee, employee_id)
    if not employee:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Karyawan tidak ditemukan.")
    return employee


def find_overlap(
    db: Session,
    employee_id: int,
    start_date: date,
    end_date: date,
    exclude_id: int | None = None,
) -> EmployeeLeave | None:
    statement = select(EmployeeLeave).where(
        EmployeeLeave.employee_id == employee_id,
        EmployeeLeave.start_date <= end_date,
        EmployeeLeave.end_date >= start_date,
    )
    if exclude_id is not None:
        statement = statement.where(EmployeeLeave.id != exclude_id)
    return db.scalar(statement.limit(1))


def ensure_no_overlap(
    db: Session,
    employee_id: int,
    start_date: date,
    end_date: date,
    override_overlap: bool,
    exclude_id: int | None = None,
) -> None:
    overlap = find_overlap(db, employee_id, start_date, end_date, exclude_id)
    if overlap and not override_overlap:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "LEAVE_OVERLAP",
                "message": "Rentang tanggal bertabrakan dengan data cuti yang sudah ada.",
                "overlap_leave_id": overlap.id,
                "overlap_start_date": overlap.start_date.isoformat(),
                "overlap_end_date": overlap.end_date.isoformat(),
            },
        )


def create_leave(db: Session, payload: LeaveCreate) -> EmployeeLeave:
    get_employee_or_404(db, payload.employee_id)
    ensure_no_overlap(
        db, payload.employee_id, payload.start_date, payload.end_date, payload.override_overlap
    )
    leave = EmployeeLeave(
        employee_id=payload.employee_id,
        leave_type=payload.leave_type,
        start_date=payload.start_date,
        end_date=payload.end_date,
        total_days=calculate_total_days(payload.start_date, payload.end_date),
        description=payload.description or None,
    )
    db.add(leave)
    db.flush()
    return db.scalar(
        select(EmployeeLeave)
        .options(joinedload(EmployeeLeave.employee))
        .where(EmployeeLeave.id == leave.id)
    )


def update_leave(db: Session, leave: EmployeeLeave, payload: LeaveUpdate) -> EmployeeLeave:
    get_employee_or_404(db, payload.employee_id)
    ensure_no_overlap(
        db,
        payload.employee_id,
        payload.start_date,
        payload.end_date,
        payload.override_overlap,
        exclude_id=leave.id,
    )
    leave.employee_id = payload.employee_id
    leave.leave_type = payload.leave_type
    leave.start_date = payload.start_date
    leave.end_date = payload.end_date
    leave.total_days = calculate_total_days(payload.start_date, payload.end_date)
    leave.description = payload.description or None
    db.flush()
    return db.scalar(
        select(EmployeeLeave)
        .options(joinedload(EmployeeLeave.employee))
        .where(EmployeeLeave.id == leave.id)
    )


def get_summary(db: Session, month: int, year: int) -> LeaveSummary:
    month_end_day = calendar.monthrange(year, month)[1]
    month_start = date(year, month, 1)
    month_end = date(year, month, month_end_day)
    today = date.today()

    overlapping = and_(
        EmployeeLeave.start_date <= month_end,
        EmployeeLeave.end_date >= month_start,
    )
    period_leaves = list(
        db.scalars(
            select(EmployeeLeave)
            .options(joinedload(EmployeeLeave.employee))
            .where(overlapping)
        ).all()
    )
    total_leaves = len(period_leaves)
    active_today = (
        db.scalar(
            select(func.count(func.distinct(EmployeeLeave.employee_id))).where(
                EmployeeLeave.start_date <= today,
                EmployeeLeave.end_date >= today,
            )
        )
        or 0
    )
    type_map: Counter[LeaveType] = Counter()
    employee_days: defaultdict[tuple[int, str], int] = defaultdict(int)
    used_days = 0
    for leave in period_leaves:
        clipped_start = max(leave.start_date, month_start)
        clipped_end = min(leave.end_date, month_end)
        days = calculate_total_days(clipped_start, clipped_end)
        used_days += days
        type_map[leave.leave_type] += 1
        employee_days[(leave.employee.id, leave.employee.nama)] += days

    type_counts = [
        LeaveTypeCount(leave_type=leave_type, total=type_map.get(leave_type, 0))
        for leave_type in LeaveType
    ]
    top_employees = [
        TopEmployeeLeave(employee_id=employee_id, employee_name=name, total_days=days)
        for (employee_id, name), days in sorted(
            employee_days.items(), key=lambda item: (-item[1], item[0][1])
        )[:5]
    ]

    return LeaveSummary(
        month=month,
        year=year,
        total_cuti_bulan_ini=total_leaves,
        karyawan_sedang_cuti_hari_ini=active_today,
        total_hari_cuti_terpakai_bulan_ini=used_days,
        jumlah_per_jenis_cuti=type_counts,
        karyawan_dengan_cuti_terbanyak=top_employees,
    )


def get_dashboard_summary(db: Session) -> DashboardSummary:
    today = date.today()
    leave_summary = get_summary(db, today.month, today.year)
    active_employees = (
        db.scalar(select(func.count(Employee.id)).where(Employee.status_aktif.is_(True))) or 0
    )
    recent_rows = list(
        db.scalars(
            select(EmployeeLeave)
            .options(joinedload(EmployeeLeave.employee))
            .order_by(EmployeeLeave.created_at.desc(), EmployeeLeave.id.desc())
            .limit(8)
        ).all()
    )
    recent_leaves = [
        RecentLeave(
            id=leave.id,
            employee_name=leave.employee.nama,
            leave_type=leave.leave_type,
            start_date=leave.start_date,
            end_date=leave.end_date,
            total_days=leave.total_days,
        )
        for leave in recent_rows
    ]
    return DashboardSummary(
        total_active_employees=active_employees,
        total_leaves_this_month=leave_summary.total_cuti_bulan_ini,
        employees_on_leave_today=leave_summary.karyawan_sedang_cuti_hari_ini,
        total_leave_days_this_month=leave_summary.total_hari_cuti_terpakai_bulan_ini,
        leave_distribution=leave_summary.jumlah_per_jenis_cuti,
        recent_leaves=recent_leaves,
        top_leave_employees=leave_summary.karyawan_dengan_cuti_terbanyak,
    )
