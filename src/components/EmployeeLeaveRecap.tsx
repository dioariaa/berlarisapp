import { CalendarDays, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { EmployeeLeaveAggregate } from '../types'
import { LeaveBadge } from './LeaveBadge'

interface Props {
  data: EmployeeLeaveAggregate[]
  periodLabel: string
}

export function EmployeeLeaveRecap({ data, periodLabel }: Props) {
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<'days' | 'name'>('days')
  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('id-ID')
    const matching = term
      ? data.filter((item) => item.employee_name.toLocaleLowerCase('id-ID').includes(term))
      : data
    return [...matching].sort((left, right) => sort === 'name'
      ? left.employee_name.localeCompare(right.employee_name, 'id-ID')
      : right.total_leave_days - left.total_leave_days
        || left.employee_name.localeCompare(right.employee_name, 'id-ID'))
  }, [data, search, sort])

  return (
    <section className="dashboard-panel employee-recap">
      <div className="panel-heading employee-recap__heading">
        <div>
          <h2>Rekap Cuti Karyawan {periodLabel}</h2>
          <p>Akumulasi pengambilan dan hari cuti berdasarkan irisan periode aktif</p>
        </div>
        <div className="recap-tools">
          <label className="recap-search">
            <Search size={16} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Cari nama karyawan"
              aria-label="Cari rekap nama karyawan"
            />
          </label>
          <label className="recap-sort">
            <span>Urutkan</span>
            <select value={sort} onChange={(event) => setSort(event.target.value as 'days' | 'name')}>
              <option value="days">Hari terbanyak</option>
              <option value="name">Nama A–Z</option>
            </select>
          </label>
        </div>
      </div>

      {filtered.length ? (
        <div className="table-wrap">
          <table className="data-table recap-table">
            <thead>
              <tr>
                <th>Nama karyawan</th>
                <th>Departemen</th>
                <th>Total pengambilan cuti</th>
                <th>Total hari cuti</th>
                <th>Rincian jenis cuti</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.employee_id}>
                  <td data-label="Nama karyawan"><strong>{item.employee_name}</strong></td>
                  <td data-label="Departemen">{item.department}</td>
                  <td data-label="Total pengambilan">{item.total_leave_entries} kali</td>
                  <td data-label="Total hari"><strong className="recap-days">{item.total_leave_days} hari</strong></td>
                  <td data-label="Rincian jenis cuti">
                    <div className="recap-types">
                      {item.leave_type_breakdown.map((type) => (
                        <span className="recap-type" key={type.leave_type}>
                          <LeaveBadge type={type.leave_type} />
                          <small>{type.total_entries}× · {type.total_days} hari</small>
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="panel-empty panel-empty--recap">
          <CalendarDays size={27} />
          <strong>{search ? 'Nama karyawan tidak ditemukan' : 'Belum ada cuti pada periode ini'}</strong>
          <p>
            {search
              ? 'Coba gunakan kata pencarian yang berbeda.'
              : `Rekap akan muncul otomatis saat data cuti ${periodLabel} tersedia.`}
          </p>
        </div>
      )}
    </section>
  )
}
