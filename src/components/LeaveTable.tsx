import { CalendarX2, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { LeaveRecord } from '../types'
import { formatDate } from '../utils/date'
import { LeaveBadge } from './LeaveBadge'

interface LeaveTableProps {
  records: LeaveRecord[]
  hasFilters: boolean
  onAdd: () => void
  onEdit: (record: LeaveRecord) => void
  onDelete: (record: LeaveRecord) => void
  onClearFilters: () => void
}

export function LeaveTable({
  records,
  hasFilters,
  onAdd,
  onEdit,
  onDelete,
  onClearFilters,
}: LeaveTableProps) {
  const [openMenu, setOpenMenu] = useState<number | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const closeMenu = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setOpenMenu(null)
    }
    document.addEventListener('mousedown', closeMenu)
    return () => document.removeEventListener('mousedown', closeMenu)
  }, [])

  if (!records.length) {
    return (
      <div className="empty-state">
        <div className="empty-state__visual">
          <CalendarX2 size={31} />
        </div>
        <h3>{hasFilters ? 'Data cuti tidak ditemukan' : 'Belum ada data cuti'}</h3>
        <p>
          {hasFilters
            ? 'Coba ubah atau hapus filter untuk melihat data lainnya.'
            : 'Mulai catat cuti karyawan agar informasi tersimpan rapi di satu tempat.'}
        </p>
        <button className={`button ${hasFilters ? 'button--secondary' : 'button--primary'}`} onClick={hasFilters ? onClearFilters : onAdd}>
          {hasFilters ? 'Hapus Filter' : 'Tambah Data Cuti'}
        </button>
      </div>
    )
  }

  return (
    <div className="table-scroll">
      <table className="leave-table">
        <thead>
          <tr>
            <th>KARYAWAN</th>
            <th>JENIS CUTI</th>
            <th>PERIODE CUTI</th>
            <th>DURASI</th>
            <th>KETERANGAN</th>
            <th aria-label="Aksi" />
          </tr>
        </thead>
        <tbody>
          {records.map((record) => {
            return (
              <tr key={record.id}>
                <td data-label="Karyawan">
                  <div className="employee-cell">
                    <div className="avatar avatar--employee">{getInitials(record.employee.nama)}</div>
                    <div>
                      <strong>{record.employee.nama}</strong>
                      <span>{record.employee.jabatan} · {record.employee.departemen}</span>
                    </div>
                  </div>
                </td>
                <td data-label="Jenis cuti"><LeaveBadge type={record.leave_type} /></td>
                <td data-label="Periode">
                  <div className="date-range">
                    <strong>{formatDate(record.start_date)}</strong>
                    {record.start_date !== record.end_date && <span>s.d. {formatDate(record.end_date)}</span>}
                  </div>
                </td>
                <td data-label="Durasi"><strong className="days-value">{record.total_days} hari</strong></td>
                <td data-label="Keterangan">
                  <span className={record.description ? 'description-text' : 'description-text description-text--empty'}>
                    {record.description || 'Tidak ada keterangan'}
                  </span>
                </td>
                <td className="action-cell">
                  <div className="action-menu" ref={openMenu === record.id ? menuRef : null}>
                    <button
                      className="icon-button icon-button--table"
                      aria-label={`Aksi untuk ${record.employee.nama}`}
                      aria-expanded={openMenu === record.id}
                      onClick={() => setOpenMenu((current) => current === record.id ? null : record.id)}
                    >
                      <MoreHorizontal size={20} />
                    </button>
                    {openMenu === record.id && (
                      <div className="action-menu__popover">
                        <button onClick={() => { onEdit(record); setOpenMenu(null) }}>
                          <Pencil size={16} /> Edit data
                        </button>
                        <button className="action-menu__delete" onClick={() => { onDelete(record); setOpenMenu(null) }}>
                          <Trash2 size={16} /> Hapus data
                        </button>
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function getInitials(name: string): string {
  return name.split(' ').slice(0, 2).map((part) => part[0]).join('').toUpperCase()
}
