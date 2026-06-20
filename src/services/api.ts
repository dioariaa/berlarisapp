import type {
  ApiErrorBody,
  AuditLog,
  AuthUser,
  Employee,
  EmployeeFormValues,
  DashboardSummary,
  EmployeeLeaveAggregate,
  LeaveFormValues,
  LeaveRecord,
  LeaveSummary,
  LoginResponse,
  PaginatedResponse,
  UserFormValues,
} from '../types'

const rawApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim()
if (!rawApiBaseUrl) {
  throw new Error('VITE_API_BASE_URL belum dikonfigurasi.')
}
const API_BASE_URL = rawApiBaseUrl.replace(/\/$/, '')
const REQUEST_TIMEOUT_MS = Number(import.meta.env.VITE_API_TIMEOUT_MS || 15000)
let accessToken = sessionStorage.getItem('admin_access_token')

export function setAccessToken(token: string | null) {
  accessToken = token
  if (token) sessionStorage.setItem('admin_access_token', token)
  else sessionStorage.removeItem('admin_access_token')
}

export function hasAccessToken() {
  return Boolean(accessToken)
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

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...options?.headers,
      },
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('Permintaan ke server melebihi batas waktu. Silakan coba lagi.')
    }
    throw new Error('Tidak dapat terhubung ke server. Pastikan backend sedang berjalan.')
  } finally {
    window.clearTimeout(timeout)
  }

  if (!response.ok) {
    let body: ApiErrorBody = {}
    try {
      body = await response.json() as ApiErrorBody
    } catch {
      body = {
        error: {
          code: 'INVALID_SERVER_RESPONSE',
          message: `Server merespons dengan status ${response.status}.`,
        },
      }
    }
    if (response.status === 401 && !path.endsWith('/auth/login')) {
      setAccessToken(null)
      window.dispatchEvent(new CustomEvent('auth:expired'))
    }
    throw new ApiError(response.status, body)
  }

  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

async function requestBlob(path: string): Promise<{ blob: Blob; filename: string }> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      signal: controller.signal,
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    })
    if (!response.ok) {
      const body = await response.json().catch(() => ({
        error: { code: 'EXPORT_FAILED', message: 'Export tidak dapat diproses.' },
      })) as ApiErrorBody
      if (response.status === 401) {
        setAccessToken(null)
        window.dispatchEvent(new CustomEvent('auth:expired'))
      }
      throw new ApiError(response.status, body)
    }
    const disposition = response.headers.get('content-disposition') || ''
    const encoded = disposition.match(/filename\*=UTF-8''([^;]+)/)?.[1]
    return {
      blob: await response.blob(),
      filename: encoded ? decodeURIComponent(encoded) : 'export.xlsx',
    }
  } catch (error) {
    if (error instanceof ApiError) throw error
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('Proses export melebihi batas waktu. Silakan coba lagi.')
    }
    throw new Error('Tidak dapat terhubung ke server export.')
  } finally {
    window.clearTimeout(timeout)
  }
}

function queryString(params: object): string {
  const query = new URLSearchParams()
  Object.entries(params as Record<string, string | number | boolean | undefined>).forEach(([key, value]) => {
    if (value !== undefined && value !== '') query.set(key, String(value))
  })
  const value = query.toString()
  return value ? `?${value}` : ''
}

export const employeeApi = {
  list: (search?: string, status_aktif?: boolean, page = 1, page_size = 100) =>
    request<PaginatedResponse<Employee>>(`/employees${queryString({ search, status_aktif: status_aktif === undefined ? undefined : String(status_aktif), page, page_size })}`),
  get: (id: number) => request<Employee>(`/employees/${id}`),
  create: (payload: EmployeeFormValues) =>
    request<Employee>('/employees', { method: 'POST', body: JSON.stringify(payload) }),
  update: (id: number, payload: EmployeeFormValues) =>
    request<Employee>(`/employees/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  remove: (id: number) =>
    request<void>(`/employees/${id}`, { method: 'DELETE' }),
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
  list: (filters: LeaveFilters = {}) =>
    request<PaginatedResponse<LeaveRecord>>(`/employee-leaves${queryString(filters)}`),
  get: (id: number) => request<LeaveRecord>(`/employee-leaves/${id}`),
  summary: (month: number, year: number) =>
    request<LeaveSummary>(`/employee-leaves/summary${queryString({ month, year })}`),
  byEmployee: (month: number, year: number, employee_id?: number, include_zero = false) =>
    request<EmployeeLeaveAggregate[]>(
      `/employee-leaves/by-employee${queryString({ month, year, employee_id, include_zero })}`,
    ),
  create: (payload: LeaveFormValues) =>
    request<LeaveRecord>('/employee-leaves', { method: 'POST', body: JSON.stringify(payload) }),
  update: (id: number, payload: LeaveFormValues) =>
    request<LeaveRecord>(`/employee-leaves/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  remove: (id: number) =>
    request<void>(`/employee-leaves/${id}`, { method: 'DELETE' }),
}

export const dashboardApi = {
  summary: (month: number, year: number) =>
    request<DashboardSummary>(`/dashboard/summary${queryString({ month, year })}`),
}

export const authApi = {
  login: async (email: string, password: string) => {
    const result = await request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
    setAccessToken(result.access_token)
    return result
  },
  me: () => request<AuthUser>('/auth/me'),
  logout: async () => {
    try {
      await request<void>('/auth/logout', { method: 'POST' })
    } finally {
      setAccessToken(null)
    }
  },
}

export const userApi = {
  list: (search = '', page = 1, page_size = 25) =>
    request<PaginatedResponse<AuthUser>>(`/users${queryString({ search, page, page_size })}`),
  create: (payload: UserFormValues & { password: string }) =>
    request<AuthUser>('/users', { method: 'POST', body: JSON.stringify(payload) }),
  update: (id: number, payload: UserFormValues) =>
    request<AuthUser>(`/users/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deactivate: (id: number) => request<void>(`/users/${id}`, { method: 'DELETE' }),
}

export interface AuditFilters {
  action?: string
  entity_type?: string
  user_id?: number
  date_from?: string
  date_to?: string
  page?: number
  page_size?: number
}

export const auditApi = {
  list: (filters: AuditFilters = {}) =>
    request<PaginatedResponse<AuditLog>>(`/audit-logs${queryString(filters)}`),
}

export const exportApi = {
  employees: () => requestBlob('/exports/employees.xlsx'),
  leaves: (filters: object = {}) =>
    requestBlob(`/exports/employee-leaves.xlsx${queryString(filters)}`),
  auditLogs: (filters: object = {}) =>
    requestBlob(`/exports/audit-logs.xlsx${queryString(filters)}`),
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
