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
  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('id-ID')
    return term
      ? data.filter((item) => item.employee_name.toLocaleLowerCase('id-ID').includes(term))
      : data
  }, [data, search])

  return (
    <section className="dashboard-panel employee-recap">
      <div className="panel-heading employee-recap__heading">
        <div>
          <h2>Rekap Cuti per Karyawan</h2>
          <p>Akumulasi pencatatan dan hari cuti pada {periodLabel}</p>
        </div>
        <label className="recap-search">
          <Search size={16} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Cari nama karyawan"
            aria-label="Cari rekap nama karyawan"
          />
        </label>
      </div>

      {filtered.length ? (
        <div className="table-wrap">
          <table className="data-table recap-table">
            <thead>
              <tr>
                <th>Nama karyawan</th>
                <th>Departemen</th>
                <th>Jumlah cuti</th>
                <th>Total hari</th>
                <th>Rincian jenis cuti</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.employee_id}>
                  <td data-label="Nama karyawan"><strong>{item.employee_name}</strong></td>
                  <td data-label="Departemen">{item.department}</td>
                  <td data-label="Jumlah cuti">{item.total_leaves} kali</td>
                  <td data-label="Total hari"><strong className="recap-days">{item.total_days} hari</strong></td>
                  <td data-label="Rincian jenis cuti">
                    <div className="recap-types">
                      {item.leave_types.map((type) => (
                        <span className="recap-type" key={type.leave_type}>
                          <LeaveBadge type={type.leave_type} />
                          <small>{type.total_leaves}× · {type.total_days} hari</small>
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
