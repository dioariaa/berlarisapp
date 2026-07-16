from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, model_validator

from .models import LeaveType, UserRole


class EmployeeBase(BaseModel):
    nama: str = Field(min_length=2, max_length=150)
    jabatan: str = Field(min_length=2, max_length=120)
    departemen: str = Field(min_length=2, max_length=120)
    tanggal_masuk: date
    status_aktif: bool = True

    model_config = ConfigDict(str_strip_whitespace=True)


class EmployeeCreate(EmployeeBase):
    pass


class EmployeeUpdate(EmployeeBase):
    pass


class EmployeeRead(EmployeeBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class EmployeeBrief(BaseModel):
    id: int
    nama: str
    jabatan: str
    departemen: str
    status_aktif: bool

    model_config = ConfigDict(from_attributes=True)


class LeaveBase(BaseModel):
    employee_id: int
    leave_type: LeaveType
    start_date: date
    end_date: date
    description: str | None = Field(default=None, max_length=1000)

    model_config = ConfigDict(str_strip_whitespace=True)

    @model_validator(mode="after")
    def validate_date_range(self) -> "LeaveBase":
        if self.end_date < self.start_date:
            raise ValueError("end_date tidak boleh lebih kecil dari start_date")
        return self


class LeaveCreate(LeaveBase):
    override_overlap: bool = False


class LeaveUpdate(LeaveBase):
    override_overlap: bool = False


class LeaveRead(BaseModel):
    id: int
    employee_id: int
    employee: EmployeeBrief
    leave_type: LeaveType
    start_date: date
    end_date: date
    total_days: int
    description: str | None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class LeaveTypeCount(BaseModel):
    leave_type: LeaveType
    total: int


class TopEmployeeLeave(BaseModel):
    employee_id: int
    employee_name: str
    total_days: int


class LeaveTypeEmployeeSummary(BaseModel):
    leave_type: LeaveType
    total_entries: int
    total_days: int


class EmployeeLeaveAggregate(BaseModel):
    employee_id: int
    employee_name: str
    department: str
    period_label: str
    total_leave_entries: int
    total_leave_days: int
    leave_type_breakdown: list[LeaveTypeEmployeeSummary]


class LeaveSummary(BaseModel):
    month: int
    year: int
    total_cuti_bulan_ini: int
    karyawan_sedang_cuti_hari_ini: int
    total_hari_cuti_terpakai_bulan_ini: int
    jumlah_per_jenis_cuti: list[LeaveTypeCount]
    karyawan_dengan_cuti_terbanyak: list[TopEmployeeLeave]


class RecentLeave(BaseModel):
    id: int
    employee_name: str
    leave_type: LeaveType
    start_date: date
    end_date: date
    total_days: int


class DashboardPeriod(BaseModel):
    type: Literal["monthly", "yearly", "custom"]
    month: int | None = None
    year: int | None = None
    label: str
    date_from: date
    date_to: date


class DashboardSummary(BaseModel):
    period: DashboardPeriod
    total_active_employees: int
    total_leaves_this_month: int
    employees_on_leave_today: int
    total_leave_days_this_month: int
    leave_distribution: list[LeaveTypeCount]
    recent_leaves: list[RecentLeave]
    top_leave_employees: list[TopEmployeeLeave]


class EmployeePage(BaseModel):
    items: list[EmployeeRead]
    total: int
    page: int
    page_size: int
    pages: int


class LeavePage(BaseModel):
    items: list[LeaveRead]
    total: int
    page: int
    page_size: int
    pages: int


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)

    model_config = ConfigDict(str_strip_whitespace=True)

    @model_validator(mode="after")
    def validate_password_bytes(self) -> "LoginRequest":
        if len(self.password.encode("utf-8")) > 72:
            raise ValueError("Password terlalu panjang.")
        return self


class UserRead(BaseModel):
    id: int
    name: str
    email: EmailStr
    role: UserRole
    is_active: bool
    last_login_at: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserRead


class UserCreate(BaseModel):
    name: str = Field(min_length=2, max_length=150)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    role: UserRole = UserRole.ADMIN
    is_active: bool = True

    model_config = ConfigDict(str_strip_whitespace=True)

    @model_validator(mode="after")
    def validate_password_bytes(self) -> "UserCreate":
        if len(self.password.encode("utf-8")) > 72:
            raise ValueError("Password maksimal 72 byte.")
        return self


class UserUpdate(BaseModel):
    name: str = Field(min_length=2, max_length=150)
    email: EmailStr
    role: UserRole
    is_active: bool
    password: str | None = Field(default=None, min_length=8, max_length=128)

    model_config = ConfigDict(str_strip_whitespace=True)

    @model_validator(mode="after")
    def validate_password_bytes(self) -> "UserUpdate":
        if self.password and len(self.password.encode("utf-8")) > 72:
            raise ValueError("Password maksimal 72 byte.")
        return self


class UserPage(BaseModel):
    items: list[UserRead]
    total: int
    page: int
    page_size: int
    pages: int


class AuditLogRead(BaseModel):
    id: int
    user_id: int | None
    user_name: str
    user_email: str
    action: str
    entity_type: str
    entity_id: str | None
    old_values: dict | None
    new_values: dict | None
    ip_address: str | None
    user_agent: str | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AuditLogPage(BaseModel):
    items: list[AuditLogRead]
    total: int
    page: int
    page_size: int
    pages: int
