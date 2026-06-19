import {
  ArrowRight,
  CalendarCheck2,
  CalendarDays,
  Clock3,
  UsersRound,
} from 'lucide-react'
import type { DashboardSummary } from '../types'
import { formatDate } from '../utils/date'
import { ErrorState } from './ErrorState'
import { LeaveBadge } from './LeaveBadge'
import { LoadingState } from './LoadingState'

interface Props {
  data: DashboardSummary | null
  loading: boolean
  error: string
  onRetry: () => void
  onNavigate: (page: 'employees' | 'leaves') => void
}

export function DashboardPage({ data, loading, error, onRetry, onNavigate }: Props) {
  if (loading) return <LoadingState label="Memuat ringkasan operasional..." />
  if (error) return <ErrorState message={error} onRetry={onRetry} />
  if (!data) return null

  const cards = [
    { label: 'Karyawan aktif', value: data.total_active_employees, icon: UsersRound, tone: 'blue' },
    { label: 'Cuti bulan ini', value: data.total_leaves_this_month, icon: CalendarDays, tone: 'violet' },
    { label: 'Sedang cuti hari ini', value: data.employees_on_leave_today, icon: CalendarCheck2, tone: 'green' },
    { label: 'Hari cuti bulan ini', value: data.total_leave_days_this_month, icon: Clock3, tone: 'orange' },
  ]
  const isEmpty = data.total_active_employees === 0 && data.total_leaves_this_month === 0
  const maxDistribution = Math.max(1, ...data.leave_distribution.map((item) => item.total))

  return (
    <>
      <div className="page-heading dashboard-heading">
        <div>
          <span className="eyebrow">RINGKASAN OPERASIONAL</span>
          <h1>Dashboard Admin</h1>
          <p>Pantau kondisi karyawan dan penggunaan cuti dalam satu tampilan.</p>
        </div>
        <span className="dashboard-period">
          {new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(new Date())}
        </span>
      </div>

      <section className="dashboard-stats" aria-label="Statistik utama">
        {cards.map(({ label, value, icon: Icon, tone }) => (
          <article className="dashboard-stat" key={label}>
            <div className={`dashboard-stat__icon dashboard-stat__icon--${tone}`}><Icon size={21} /></div>
            <div><span>{label}</span><strong>{new Intl.NumberFormat('id-ID').format(value)}</strong></div>
          </article>
        ))}
      </section>

      {isEmpty && (
        <section className="dashboard-empty">
          <div>
            <h2>Mulai siapkan data operasional</h2>
            <p>Tambahkan data karyawan terlebih dahulu. Setelah itu, pencatatan cuti dan ringkasan akan muncul otomatis di dashboard.</p>
          </div>
          <button className="button button--primary" onClick={() => onNavigate('employees')}>
            Kelola Data Karyawan <ArrowRight size={16} />
          </button>
        </section>
      )}

      <section className="dashboard-grid">
        <article className="dashboard-panel">
          <div className="panel-heading">
            <div><h2>Distribusi Jenis Cuti</h2><p>Jumlah pencatatan pada bulan berjalan</p></div>
          </div>
          <div className="dashboard-distribution">
            {data.leave_distribution.map((item) => (
              <div className="distribution-row" key={item.leave_type}>
                <div><LeaveBadge type={item.leave_type} /><strong>{item.total}</strong></div>
                <span><i style={{ width: `${(item.total / maxDistribution) * 100}%` }} /></span>
              </div>
            ))}
          </div>
        </article>

        <article className="dashboard-panel">
          <div className="panel-heading">
            <div><h2>Cuti Terbanyak</h2><p>Akumulasi hari pada bulan berjalan</p></div>
          </div>
          {data.top_leave_employees.length ? (
            <ol className="dashboard-ranking">
              {data.top_leave_employees.map((employee, index) => (
                <li key={employee.employee_id}>
                  <span className="ranking-number">{index + 1}</span>
                  <div><strong>{employee.employee_name}</strong><small>Karyawan</small></div>
                  <b>{employee.total_days} hari</b>
                </li>
              ))}
            </ol>
          ) : <PanelEmpty text="Belum ada penggunaan cuti pada bulan ini." />}
        </article>
      </section>

      <section className="dashboard-panel dashboard-panel--recent">
        <div className="panel-heading">
          <div><h2>Data Cuti Terbaru</h2><p>Pencatatan yang baru ditambahkan</p></div>
          <button className="panel-link" onClick={() => onNavigate('leaves')}>Lihat semua <ArrowRight size={14} /></button>
        </div>
        {data.recent_leaves.length ? (
          <div className="recent-leaves">
            {data.recent_leaves.map((leave) => (
              <div className="recent-leave" key={leave.id}>
                <div className="avatar avatar--employee">{initials(leave.employee_name)}</div>
                <div className="recent-leave__employee"><strong>{leave.employee_name}</strong><span>{formatDate(leave.start_date)} – {formatDate(leave.end_date)}</span></div>
                <LeaveBadge type={leave.leave_type} />
                <strong className="recent-leave__days">{leave.total_days} hari</strong>
              </div>
            ))}
          </div>
        ) : <PanelEmpty text="Belum ada data cuti yang tercatat." />}
      </section>
    </>
  )
}

function PanelEmpty({ text }: { text: string }) {
  return <div className="panel-empty"><CalendarDays size={24} /><p>{text}</p></div>
}

function initials(name: string) {
  return name.split(' ').slice(0, 2).map((part) => part[0]).join('').toUpperCase()
}
