import { Pencil, Trash2, UserRoundX } from 'lucide-react'
import type { Employee } from '../types'
import { formatDate } from '../utils/date'

interface Props {
  employees: Employee[]
  onAdd: () => void
  onEdit: (employee: Employee) => void
  onDelete: (employee: Employee) => void
}

export function EmployeeTable({ employees, onAdd, onEdit, onDelete }: Props) {
  if (!employees.length) {
    return (
      <div className="empty-state">
        <div className="empty-state__visual"><UserRoundX size={31} /></div>
        <h3>Belum ada data karyawan</h3>
        <p>Tambahkan karyawan terlebih dahulu sebelum mencatat data cuti.</p>
        <button className="button button--primary" onClick={onAdd}>Tambah Karyawan</button>
      </div>
    )
  }

  return (
    <div className="table-scroll">
      <table className="leave-table employee-table">
        <thead>
          <tr>
            <th>KARYAWAN</th>
            <th>JABATAN</th>
            <th>DEPARTEMEN</th>
            <th>TANGGAL MASUK</th>
            <th>STATUS</th>
            <th>AKSI</th>
          </tr>
        </thead>
        <tbody>
          {employees.map((employee) => (
            <tr key={employee.id}>
              <td data-label="Karyawan">
                <div className="employee-cell">
                  <div className="avatar avatar--employee">{initials(employee.nama)}</div>
                  <div><strong>{employee.nama}</strong><span>ID #{employee.id}</span></div>
                </div>
              </td>
              <td data-label="Jabatan">{employee.jabatan}</td>
              <td data-label="Departemen">{employee.departemen}</td>
              <td data-label="Tanggal masuk">{formatDate(employee.tanggal_masuk)}</td>
              <td data-label="Status"><span className={`status-badge ${employee.status_aktif ? 'status-badge--active' : ''}`}>{employee.status_aktif ? 'Aktif' : 'Tidak aktif'}</span></td>
              <td className="employee-actions" data-label="Aksi">
                <button className="icon-button icon-button--table" onClick={() => onEdit(employee)} aria-label={`Edit ${employee.nama}`}><Pencil size={16} /></button>
                <button className="icon-button icon-button--table icon-button--danger" onClick={() => onDelete(employee)} aria-label={`Hapus ${employee.nama}`}><Trash2 size={16} /></button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function initials(name: string) {
  return name.split(' ').slice(0, 2).map((part) => part[0]).join('').toUpperCase()
}
