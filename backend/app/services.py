import calendar
from collections import Counter, defaultdict
from datetime import date

from fastapi import HTTPException, status
from sqlalchemy import and_, func, select
from sqlalchemy.orm import Session, joinedload

from .models import Employee, EmployeeLeave, LeaveType
from .schemas import (
    DashboardSummary,
    DashboardPeriod,
    EmployeeLeaveAggregate,
    LeaveCreate,
    LeaveSummary,
    LeaveTypeCount,
    LeaveTypeEmployeeSummary,
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


MONTH_LABELS = (
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember",
)


def resolve_period(
    period_type: str,
    month: int | None = None,
    year: int | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
) -> tuple[date, date, str]:
    if period_type == "monthly":
        if month is None or year is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="month dan year wajib untuk periode bulanan.",
            )
        period_start = date(year, month, 1)
        period_end = date(year, month, calendar.monthrange(year, month)[1])
        return period_start, period_end, f"{MONTH_LABELS[month - 1]} {year}"
    if period_type == "yearly":
        if year is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="year wajib untuk periode tahunan.",
            )
        return date(year, 1, 1), date(year, 12, 31), f"Tahun {year}"
    if date_from is None or date_to is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="date_from dan date_to wajib untuk rentang tanggal.",
        )
    if date_to < date_from:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="date_to tidak boleh lebih kecil dari date_from.",
        )
    label = (
        f"{date_from.strftime('%d-%m-%Y')} s.d. "
        f"{date_to.strftime('%d-%m-%Y')}"
    )
    return date_from, date_to, label


def get_leave_aggregates_by_employee(
    db: Session,
    period_type: str,
    month: int | None = None,
    year: int | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    employee_id: int | None = None,
    include_zero: bool = False,
) -> list[EmployeeLeaveAggregate]:
    period_start, period_end, period_label = resolve_period(
        period_type, month, year, date_from, date_to
    )
    statement = (
        select(EmployeeLeave)
        .options(joinedload(EmployeeLeave.employee))
        .where(
            EmployeeLeave.start_date <= period_end,
            EmployeeLeave.end_date >= period_start,
        )
    )
    if employee_id is not None:
        get_employee_or_404(db, employee_id)
        statement = statement.where(EmployeeLeave.employee_id == employee_id)

    grouped: dict[int, dict] = {}
    for leave in db.scalars(statement).all():
        clipped_start = max(leave.start_date, period_start)
        clipped_end = min(leave.end_date, period_end)
        days = calculate_total_days(clipped_start, clipped_end)
        employee_data = grouped.setdefault(
            leave.employee_id,
            {
                "employee": leave.employee,
                "total_entries": 0,
                "total_days": 0,
                "types": defaultdict(lambda: {"total_entries": 0, "total_days": 0}),
            },
        )
        employee_data["total_entries"] += 1
        employee_data["total_days"] += days
        type_data = employee_data["types"][leave.leave_type]
        type_data["total_entries"] += 1
        type_data["total_days"] += days

    if include_zero:
        employee_statement = select(Employee).where(Employee.status_aktif.is_(True))
        if employee_id is not None:
            employee_statement = employee_statement.where(Employee.id == employee_id)
        for employee in db.scalars(employee_statement).all():
            grouped.setdefault(
                employee.id,
                {
                    "employee": employee,
                    "total_entries": 0,
                    "total_days": 0,
                    "types": {},
                },
            )

    result = []
    for item in grouped.values():
        employee = item["employee"]
        leave_types = [
            LeaveTypeEmployeeSummary(
                leave_type=leave_type,
                total_entries=values["total_entries"],
                total_days=values["total_days"],
            )
            for leave_type, values in sorted(
                item["types"].items(),
                key=lambda entry: list(LeaveType).index(entry[0]),
            )
        ]
        result.append(
            EmployeeLeaveAggregate(
                employee_id=employee.id,
                employee_name=employee.nama,
                department=employee.departemen,
                period_label=period_label,
                total_leave_entries=item["total_entries"],
                total_leave_days=item["total_days"],
                leave_type_breakdown=leave_types,
            )
        )
    return sorted(
        result,
        key=lambda item: (-item.total_leave_days, item.employee_name.casefold()),
    )


def get_dashboard_summary(
    db: Session,
    period_type: str,
    month: int | None = None,
    year: int | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
) -> DashboardSummary:
    today = date.today()
    period_start, period_end, period_label = resolve_period(
        period_type, month, year, date_from, date_to
    )
    active_employees = (
        db.scalar(select(func.count(Employee.id)).where(Employee.status_aktif.is_(True))) or 0
    )
    period_rows = list(
        db.scalars(
            select(EmployeeLeave)
            .options(joinedload(EmployeeLeave.employee))
            .where(
                EmployeeLeave.start_date <= period_end,
                EmployeeLeave.end_date >= period_start,
            )
        ).all()
    )
    type_map: Counter[LeaveType] = Counter()
    employee_days: defaultdict[tuple[int, str], int] = defaultdict(int)
    total_days = 0
    for leave in period_rows:
        clipped_start = max(leave.start_date, period_start)
        clipped_end = min(leave.end_date, period_end)
        days = calculate_total_days(clipped_start, clipped_end)
        total_days += days
        type_map[leave.leave_type] += 1
        employee_days[(leave.employee_id, leave.employee.nama)] += days

    active_today = (
        db.scalar(
            select(func.count(func.distinct(EmployeeLeave.employee_id))).where(
                EmployeeLeave.start_date <= today,
                EmployeeLeave.end_date >= today,
            )
        )
        or 0
    )
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
    recent_rows = list(
        db.scalars(
            select(EmployeeLeave)
            .options(joinedload(EmployeeLeave.employee))
            .where(
                EmployeeLeave.start_date <= period_end,
                EmployeeLeave.end_date >= period_start,
            )
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
        period=DashboardPeriod(
            type=period_type,
            month=month if period_type == "monthly" else None,
            year=year if period_type in {"monthly", "yearly"} else None,
            label=period_label,
            date_from=period_start,
            date_to=period_end,
        ),
        total_active_employees=active_employees,
        total_leaves_this_month=len(period_rows),
        employees_on_leave_today=active_today,
        total_leave_days_this_month=total_days,
        leave_distribution=type_counts,
        recent_leaves=recent_leaves,
        top_leave_employees=top_employees,
    )
