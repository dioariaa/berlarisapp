import {
  ArrowRight,
  CalendarCheck2,
  CalendarDays,
  Clock3,
  RotateCcw,
  UsersRound,
} from 'lucide-react'
import type { AnalyticsPeriod, DashboardSummary, EmployeeLeaveAggregate, PeriodType } from '../types'
import { formatDate } from '../utils/date'
import { EmployeeLeaveRecap } from './EmployeeLeaveRecap'
import { ErrorState } from './ErrorState'
import { LeaveBadge } from './LeaveBadge'
import { LoadingState } from './LoadingState'

interface Props {
  data: DashboardSummary | null
  loading: boolean
  error: string
  onRetry: () => void
  onNavigate: (page: 'employees' | 'leaves') => void
  aggregates: EmployeeLeaveAggregate[]
  period: AnalyticsPeriod
  onPeriodChange: (period: AnalyticsPeriod) => void
  onResetPeriod: () => void
}

const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

export function DashboardPage({
  data,
  loading,
  error,
  onRetry,
  onNavigate,
  aggregates,
  period,
  onPeriodChange,
  onResetPeriod,
}: Props) {
  if (loading) return <LoadingState label="Memuat ringkasan operasional..." />
  if (error) return <ErrorState message={error} onRetry={onRetry} />
  if (!data) return null

  const cards = [
    { label: 'Karyawan aktif', value: data.total_active_employees, icon: UsersRound, tone: 'blue' },
    { label: `Pengambilan cuti · ${data.period.label}`, value: data.total_leaves_this_month, icon: CalendarDays, tone: 'violet' },
    { label: 'Sedang cuti hari ini', value: data.employees_on_leave_today, icon: CalendarCheck2, tone: 'green' },
    { label: `Hari cuti · ${data.period.label}`, value: data.total_leave_days_this_month, icon: Clock3, tone: 'orange' },
  ]
  const isEmpty = data.total_active_employees === 0 && data.total_leaves_this_month === 0
  const maxDistribution = Math.max(1, ...data.leave_distribution.map((item) => item.total))

  return (
    <>
      <div className="page-heading dashboard-heading">
        <div>
          <span className="eyebrow">RINGKASAN OPERASIONAL</span>
          <h1>Ringkasan Cuti {data.period.label}</h1>
          <p>Pantau kondisi karyawan dan penggunaan cuti berdasarkan periode pilihan.</p>
        </div>
        <div className="dashboard-period-filter">
          <label className="period-mode">
            <span>Mode periode</span>
            <select
              value={period.period_type}
              onChange={(event) => {
                const type = event.target.value as PeriodType
                const now = new Date()
                if (type === 'monthly') {
                  onPeriodChange({
                    period_type: type,
                    month: now.getMonth() + 1,
                    year: now.getFullYear(),
                  })
                } else if (type === 'yearly') {
                  onPeriodChange({ period_type: type, year: now.getFullYear() })
                } else {
                  onPeriodChange({
                    period_type: type,
                    date_from: `${now.getFullYear()}-01-01`,
                    date_to: now.toISOString().slice(0, 10),
                  })
                }
              }}
            >
              <option value="monthly">Bulanan</option>
              <option value="yearly">Tahunan</option>
              <option value="custom">Rentang tanggal</option>
            </select>
          </label>
          {period.period_type === 'monthly' && (
            <label>
              <span>Bulan</span>
              <select
                value={period.month}
                onChange={(event) => onPeriodChange({ ...period, month: Number(event.target.value) })}
              >
                {MONTHS.map((label, index) => <option key={label} value={index + 1}>{label}</option>)}
              </select>
            </label>
          )}
          {period.period_type !== 'custom' && (
            <label>
              <span>Tahun</span>
              <select
                value={period.year}
                onChange={(event) => onPeriodChange({ ...period, year: Number(event.target.value) })}
              >
                {Array.from({ length: 10 }, (_, index) => new Date().getFullYear() - 7 + index)
                  .map((value) => <option key={value}>{value}</option>)}
              </select>
            </label>
          )}
          {period.period_type === 'custom' && (
            <>
              <label>
                <span>Dari tanggal</span>
                <input
                  type="date"
                  value={period.date_from}
                  max={period.date_to}
                  onChange={(event) => onPeriodChange({ ...period, date_from: event.target.value })}
                />
              </label>
              <label>
                <span>Sampai tanggal</span>
                <input
                  type="date"
                  value={period.date_to}
                  min={period.date_from}
                  onChange={(event) => onPeriodChange({ ...period, date_to: event.target.value })}
                />
              </label>
            </>
          )}
          <button className="period-reset" onClick={onResetPeriod} title="Kembali ke tahun berjalan">
            <RotateCcw size={16} /> Reset
          </button>
        </div>
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
            <div><h2>Distribusi Jenis Cuti</h2><p>Jumlah pencatatan pada {data.period.label}</p></div>
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
            <div><h2>Cuti Terbanyak</h2><p>Akumulasi hari pada {data.period.label}</p></div>
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
          ) : <PanelEmpty text="Belum ada penggunaan cuti pada periode ini." />}
        </article>
      </section>

      <EmployeeLeaveRecap data={aggregates} periodLabel={data.period.label} />

      <section className="dashboard-panel dashboard-panel--recent">
        <div className="panel-heading">
          <div><h2>Data Cuti Terbaru</h2><p>Pencatatan terbaru pada {data.period.label}</p></div>
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
