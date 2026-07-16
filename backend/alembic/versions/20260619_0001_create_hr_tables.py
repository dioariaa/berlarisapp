"""create employees and employee leaves tables

Revision ID: 20260619_0001
Revises:
Create Date: 2026-06-19
"""
from typing import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260619_0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

leave_type_enum = postgresql.ENUM(
    "Cuti Tahunan",
    "Cuti Sakit",
    "Cuti Izin",
    "Cuti Khusus",
    "Lainnya",
    name="leave_type_enum",
    create_type=False,
)


def upgrade() -> None:
    leave_type_enum.create(op.get_bind(), checkfirst=True)
    op.create_table(
        "employees",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("nama", sa.String(length=150), nullable=False),
        sa.Column("jabatan", sa.String(length=120), nullable=False),
        sa.Column("departemen", sa.String(length=120), nullable=False),
        sa.Column("tanggal_masuk", sa.Date(), nullable=False),
        sa.Column("status_aktif", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_employees_nama", "employees", ["nama"])
    op.create_index("ix_employees_departemen", "employees", ["departemen"])

    op.create_table(
        "employee_leaves",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("employee_id", sa.Integer(), nullable=False),
        sa.Column("leave_type", leave_type_enum, nullable=False),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=False),
        sa.Column("total_days", sa.Integer(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("end_date >= start_date", name="ck_employee_leaves_date_range"),
        sa.CheckConstraint("total_days > 0", name="ck_employee_leaves_total_days_positive"),
        sa.ForeignKeyConstraint(["employee_id"], ["employees.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_employee_leaves_employee_id", "employee_leaves", ["employee_id"])
    op.create_index(
        "ix_employee_leaves_employee_dates",
        "employee_leaves",
        ["employee_id", "start_date", "end_date"],
    )
    op.create_index("ix_employee_leaves_leave_type", "employee_leaves", ["leave_type"])


def downgrade() -> None:
    op.drop_table("employee_leaves")
    op.drop_table("employees")
    leave_type_enum.drop(op.get_bind(), checkfirst=True)
