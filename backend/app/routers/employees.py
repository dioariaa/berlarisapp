import math

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..audit import model_snapshot, write_audit_log
from ..models import Employee, User
from ..schemas import EmployeeCreate, EmployeePage, EmployeeRead, EmployeeUpdate
from ..security import require_admin

router = APIRouter(prefix="/employees", tags=["employees"], dependencies=[Depends(require_admin)])
EMPLOYEE_AUDIT_FIELDS = [
    "id", "nama", "jabatan", "departemen", "tanggal_masuk", "status_aktif"
]


@router.get("", response_model=EmployeePage)
def list_employees(
    search: str | None = Query(default=None, max_length=150),
    status_aktif: bool | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
    db: Session = Depends(get_db),
) -> EmployeePage:
    statement = select(Employee)
    count_statement = select(func.count(Employee.id))
    if search:
        term = f"%{search.strip()}%"
        search_filter = or_(
            Employee.nama.ilike(term),
            Employee.jabatan.ilike(term),
            Employee.departemen.ilike(term),
        )
        statement = statement.where(search_filter)
        count_statement = count_statement.where(search_filter)
    if status_aktif is not None:
        statement = statement.where(Employee.status_aktif == status_aktif)
        count_statement = count_statement.where(Employee.status_aktif == status_aktif)
    total = db.scalar(count_statement) or 0
    items = list(
        db.scalars(
            statement.order_by(Employee.nama.asc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        ).all()
    )
    return EmployeePage(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        pages=math.ceil(total / page_size) if total else 0,
    )


@router.get("/{employee_id}", response_model=EmployeeRead)
def get_employee(employee_id: int, db: Session = Depends(get_db)) -> Employee:
    employee = db.get(Employee, employee_id)
    if not employee:
        raise HTTPException(status_code=404, detail="Karyawan tidak ditemukan.")
    return employee


@router.post("", response_model=EmployeeRead, status_code=status.HTTP_201_CREATED)
def create_employee(
    payload: EmployeeCreate,
    request: Request,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> Employee:
    employee = Employee(**payload.model_dump())
    db.add(employee)
    db.flush()
    write_audit_log(
        db, request, "CREATE_EMPLOYEE", "EMPLOYEE", employee.id, current_user,
        new_values=model_snapshot(employee, EMPLOYEE_AUDIT_FIELDS),
    )
    db.commit()
    db.refresh(employee)
    return employee


@router.put("/{employee_id}", response_model=EmployeeRead)
def update_employee(
    employee_id: int,
    payload: EmployeeUpdate,
    request: Request,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> Employee:
    employee = db.get(Employee, employee_id)
    if not employee:
        raise HTTPException(status_code=404, detail="Karyawan tidak ditemukan.")
    old_values = model_snapshot(employee, EMPLOYEE_AUDIT_FIELDS)
    for field, value in payload.model_dump().items():
        setattr(employee, field, value)
    db.flush()
    write_audit_log(
        db, request, "UPDATE_EMPLOYEE", "EMPLOYEE", employee.id, current_user,
        old_values=old_values,
        new_values=model_snapshot(employee, EMPLOYEE_AUDIT_FIELDS),
    )
    db.commit()
    db.refresh(employee)
    return employee


@router.delete("/{employee_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_employee(
    employee_id: int,
    request: Request,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> Response:
    employee = db.get(Employee, employee_id)
    if not employee:
        raise HTTPException(status_code=404, detail="Karyawan tidak ditemukan.")
    old_values = model_snapshot(employee, EMPLOYEE_AUDIT_FIELDS)
    write_audit_log(
        db, request, "DELETE_EMPLOYEE", "EMPLOYEE", employee.id, current_user,
        old_values=old_values,
    )
    db.delete(employee)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
