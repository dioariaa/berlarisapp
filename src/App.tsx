import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarDays, FileDown, FilterX, Plus, Search, Users } from 'lucide-react'
import { AdminLayout } from './components/AdminLayout'
import { AuditLogPage, type AuditFilterState } from './components/AuditLogPage'
import { DeleteDialog } from './components/DeleteDialog'
import { DashboardPage } from './components/DashboardPage'
import { EmployeeDeleteDialog } from './components/EmployeeDeleteDialog'
import { EmployeeFormModal } from './components/EmployeeFormModal'
import { EmployeeTable } from './components/EmployeeTable'
import { ErrorState } from './components/ErrorState'
import { ForbiddenState } from './components/ForbiddenState'
import { LeaveFormModal } from './components/LeaveFormModal'
import { LeaveTable } from './components/LeaveTable'
import { LoadingState } from './components/LoadingState'
import { LoginPage } from './components/LoginPage'
import { SummaryCards } from './components/SummaryCards'
import { UserManagementPage } from './components/UserManagementPage'
import {
  ApiError,
  auditApi,
  authApi,
  dashboardApi,
  downloadBlob,
  employeeApi,
  exportApi,
  hasAccessToken,
  leaveApi,
  userApi,
} from './services/api'
import {
  type AuditLog,
  type AuthUser,
  LEAVE_TYPES,
  type Employee,
  type EmployeeLeaveAggregate,
  type DashboardSummary,
  type EmployeeFormValues,
  type LeaveFormValues,
  type LeaveRecord,
  type LeaveSummary,
  type UserFormValues,
} from './types'
import { formatMonth, recordOverlapsMonth } from './utils/date'

type Page = 'dashboard' | 'employees' | 'leaves' | 'users' | 'audit'

const emptySummary: LeaveSummary = {
  month: new Date().getMonth() + 1,
  year: new Date().getFullYear(),
  total_cuti_bulan_ini: 0,
  karyawan_sedang_cuti_hari_ini: 0,
  total_hari_cuti_terpakai_bulan_ini: 0,
  jumlah_per_jenis_cuti: LEAVE_TYPES.map((leave_type) => ({ leave_type, total: 0 })),
  karyawan_dengan_cuti_terbanyak: [],
}

function App() {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [authError, setAuthError] = useState('')
  const [page, setPage] = useState<Page>('dashboard')
  const [employees, setEmployees] = useState<Employee[]>([])
  const [leaves, setLeaves] = useState<LeaveRecord[]>([])
  const [summary, setSummary] = useState<LeaveSummary>(emptySummary)
  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null)
  const [employeeAggregates, setEmployeeAggregates] = useState<EmployeeLeaveAggregate[]>([])
  const [dashboardLoading, setDashboardLoading] = useState(true)
  const [dashboardError, setDashboardError] = useState('')
  const [dashboardMonth, setDashboardMonth] = useState(new Date().getMonth() + 1)
  const [dashboardYear, setDashboardYear] = useState(new Date().getFullYear())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const [search, setSearch] = useState('')
  const [employeeFilter, setEmployeeFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [monthFilter, setMonthFilter] = useState('')
  const [rangeStart, setRangeStart] = useState('')
  const [rangeEnd, setRangeEnd] = useState('')
  const [employeeSearch, setEmployeeSearch] = useState('')
  const [employeeStatusFilter, setEmployeeStatusFilter] = useState('')
  const [adminUsers, setAdminUsers] = useState<AuthUser[]>([])
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [auditPage, setAuditPage] = useState(1)
  const [auditPages, setAuditPages] = useState(0)
  const [auditFilters, setAuditFilters] = useState<AuditFilterState>({ action: '', entity_type: '', date_from: '', date_to: '' })
  const [privilegedLoading, setPrivilegedLoading] = useState(false)
  const [privilegedError, setPrivilegedError] = useState('')
  const [exporting, setExporting] = useState(false)

  const [leaveModal, setLeaveModal] = useState<{ open: boolean; record: LeaveRecord | null }>({ open: false, record: null })
  const [deleteLeave, setDeleteLeave] = useState<LeaveRecord | null>(null)
  const [employeeModal, setEmployeeModal] = useState<{ open: boolean; employee: Employee | null }>({ open: false, employee: null })
  const [deleteEmployee, setDeleteEmployee] = useState<Employee | null>(null)
  const [pendingOverlap, setPendingOverlap] = useState<LeaveFormValues | null>(null)
  const [overlapMessage, setOverlapMessage] = useState('')

  const selectedPeriod = useMemo(() => {
    if (monthFilter) {
      const [year, month] = monthFilter.split('-').map(Number)
      return { month, year }
    }
    const now = new Date()
    return { month: now.getMonth() + 1, year: now.getFullYear() }
  }, [monthFilter])

  useEffect(() => {
    const restore = async () => {
      if (!hasAccessToken()) {
        setAuthLoading(false)
        return
      }
      try {
        setCurrentUser(await authApi.me())
      } catch {
        setCurrentUser(null)
      } finally {
        setAuthLoading(false)
      }
    }
    const expired = () => {
      setCurrentUser(null)
      setPage('dashboard')
      setAuthError('Sesi Anda telah berakhir. Silakan login kembali.')
    }
    window.addEventListener('auth:expired', expired)
    void restore()
    return () => window.removeEventListener('auth:expired', expired)
  }, [])

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [employeeData, leaveData, summaryData] = await Promise.all([
        employeeApi.list(),
        leaveApi.list({ page_size: 100 }),
        leaveApi.summary(selectedPeriod.month, selectedPeriod.year),
      ])
      setEmployees(employeeData.items)
      setLeaves(leaveData.items)
      setSummary(summaryData)
    } catch (caught) {
      setError(getErrorMessage(caught))
    } finally {
      setLoading(false)
    }
  }, [selectedPeriod.month, selectedPeriod.year])

  useEffect(() => {
    if (currentUser) void loadData()
  }, [currentUser, loadData])

  const loadDashboard = useCallback(async () => {
    setDashboardLoading(true)
    setDashboardError('')
    try {
      const [dashboardData, aggregateData] = await Promise.all([
        dashboardApi.summary(dashboardMonth, dashboardYear),
        leaveApi.byEmployee(dashboardMonth, dashboardYear),
      ])
      setDashboard(dashboardData)
      setEmployeeAggregates(aggregateData)
    } catch (caught) {
      setDashboardError(getErrorMessage(caught))
    } finally {
      setDashboardLoading(false)
    }
  }, [dashboardMonth, dashboardYear])

  useEffect(() => {
    if (currentUser) void loadDashboard()
  }, [currentUser, loadDashboard])

  const loadUsers = useCallback(async () => {
    setPrivilegedLoading(true)
    setPrivilegedError('')
    try {
      const result = await userApi.list('', 1, 100)
      setAdminUsers(result.items)
    } catch (caught) {
      setPrivilegedError(getErrorMessage(caught))
    } finally {
      setPrivilegedLoading(false)
    }
  }, [])

  const loadAuditLogs = useCallback(async () => {
    setPrivilegedLoading(true)
    setPrivilegedError('')
    try {
      const result = await auditApi.list({ ...auditFilters, page: auditPage, page_size: 25 })
      setAuditLogs(result.items)
      setAuditPages(result.pages)
    } catch (caught) {
      setPrivilegedError(getErrorMessage(caught))
    } finally {
      setPrivilegedLoading(false)
    }
  }, [auditFilters, auditPage])

  useEffect(() => {
    if (currentUser?.role !== 'superadmin') return
    if (page === 'users') void loadUsers()
    if (page === 'audit') void loadAuditLogs()
  }, [currentUser, loadAuditLogs, loadUsers, page])

  const refreshLeaves = async () => {
    const [leaveData, summaryData] = await Promise.all([
      leaveApi.list({ page_size: 100 }),
      leaveApi.summary(selectedPeriod.month, selectedPeriod.year),
    ])
    setLeaves(leaveData.items)
    setSummary(summaryData)
    await loadDashboard()
  }

  const notify = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type })
    window.setTimeout(() => setToast(null), 3000)
  }

  const filteredLeaves = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('id-ID')
    return leaves.filter((record) => {
      const matchesSearch = !term
        || record.employee.nama.toLocaleLowerCase('id-ID').includes(term)
        || (record.description || '').toLocaleLowerCase('id-ID').includes(term)
      const matchesEmployee = !employeeFilter || record.employee_id === Number(employeeFilter)
      const matchesType = !typeFilter || record.leave_type === typeFilter
      const matchesMonth = recordOverlapsMonth(record.start_date, record.end_date, monthFilter)
      const matchesStart = !rangeStart || record.end_date >= rangeStart
      const matchesEnd = !rangeEnd || record.start_date <= rangeEnd
      return matchesSearch && matchesEmployee && matchesType && matchesMonth && matchesStart && matchesEnd
    })
  }, [employeeFilter, leaves, monthFilter, rangeEnd, rangeStart, search, typeFilter])

  const filteredEmployees = useMemo(() => {
    const term = employeeSearch.trim().toLocaleLowerCase('id-ID')
    return employees.filter((employee) =>
      !term || [employee.nama, employee.jabatan, employee.departemen]
        .some((value) => value.toLocaleLowerCase('id-ID').includes(term)),
    )
  }, [employeeSearch, employees])

  const hasFilters = Boolean(search || employeeFilter || typeFilter || monthFilter || rangeStart || rangeEnd)
  const clearFilters = () => {
    setSearch('')
    setEmployeeFilter('')
    setTypeFilter('')
    setMonthFilter('')
    setRangeStart('')
    setRangeEnd('')
  }

  const saveLeave = async (values: LeaveFormValues) => {
    setSubmitting(true)
    setFormError('')
    setOverlapMessage('')
    try {
      if (leaveModal.record) await leaveApi.update(leaveModal.record.id, values)
      else await leaveApi.create(values)
      await refreshLeaves()
      setLeaveModal({ open: false, record: null })
      setPendingOverlap(null)
      notify(leaveModal.record ? 'Perubahan data cuti berhasil disimpan.' : 'Data cuti berhasil ditambahkan.')
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 409) {
        const detail = caught.body.error?.details
        if (!detail || Array.isArray(detail)) {
          setFormError(caught.message)
          return
        }
        setPendingOverlap(values)
        setOverlapMessage(
          `${caught.message} Periode yang sudah ada: ${detail.overlap_start_date} s.d. ${detail.overlap_end_date}.`,
        )
      } else {
        setFormError(getErrorMessage(caught))
      }
    } finally {
      setSubmitting(false)
    }
  }

  const confirmOverlap = () => {
    if (pendingOverlap) void saveLeave({ ...pendingOverlap, override_overlap: true })
  }

  const removeLeave = async () => {
    if (!deleteLeave) return
    setSubmitting(true)
    try {
      await leaveApi.remove(deleteLeave.id)
      await refreshLeaves()
      setDeleteLeave(null)
      notify('Data cuti berhasil dihapus.')
    } catch (caught) {
      notify(getErrorMessage(caught), 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const saveEmployee = async (values: EmployeeFormValues) => {
    setSubmitting(true)
    setFormError('')
    try {
      if (employeeModal.employee) await employeeApi.update(employeeModal.employee.id, values)
      else await employeeApi.create(values)
      const employeeData = await employeeApi.list()
      setEmployees(employeeData.items)
      await loadDashboard()
      setEmployeeModal({ open: false, employee: null })
      notify(employeeModal.employee ? 'Data karyawan berhasil diperbarui.' : 'Karyawan berhasil ditambahkan.')
    } catch (caught) {
      setFormError(getErrorMessage(caught))
    } finally {
      setSubmitting(false)
    }
  }

  const removeEmployee = async () => {
    if (!deleteEmployee) return
    setSubmitting(true)
    try {
      await employeeApi.remove(deleteEmployee.id)
      const [employeeData, leaveData] = await Promise.all([
        employeeApi.list(),
        leaveApi.list({ page_size: 100 }),
      ])
      setEmployees(employeeData.items)
      setLeaves(leaveData.items)
      await loadDashboard()
      setDeleteEmployee(null)
      notify('Data karyawan berhasil dihapus.')
    } catch (caught) {
      notify(getErrorMessage(caught), 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const navigate = (nextPage: Page) => {
    setPage(nextPage)
    setFormError('')
  }

  const login = async (email: string, password: string) => {
    setAuthLoading(true)
    setAuthError('')
    try {
      const result = await authApi.login(email, password)
      setCurrentUser(result.user)
      setPage('dashboard')
    } catch (caught) {
      setAuthError(getErrorMessage(caught))
    } finally {
      setAuthLoading(false)
    }
  }

  const logout = async () => {
    try {
      await authApi.logout()
    } finally {
      setCurrentUser(null)
      setPage('dashboard')
      setEmployees([])
      setLeaves([])
      setDashboard(null)
      setEmployeeAggregates([])
    }
  }

  const saveUser = async (id: number | null, values: UserFormValues) => {
    setSubmitting(true)
    try {
      if (id) await userApi.update(id, values)
      else await userApi.create(values as UserFormValues & { password: string })
      await loadUsers()
      notify(id ? 'Data user berhasil diperbarui.' : 'User berhasil dibuat.')
    } catch (caught) {
      notify(getErrorMessage(caught), 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const deactivateUser = async (user: AuthUser) => {
    setSubmitting(true)
    try {
      await userApi.deactivate(user.id)
      await loadUsers()
      notify('User berhasil dinonaktifkan.')
    } catch (caught) {
      notify(getErrorMessage(caught), 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const runExport = async (kind: 'employees' | 'leaves' | 'audit') => {
    setExporting(true)
    try {
      const result = kind === 'employees'
        ? await exportApi.employees()
        : kind === 'leaves'
          ? await exportApi.leaves({
              month: monthFilter ? selectedPeriod.month : undefined,
              year: monthFilter ? selectedPeriod.year : undefined,
              date_from: rangeStart || undefined,
              date_to: rangeEnd || undefined,
              employee_id: employeeFilter || undefined,
              leave_type: typeFilter || undefined,
            })
          : await exportApi.auditLogs(auditFilters)
      downloadBlob(result.blob, result.filename)
      notify('File Excel berhasil disiapkan.')
      if (page === 'audit') await loadAuditLogs()
    } catch (caught) {
      notify(getErrorMessage(caught), 'error')
    } finally {
      setExporting(false)
    }
  }

  if (authLoading && !currentUser) return <LoadingState label="Memverifikasi sesi..." />
  if (!currentUser) return <LoginPage loading={authLoading} error={authError} onLogin={(email, password) => void login(email, password)} />

  return (
    <AdminLayout activePage={page} onNavigate={navigate} user={currentUser} onLogout={() => void logout()}>
      {page === 'dashboard' ? (
        <DashboardPage
          data={dashboard}
          aggregates={employeeAggregates}
          loading={dashboardLoading}
          error={dashboardError}
          month={dashboardMonth}
          year={dashboardYear}
          onPeriodChange={(month, year) => {
            setDashboardMonth(month)
            setDashboardYear(year)
          }}
          onResetPeriod={() => {
            const now = new Date()
            setDashboardMonth(now.getMonth() + 1)
            setDashboardYear(now.getFullYear())
          }}
          onRetry={() => void loadDashboard()}
          onNavigate={navigate}
        />
      ) : page === 'users' ? (
        currentUser.role === 'superadmin'
          ? <UserManagementPage users={adminUsers} loading={privilegedLoading} error={privilegedError} submitting={submitting} onRetry={() => void loadUsers()} onSave={(id, values) => void saveUser(id, values)} onDeactivate={(user) => void deactivateUser(user)} />
          : <ForbiddenState onBack={() => navigate('dashboard')} />
      ) : page === 'audit' ? (
        currentUser.role === 'superadmin'
          ? <AuditLogPage logs={auditLogs} loading={privilegedLoading} error={privilegedError} filters={auditFilters} page={auditPage} pages={auditPages} exporting={exporting} onFilters={(filters) => { setAuditFilters(filters); setAuditPage(1) }} onPage={setAuditPage} onRetry={() => void loadAuditLogs()} onExport={() => void runExport('audit')} />
          : <ForbiddenState onBack={() => navigate('dashboard')} />
      ) : page === 'leaves' ? (
        <>
          <PageHeading
            eyebrow="MANAJEMEN CUTI"
            title="Data Cuti Karyawan"
            description="Kelola dan pantau seluruh catatan cuti karyawan."
            action="Tambah Data Cuti"
            secondaryAction="Export Excel"
            secondaryLoading={exporting}
            onSecondary={() => void runExport('leaves')}
            onAction={() => {
              setFormError('')
              setPendingOverlap(null)
              setOverlapMessage('')
              setLeaveModal({ open: true, record: null })
            }}
            disabled={!employees.length}
          />
          {loading ? <LoadingState label="Memuat data cuti..." /> : error ? <ErrorState message={error} onRetry={() => void loadData()} /> : (
            <>
              <SummaryCards
                monthlyCount={summary.total_cuti_bulan_ini}
                activeToday={summary.karyawan_sedang_cuti_hari_ini}
                usedDays={summary.total_hari_cuti_terpakai_bulan_ini}
                monthLabel={formatMonth(new Date(selectedPeriod.year, selectedPeriod.month - 1))}
              />
              <SummaryDetails summary={summary} />
              <section className="data-card">
                <div className="data-card__header">
                  <div><h2>Daftar Data Cuti</h2><p>{filteredLeaves.length} data ditampilkan</p></div>
                  <button className="button button--primary data-card__mobile-add" disabled={!employees.length} onClick={() => setLeaveModal({ open: true, record: null })}><Plus size={17} /> Tambah</button>
                </div>
                <div className="filters filters--advanced">
                  <div className="filter-control filter-control--employee"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari nama atau keterangan" aria-label="Cari data cuti" /></div>
                  <div className="filter-control">
                    <select value={employeeFilter} onChange={(event) => setEmployeeFilter(event.target.value)} aria-label="Filter nama karyawan">
                      <option value="">Semua karyawan</option>
                      {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.nama}</option>)}
                    </select>
                  </div>
                  <div className="filter-control">
                    <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} aria-label="Filter jenis cuti">
                      <option value="">Semua jenis cuti</option>
                      {LEAVE_TYPES.map((type) => <option key={type}>{type}</option>)}
                    </select>
                  </div>
                  <div className="filter-control filter-control--month"><CalendarDays size={17} /><input type="month" value={monthFilter} onChange={(event) => setMonthFilter(event.target.value)} aria-label="Filter bulan dan tahun" /></div>
                  <div className="range-filters">
                    <input type="date" value={rangeStart} max={rangeEnd || undefined} onChange={(event) => setRangeStart(event.target.value)} aria-label="Rentang tanggal mulai" />
                    <span>—</span>
                    <input type="date" value={rangeEnd} min={rangeStart || undefined} onChange={(event) => setRangeEnd(event.target.value)} aria-label="Rentang tanggal selesai" />
                  </div>
                  {hasFilters && <button className="clear-filter" onClick={clearFilters}><FilterX size={16} /> Hapus filter</button>}
                </div>
                {!employees.length && (
                  <div className="inline-notice"><Users size={17} /> Tambahkan data karyawan sebelum mencatat cuti.</div>
                )}
                <LeaveTable
                  records={filteredLeaves}
                  hasFilters={hasFilters}
                  onAdd={() => setLeaveModal({ open: true, record: null })}
                  onEdit={(record) => {
                    setFormError('')
                    setPendingOverlap(null)
                    setOverlapMessage('')
                    setLeaveModal({ open: true, record })
                  }}
                  onDelete={setDeleteLeave}
                  onClearFilters={clearFilters}
                />
              </section>
            </>
          )}
        </>
      ) : (
        <>
          <PageHeading
            eyebrow="MASTER DATA"
            title="Data Karyawan"
            description="Kelola data karyawan yang digunakan pada pencatatan cuti."
            action="Tambah Karyawan"
            secondaryAction="Export Excel"
            secondaryLoading={exporting}
            onSecondary={() => void runExport('employees')}
            onAction={() => {
              setFormError('')
              setEmployeeModal({ open: true, employee: null })
            }}
          />
          {loading ? <LoadingState label="Memuat data karyawan..." /> : error ? <ErrorState message={error} onRetry={() => void loadData()} /> : (
            <section className="data-card">
              <div className="data-card__header"><div><h2>Daftar Karyawan</h2><p>{filteredEmployees.length} karyawan ditampilkan</p></div></div>
              <div className="filters">
                <div className="filter-control filter-control--employee"><Search size={17} /><input value={employeeSearch} onChange={(event) => setEmployeeSearch(event.target.value)} placeholder="Cari nama, jabatan, atau departemen" aria-label="Cari karyawan" /></div>
                <div className="filter-control">
                  <select value={employeeStatusFilter} onChange={(event) => setEmployeeStatusFilter(event.target.value)} aria-label="Filter status karyawan">
                    <option value="">Semua status</option>
                    <option value="active">Aktif</option>
                    <option value="inactive">Tidak aktif</option>
                  </select>
                </div>
              </div>
              <EmployeeTable
                employees={filteredEmployees.filter((employee) =>
                  !employeeStatusFilter
                  || (employeeStatusFilter === 'active' ? employee.status_aktif : !employee.status_aktif),
                )}
                onAdd={() => setEmployeeModal({ open: true, employee: null })}
                onEdit={(employee) => {
                  setFormError('')
                  setEmployeeModal({ open: true, employee })
                }}
                onDelete={setDeleteEmployee}
              />
            </section>
          )}
        </>
      )}

      {leaveModal.open && (
        <LeaveFormModal
          record={leaveModal.record}
          employees={employees}
          submitting={submitting}
          serverError={formError}
          overlapMessage={overlapMessage}
          onConfirmOverlap={confirmOverlap}
          onClose={() => setLeaveModal({ open: false, record: null })}
          onSubmit={(values) => void saveLeave(values)}
        />
      )}
      {deleteLeave && <DeleteDialog record={deleteLeave} onCancel={() => setDeleteLeave(null)} onConfirm={() => void removeLeave()} />}
      {employeeModal.open && (
        <EmployeeFormModal
          employee={employeeModal.employee}
          submitting={submitting}
          serverError={formError}
          onClose={() => setEmployeeModal({ open: false, employee: null })}
          onSubmit={(values) => void saveEmployee(values)}
        />
      )}
      {deleteEmployee && <EmployeeDeleteDialog employee={deleteEmployee} deleting={submitting} onCancel={() => setDeleteEmployee(null)} onConfirm={() => void removeEmployee()} />}
      {toast && <div className={`toast toast--${toast.type}`} role="status"><span>{toast.type === 'success' ? '✓' : '!'}</span>{toast.message}</div>}
    </AdminLayout>
  )
}

function PageHeading({
  eyebrow,
  title,
  description,
  action,
  onAction,
  secondaryAction,
  onSecondary,
  secondaryLoading = false,
  disabled = false,
}: {
  eyebrow: string
  title: string
  description: string
  action: string
  onAction: () => void
  secondaryAction?: string
  onSecondary?: () => void
  secondaryLoading?: boolean
  disabled?: boolean
}) {
  return (
    <div className="page-heading">
      <div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>
      <div className="page-heading__actions">
        {secondaryAction && <button className="button button--secondary" onClick={onSecondary} disabled={secondaryLoading}><FileDown size={17} />{secondaryLoading ? 'Menyiapkan...' : secondaryAction}</button>}
        <button className="button button--primary page-heading__action" onClick={onAction} disabled={disabled}><Plus size={18} />{action}</button>
      </div>
    </div>
  )
}

function SummaryDetails({ summary }: { summary: LeaveSummary }) {
  const maxCount = Math.max(1, ...summary.jumlah_per_jenis_cuti.map((item) => item.total))
  return (
    <section className="summary-details">
      <article>
        <div className="summary-details__heading"><h3>Cuti per jenis</h3><span>Periode terpilih</span></div>
        <div className="type-bars">
          {summary.jumlah_per_jenis_cuti.map((item) => (
            <div className="type-bar" key={item.leave_type}>
              <span>{item.leave_type}</span>
              <div><i style={{ width: `${(item.total / maxCount) * 100}%` }} /></div>
              <strong>{item.total}</strong>
            </div>
          ))}
        </div>
      </article>
      <article>
        <div className="summary-details__heading"><h3>Cuti terbanyak</h3><span>Berdasarkan jumlah hari</span></div>
        {summary.karyawan_dengan_cuti_terbanyak.length ? (
          <ol className="top-employees">
            {summary.karyawan_dengan_cuti_terbanyak.map((employee) => (
              <li key={employee.employee_id}><span>{employee.employee_name}</span><strong>{employee.total_days} hari</strong></li>
            ))}
          </ol>
        ) : <p className="summary-details__empty">Belum ada data pada periode ini.</p>}
      </article>
    </section>
  )
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Terjadi kesalahan yang tidak diketahui.'
}

export default App
