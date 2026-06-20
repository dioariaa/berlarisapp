export const LEAVE_TYPES = [
  'Cuti Tahunan',
  'Cuti Sakit',
  'Cuti Izin',
  'Cuti Khusus',
  'Lainnya',
] as const

export type LeaveType = (typeof LEAVE_TYPES)[number]

export interface Employee {
  id: number
  nama: string
  jabatan: string
  departemen: string
  tanggal_masuk: string
  status_aktif: boolean
  created_at: string
  updated_at: string
}

export interface LeaveRecord {
  id: number
  employee_id: number
  employee: Pick<Employee, 'id' | 'nama' | 'jabatan' | 'departemen' | 'status_aktif'>
  leave_type: LeaveType
  start_date: string
  end_date: string
  total_days: number
  description: string | null
  created_at: string
  updated_at: string
}

export interface LeaveFormValues {
  employee_id: number
  leave_type: LeaveType
  start_date: string
  end_date: string
  description: string
  override_overlap?: boolean
}

export interface EmployeeFormValues {
  nama: string
  jabatan: string
  departemen: string
  tanggal_masuk: string
  status_aktif: boolean
}

export interface LeaveSummary {
  month: number
  year: number
  total_cuti_bulan_ini: number
  karyawan_sedang_cuti_hari_ini: number
  total_hari_cuti_terpakai_bulan_ini: number
  jumlah_per_jenis_cuti: { leave_type: LeaveType; total: number }[]
  karyawan_dengan_cuti_terbanyak: {
    employee_id: number
    employee_name: string
    total_days: number
  }[]
}

export interface ApiErrorBody {
  error?: {
    code: string
    message: string
    details?: {
      overlap_leave_id?: number
      overlap_start_date?: string
      overlap_end_date?: string
    } | { field: string; message: string; type: string }[] | null
  }
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  page_size: number
  pages: number
}

export interface DashboardSummary {
  period: {
    month: number
    year: number
    label: string
  }
  total_active_employees: number
  total_leaves_this_month: number
  employees_on_leave_today: number
  total_leave_days_this_month: number
  leave_distribution: { leave_type: LeaveType; total: number }[]
  recent_leaves: {
    id: number
    employee_name: string
    leave_type: LeaveType
    start_date: string
    end_date: string
    total_days: number
  }[]
  top_leave_employees: {
    employee_id: number
    employee_name: string
    total_days: number
  }[]
}

export interface EmployeeLeaveAggregate {
  employee_id: number
  employee_name: string
  department: string
  total_leaves: number
  total_days: number
  leave_types: {
    leave_type: LeaveType
    total_leaves: number
    total_days: number
  }[]
}

export type UserRole = 'admin' | 'superadmin'

export interface AuthUser {
  id: number
  name: string
  email: string
  role: UserRole
  is_active: boolean
  last_login_at: string | null
  created_at: string
  updated_at: string
}

export interface LoginResponse {
  access_token: string
  token_type: 'bearer'
  expires_in: number
  user: AuthUser
}

export interface UserFormValues {
  name: string
  email: string
  password?: string
  role: UserRole
  is_active: boolean
}

export interface AuditLog {
  id: number
  user_id: number | null
  user_name: string
  user_email: string
  action: string
  entity_type: string
  entity_id: string | null
  old_values: Record<string, unknown> | null
  new_values: Record<string, unknown> | null
  ip_address: string | null
  user_agent: string | null
  created_at: string
}
