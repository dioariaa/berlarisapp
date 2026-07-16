import { createClient } from '@supabase/supabase-js'
import ExcelJS from 'exceljs'
import type {
  ApiErrorBody,
  AuditLog,
  AuthUser,
  Employee,
  EmployeeFormValues,
  DashboardSummary,
  EmployeeLeaveAggregate,
  AnalyticsPeriod,
  LeaveFormValues,
  LeaveRecord,
  LeaveSummary,
  LoginResponse,
  PaginatedResponse,
  UserFormValues,
} from '../types'

// Supabase URL + anon key are public/non-secret by design (protected by RLS + RPC checks server-side).
const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim()
  || 'https://opnkfxycxfayggcomohm.supabase.co'
const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim()
  || 'sb_publishable_tHS91NSwS1y2m02NMsJbAQ_FMd1x2J_'
const AUTH_STORAGE_KEY = 'berlarisapp-auth-token'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: window.sessionStorage,
    storageKey: AUTH_STORAGE_KEY,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
})

export function hasAccessToken() {
  return Boolean(window.sessionStorage.getItem(AUTH_STORAGE_KEY))
}

export class ApiError extends Error {
  status: number
  body: ApiErrorBody

  constructor(status: number, body: ApiErrorBody) {
    super(body.error?.message || 'Terjadi kesalahan saat menghubungi server.')
    this.status = status
    this.body = body
  }
}

function statusForCode(code: string): number {
  switch (code) {
    case 'FORBIDDEN':
      return 403
    case 'NOT_FOUND':
      return 404
    case 'LEAVE_OVERLAP':
    case 'EMAIL_EXISTS':
      return 409
    case 'LAST_SUPERADMIN':
    case 'SELF_DEACTIVATION':
    case 'VALIDATION_ERROR':
      return 400
    default:
      return 400
  }
}

function toApiError(error: { message?: string; code?: string } | null): ApiError {
  if (!error) {
    return new ApiError(500, { error: { code: 'UNKNOWN', message: 'Terjadi kesalahan yang tidak diketahui.' } })
  }
  try {
    const parsed = JSON.parse(error.message ?? '')
    if (parsed && typeof parsed === 'object' && parsed.code) {
      return new ApiError(statusForCode(parsed.code), {
        error: { code: parsed.code, message: parsed.message, details: parsed.details ?? null },
      })
    }
  } catch {
    // message wasn't structured JSON, fall through to generic mapping
  }
  return new ApiError(400, { error: { code: error.code || 'ERROR', message: error.message || 'Terjadi kesalahan.' } })
}

function escapeIlike(term: string): string {
  return term.replace(/[%_]/g, (match) => `\\${match}`)
}

function orTerm(term: string): string {
  return `%${escapeIlike(term.trim())}%`
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function lastDayOfMonth(year: number, month: number): string {
  return new Date(year, month, 0).toISOString().slice(0, 10)
}

const LEAVE_SELECT = '*, employee:employees(id,nama,jabatan,departemen,status_aktif)'

export const employeeApi = {
  list: async (search?: string, status_aktif?: boolean, page = 1, page_size = 100): Promise<PaginatedResponse<Employee>> => {
    let query = supabase.from('employees').select('*', { count: 'exact' })
    if (search) {
      const term = orTerm(search)
      query = query.or(`nama.ilike."${term}",jabatan.ilike."${term}",departemen.ilike."${term}"`)
    }
    if (status_aktif !== undefined) query = query.eq('status_aktif', status_aktif)
    const from = (page - 1) * page_size
    const to = from + page_size - 1
    const { data, error, count } = await query.order('nama', { ascending: true }).range(from, to)
    if (error) throw toApiError(error)
    const total = count ?? 0
    return { items: (data ?? []) as Employee[], total, page, page_size, pages: total ? Math.ceil(total / page_size) : 0 }
  },
  get: async (id: number): Promise<Employee> => {
    const { data, error } = await supabase.from('employees').select('*').eq('id', id).single()
    if (error) throw toApiError(error)
    return data as Employee
  },
  create: async (payload: EmployeeFormValues): Promise<Employee> => {
    const { data, error } = await supabase.rpc('create_employee', {
      p_nama: payload.nama,
      p_jabatan: payload.jabatan,
      p_departemen: payload.departemen,
      p_tanggal_masuk: payload.tanggal_masuk,
      p_status_aktif: payload.status_aktif,
    })
    if (error) throw toApiError(error)
    return data as Employee
  },
  update: async (id: number, payload: EmployeeFormValues): Promise<Employee> => {
    const { data, error } = await supabase.rpc('update_employee', {
      p_id: id,
      p_nama: payload.nama,
      p_jabatan: payload.jabatan,
      p_departemen: payload.departemen,
      p_tanggal_masuk: payload.tanggal_masuk,
      p_status_aktif: payload.status_aktif,
    })
    if (error) throw toApiError(error)
    return data as Employee
  },
  remove: async (id: number): Promise<void> => {
    const { error } = await supabase.rpc('delete_employee', { p_id: id })
    if (error) throw toApiError(error)
  },
}

export interface LeaveFilters {
  employee_name?: string
  leave_type?: string
  month?: number
  year?: number
  start_date?: string
  end_date?: string
  search?: string
  page?: number
  page_size?: number
}

export const leaveApi = {
  list: async (filters: LeaveFilters = {}): Promise<PaginatedResponse<LeaveRecord>> => {
    const { employee_name, leave_type, month, year, start_date, end_date, search, page = 1, page_size = 25 } = filters
    let query = supabase.from('employee_leaves').select(LEAVE_SELECT, { count: 'exact' })
    if (leave_type) query = query.eq('leave_type', leave_type)
    if (month && year) {
      const periodStart = `${year}-${String(month).padStart(2, '0')}-01`
      query = query.lte('start_date', lastDayOfMonth(year, month)).gte('end_date', periodStart)
    }
    if (start_date) query = query.gte('end_date', start_date)
    if (end_date) query = query.lte('start_date', end_date)
    if (employee_name) {
      const { data: emps } = await supabase.from('employees').select('id').ilike('nama', orTerm(employee_name))
      const ids = (emps ?? []).map((row) => row.id)
      if (ids.length === 0) return { items: [], total: 0, page, page_size, pages: 0 }
      query = query.in('employee_id', ids)
    }
    if (search) {
      const { data: emps } = await supabase.from('employees').select('id').ilike('nama', orTerm(search))
      const ids = (emps ?? []).map((row) => row.id)
      const term = orTerm(search)
      query = ids.length > 0
        ? query.or(`description.ilike."${term}",employee_id.in.(${ids.join(',')})`)
        : query.ilike('description', term)
    }
    const from = (page - 1) * page_size
    const to = from + page_size - 1
    const { data, error, count } = await query
      .order('start_date', { ascending: false })
      .order('id', { ascending: false })
      .range(from, to)
    if (error) throw toApiError(error)
    const total = count ?? 0
    return { items: (data ?? []) as unknown as LeaveRecord[], total, page, page_size, pages: total ? Math.ceil(total / page_size) : 0 }
  },
  get: async (id: number): Promise<LeaveRecord> => {
    const { data, error } = await supabase.from('employee_leaves').select(LEAVE_SELECT).eq('id', id).single()
    if (error) throw toApiError(error)
    return data as unknown as LeaveRecord
  },
  summary: async (month: number, year: number): Promise<LeaveSummary> => {
    const { data, error } = await supabase.rpc('leave_summary', { p_month: month, p_year: year })
    if (error) throw toApiError(error)
    return data as LeaveSummary
  },
  byEmployee: async (period: AnalyticsPeriod, employee_id?: number, include_zero = false): Promise<EmployeeLeaveAggregate[]> => {
    const { data, error } = await supabase.rpc('leaves_by_employee', {
      p_period_type: period.period_type,
      p_month: period.month ?? null,
      p_year: period.year ?? null,
      p_date_from: period.date_from ?? null,
      p_date_to: period.date_to ?? null,
      p_employee_id: employee_id ?? null,
      p_include_zero: include_zero,
    })
    if (error) throw toApiError(error)
    return (data ?? []) as EmployeeLeaveAggregate[]
  },
  create: async (payload: LeaveFormValues): Promise<LeaveRecord> => {
    const { data, error } = await supabase.rpc('create_leave', {
      p_employee_id: payload.employee_id,
      p_leave_type: payload.leave_type,
      p_start_date: payload.start_date,
      p_end_date: payload.end_date,
      p_description: payload.description || null,
      p_override_overlap: payload.override_overlap ?? false,
    })
    if (error) throw toApiError(error)
    return data as unknown as LeaveRecord
  },
  update: async (id: number, payload: LeaveFormValues): Promise<LeaveRecord> => {
    const { data, error } = await supabase.rpc('update_leave', {
      p_id: id,
      p_employee_id: payload.employee_id,
      p_leave_type: payload.leave_type,
      p_start_date: payload.start_date,
      p_end_date: payload.end_date,
      p_description: payload.description || null,
      p_override_overlap: payload.override_overlap ?? false,
    })
    if (error) throw toApiError(error)
    return data as unknown as LeaveRecord
  },
  remove: async (id: number): Promise<void> => {
    const { error } = await supabase.rpc('delete_leave', { p_id: id })
    if (error) throw toApiError(error)
  },
}

export const dashboardApi = {
  summary: async (period: AnalyticsPeriod): Promise<DashboardSummary> => {
    const { data, error } = await supabase.rpc('dashboard_summary', {
      p_period_type: period.period_type,
      p_month: period.month ?? null,
      p_year: period.year ?? null,
      p_date_from: period.date_from ?? null,
      p_date_to: period.date_to ?? null,
    })
    if (error) throw toApiError(error)
    return data as DashboardSummary
  },
}

export const authApi = {
  login: async (email: string, password: string): Promise<LoginResponse> => {
    const normalizedEmail = email.trim().toLowerCase()
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    })
    if (signInError || !signInData.session) {
      await supabase.rpc('log_login_failed', { p_email: normalizedEmail, p_reason: 'invalid_credentials' })
      throw new ApiError(401, { error: { code: 'INVALID_CREDENTIALS', message: 'Email atau password tidak valid.' } })
    }
    const { data: profile } = await supabase.rpc('me')
    if (!profile) {
      await supabase.auth.signOut()
      throw new ApiError(401, { error: { code: 'INVALID_CREDENTIALS', message: 'Email atau password tidak valid.' } })
    }
    if (!profile.is_active) {
      await supabase.rpc('log_login_inactive')
      await supabase.auth.signOut()
      throw new ApiError(401, { error: { code: 'USER_INACTIVE', message: 'Akun tidak aktif.' } })
    }
    const { data: updatedProfile } = await supabase.rpc('login_success')
    return {
      access_token: signInData.session.access_token,
      token_type: 'bearer',
      expires_in: signInData.session.expires_in ?? 3600,
      user: (updatedProfile ?? profile) as AuthUser,
    }
  },
  me: async (): Promise<AuthUser> => {
    const { data, error } = await supabase.rpc('me')
    if (error) throw toApiError(error)
    if (!data) throw new ApiError(401, { error: { code: 'UNAUTHORIZED', message: 'Token tidak valid atau tidak tersedia.' } })
    return data as AuthUser
  },
  logout: async () => {
    try {
      await supabase.rpc('logout_event')
    } finally {
      await supabase.auth.signOut()
    }
  },
}

export const userApi = {
  list: async (search = '', page = 1, page_size = 25): Promise<PaginatedResponse<AuthUser>> => {
    let query = supabase.from('profiles').select('*', { count: 'exact' })
    if (search) {
      const term = orTerm(search)
      query = query.or(`name.ilike."${term}",email.ilike."${term}"`)
    }
    const from = (page - 1) * page_size
    const to = from + page_size - 1
    const { data, error, count } = await query.order('created_at', { ascending: false }).range(from, to)
    if (error) throw toApiError(error)
    const total = count ?? 0
    return { items: (data ?? []) as AuthUser[], total, page, page_size, pages: total ? Math.ceil(total / page_size) : 0 }
  },
  create: async (payload: UserFormValues & { password: string }): Promise<AuthUser> => {
    const { data, error } = await supabase.rpc('create_user', {
      p_name: payload.name,
      p_email: payload.email,
      p_password: payload.password,
      p_role: payload.role,
      p_is_active: payload.is_active,
    })
    if (error) throw toApiError(error)
    return data as AuthUser
  },
  update: async (id: string, payload: UserFormValues): Promise<AuthUser> => {
    const { data, error } = await supabase.rpc('update_user', {
      p_id: id,
      p_name: payload.name,
      p_email: payload.email,
      p_role: payload.role,
      p_is_active: payload.is_active,
      p_password: payload.password || null,
    })
    if (error) throw toApiError(error)
    return data as AuthUser
  },
  deactivate: async (id: string): Promise<void> => {
    const { error } = await supabase.rpc('deactivate_user', { p_id: id })
    if (error) throw toApiError(error)
  },
}

export interface AuditFilters {
  action?: string
  entity_type?: string
  user_id?: string
  date_from?: string
  date_to?: string
  page?: number
  page_size?: number
}

export const auditApi = {
  list: async (filters: AuditFilters = {}): Promise<PaginatedResponse<AuditLog>> => {
    const { action, entity_type, user_id, date_from, date_to, page = 1, page_size = 25 } = filters
    let query = supabase.from('audit_logs').select('*', { count: 'exact' })
    if (action) query = query.eq('action', action)
    if (entity_type) query = query.eq('entity_type', entity_type)
    if (user_id) query = query.eq('user_id', user_id)
    if (date_from) query = query.gte('created_at', `${date_from}T00:00:00Z`)
    if (date_to) query = query.lte('created_at', `${date_to}T23:59:59.999Z`)
    const from = (page - 1) * page_size
    const to = from + page_size - 1
    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(from, to)
    if (error) throw toApiError(error)
    const total = count ?? 0
    return { items: (data ?? []) as AuditLog[], total, page, page_size, pages: total ? Math.ceil(total / page_size) : 0 }
  },
}

async function styledWorkbookBlob(sheetName: string, headers: string[], rows: (string | number)[][]): Promise<Blob> {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet(sheetName)
  sheet.addRow(headers)
  rows.forEach((row) => sheet.addRow(row))
  sheet.getRow(1).eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4ED8' } }
    cell.font = { color: { argb: 'FFFFFFFF' }, bold: true }
    cell.alignment = { horizontal: 'center' }
  })
  sheet.views = [{ state: 'frozen', ySplit: 1 }]
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: headers.length } }
  sheet.columns.forEach((column) => {
    let maxLength = 0
    column.eachCell?.({ includeEmpty: true }, (cell) => {
      maxLength = Math.max(maxLength, String(cell.value ?? '').length)
    })
    column.width = Math.min(Math.max(maxLength + 2, 12), 42)
  })
  const buffer = await workbook.xlsx.writeBuffer()
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}

export interface LeaveExportFilters {
  month?: number
  year?: number
  date_from?: string
  date_to?: string
  employee_id?: string | number
  leave_type?: string
}

export const exportApi = {
  employees: async (): Promise<{ blob: Blob; filename: string }> => {
    const { data, error } = await supabase.from('employees').select('*').order('nama', { ascending: true })
    if (error) throw toApiError(error)
    const items = data ?? []
    const rows = items.map((item) => [
      item.id, item.nama, item.jabatan, item.departemen, item.tanggal_masuk,
      item.status_aktif ? 'Aktif' : 'Tidak Aktif', item.created_at, item.updated_at,
    ])
    const blob = await styledWorkbookBlob(
      'Data Karyawan',
      ['ID', 'Nama', 'Jabatan', 'Departemen', 'Tanggal Masuk', 'Status Aktif', 'Dibuat', 'Diperbarui'],
      rows,
    )
    await supabase.rpc('log_export', { p_entity_type: 'EMPLOYEE', p_row_count: items.length, p_filters: null })
    return { blob, filename: `data-karyawan-${todayIso()}.xlsx` }
  },
  leaves: async (filters: LeaveExportFilters = {}): Promise<{ blob: Blob; filename: string }> => {
    let query = supabase.from('employee_leaves').select(LEAVE_SELECT)
    if (filters.month && filters.year) {
      const periodStart = `${filters.year}-${String(filters.month).padStart(2, '0')}-01`
      query = query.lte('start_date', lastDayOfMonth(filters.year, filters.month)).gte('end_date', periodStart)
    }
    if (filters.date_from) query = query.gte('end_date', filters.date_from)
    if (filters.date_to) query = query.lte('start_date', filters.date_to)
    if (filters.employee_id) query = query.eq('employee_id', Number(filters.employee_id))
    if (filters.leave_type) query = query.eq('leave_type', filters.leave_type)
    const { data, error } = await query.order('start_date', { ascending: false })
    if (error) throw toApiError(error)
    const items = (data ?? []) as unknown as LeaveRecord[]
    const rows = items.map((item) => [
      item.id, item.employee?.nama ?? '', item.employee?.departemen ?? '', item.leave_type,
      item.start_date, item.end_date, item.total_days, item.description ?? '',
    ])
    const blob = await styledWorkbookBlob(
      'Data Cuti Karyawan',
      ['ID', 'Karyawan', 'Departemen', 'Jenis Cuti', 'Tanggal Mulai', 'Tanggal Selesai', 'Total Hari', 'Keterangan'],
      rows,
    )
    await supabase.rpc('log_export', {
      p_entity_type: 'EMPLOYEE_LEAVE',
      p_row_count: items.length,
      p_filters: filters as unknown as Record<string, unknown>,
    })
    return { blob, filename: `data-cuti-karyawan-${todayIso()}.xlsx` }
  },
  auditLogs: async (filters: AuditFilters = {}): Promise<{ blob: Blob; filename: string }> => {
    let query = supabase.from('audit_logs').select('*')
    if (filters.action) query = query.eq('action', filters.action)
    if (filters.entity_type) query = query.eq('entity_type', filters.entity_type)
    if (filters.user_id) query = query.eq('user_id', filters.user_id)
    if (filters.date_from) query = query.gte('created_at', `${filters.date_from}T00:00:00Z`)
    if (filters.date_to) query = query.lte('created_at', `${filters.date_to}T23:59:59.999Z`)
    const { data, error } = await query.order('created_at', { ascending: false })
    if (error) throw toApiError(error)
    const items = data ?? []
    const rows = items.map((item) => [
      item.id, item.created_at, item.user_name, item.user_email, item.action,
      item.entity_type, item.entity_id ?? '', item.ip_address ?? '',
    ])
    const blob = await styledWorkbookBlob(
      'Audit Log',
      ['ID', 'Waktu', 'User', 'Email', 'Action', 'Entity', 'Entity ID', 'IP Address'],
      rows,
    )
    await supabase.rpc('log_export', { p_entity_type: 'AUDIT_LOG', p_row_count: items.length, p_filters: null })
    return { blob, filename: `audit-log-${todayIso()}.xlsx` }
  },
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}
