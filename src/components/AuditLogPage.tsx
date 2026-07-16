import { Eye, FileDown, Search, X } from 'lucide-react'
import { useState } from 'react'
import type { AuditLog } from '../types'
import { ErrorState } from './ErrorState'
import { LoadingState } from './LoadingState'

export interface AuditFilterState {
  action: string
  entity_type: string
  date_from: string
  date_to: string
}

export function AuditLogPage({
  logs,
  loading,
  error,
  filters,
  page,
  pages,
  exporting,
  onFilters,
  onPage,
  onRetry,
  onExport,
}: {
  logs: AuditLog[]
  loading: boolean
  error: string
  filters: AuditFilterState
  page: number
  pages: number
  exporting: boolean
  onFilters: (filters: AuditFilterState) => void
  onPage: (page: number) => void
  onRetry: () => void
  onExport: () => void
}) {
  const [detail, setDetail] = useState<AuditLog | null>(null)
  if (loading) return <LoadingState label="Memuat audit log..." />
  if (error) return <ErrorState message={error} onRetry={onRetry} />

  return (
    <>
      <div className="page-heading">
        <div><span className="eyebrow">AKTIVITAS SISTEM</span><h1>Audit Log</h1><p>Telusuri perubahan data dan aktivitas keamanan secara read-only.</p></div>
        <button className="button button--secondary" onClick={onExport} disabled={exporting}><FileDown size={17} />{exporting ? 'Menyiapkan...' : 'Export Excel'}</button>
      </div>
      <section className="data-card">
        <div className="filters audit-filters">
          <div className="filter-control filter-control--employee"><Search size={17} /><select value={filters.action} onChange={(event) => onFilters({ ...filters, action: event.target.value })}><option value="">Semua action</option>{AUDIT_ACTIONS.map((action) => <option key={action}>{action}</option>)}</select></div>
          <div className="filter-control"><select value={filters.entity_type} onChange={(event) => onFilters({ ...filters, entity_type: event.target.value })}><option value="">Semua entity</option><option>EMPLOYEE</option><option>EMPLOYEE_LEAVE</option><option>USER</option><option>AUTH</option><option>AUDIT_LOG</option></select></div>
          <div className="range-filters"><input type="date" value={filters.date_from} onChange={(event) => onFilters({ ...filters, date_from: event.target.value })} /><span>—</span><input type="date" value={filters.date_to} onChange={(event) => onFilters({ ...filters, date_to: event.target.value })} /></div>
        </div>
        {logs.length ? (
          <>
            <div className="table-scroll"><table className="leave-table audit-table"><thead><tr><th>WAKTU</th><th>USER</th><th>ACTION</th><th>ENTITY</th><th>ID</th><th>DETAIL</th></tr></thead><tbody>{logs.map((log) => <tr key={log.id}><td>{formatDateTime(log.created_at)}</td><td><strong>{log.user_name}</strong><br /><small>{log.user_email}</small></td><td><span className="audit-action">{humanize(log.action)}</span></td><td>{humanize(log.entity_type)}</td><td>{log.entity_id || '—'}</td><td><button className="icon-button" onClick={() => setDetail(log)} aria-label={`Detail audit ${log.id}`}><Eye size={16} /></button></td></tr>)}</tbody></table></div>
            <div className="pagination"><button disabled={page <= 1} onClick={() => onPage(page - 1)}>Sebelumnya</button><span>Halaman {page} dari {Math.max(pages, 1)}</span><button disabled={page >= pages} onClick={() => onPage(page + 1)}>Berikutnya</button></div>
          </>
        ) : <div className="empty-state"><h3>Belum ada audit log</h3><p>Aktivitas keamanan dan perubahan data akan muncul di sini.</p></div>}
      </section>
      {detail && <AuditDetail log={detail} onClose={() => setDetail(null)} />}
    </>
  )
}

function AuditDetail({ log, onClose }: { log: AuditLog; onClose: () => void }) {
  return <div className="modal-backdrop" onMouseDown={onClose}><section className="modal audit-detail" role="dialog" aria-modal="true" aria-label="Detail Audit Log" onMouseDown={(event) => event.stopPropagation()}><div className="modal__header"><div><h2>Detail Audit Log</h2><p>{formatDateTime(log.created_at)}</p></div><button className="icon-button" onClick={onClose}><X size={20} /></button></div><div className="modal__body"><div className="audit-meta"><span>User<strong>{log.user_name}</strong></span><span>Action<strong>{humanize(log.action)}</strong></span><span>Entity<strong>{humanize(log.entity_type)} #{log.entity_id || '—'}</strong></span><span>IP Address<strong>{log.ip_address || 'Tidak tersedia'}</strong></span></div><ChangeSection title="Nilai Sebelum" values={log.old_values} /><ChangeSection title="Nilai Sesudah" values={log.new_values} /></div></section></div>
}

function ChangeSection({ title, values }: { title: string; values: Record<string, unknown> | null }) {
  return <div className="audit-changes"><h3>{title}</h3>{values ? Object.entries(values).map(([key, value]) => <div key={key}><span>{humanize(key)}</span><strong>{formatValue(value)}</strong></div>) : <p>Tidak ada data.</p>}</div>
}

function formatValue(value: unknown) {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'object') return JSON.stringify(value, null, 2)
  return String(value)
}

function humanize(value: string) {
  return value.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (letter: string) => letter.toUpperCase())
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

const AUDIT_ACTIONS = ['LOGIN_SUCCESS', 'LOGIN_FAILED', 'CREATE_EMPLOYEE', 'UPDATE_EMPLOYEE', 'DELETE_EMPLOYEE', 'CREATE_LEAVE', 'UPDATE_LEAVE', 'DELETE_LEAVE', 'CREATE_USER', 'UPDATE_USER', 'DELETE_USER', 'EXPORT_EXCEL']
