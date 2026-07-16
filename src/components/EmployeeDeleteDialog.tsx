import { Trash2, X } from 'lucide-react'
import type { Employee } from '../types'

export function EmployeeDeleteDialog({
  employee,
  deleting,
  onCancel,
  onConfirm,
}: {
  employee: Employee
  deleting: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <div className="modal-backdrop modal-backdrop--top" role="presentation" onMouseDown={onCancel}>
      <section className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-employee-title" onMouseDown={(event) => event.stopPropagation()}>
        <button className="icon-button confirm-dialog__close" onClick={onCancel} aria-label="Tutup dialog"><X size={19} /></button>
        <div className="confirm-dialog__icon"><Trash2 size={24} /></div>
        <h2 id="delete-employee-title">Hapus data karyawan?</h2>
        <p>Data <strong>{employee.nama}</strong> beserta seluruh catatan cutinya akan dihapus permanen.</p>
        <div className="confirm-dialog__actions">
          <button className="button button--secondary" onClick={onCancel}>Batal</button>
          <button className="button button--danger" onClick={onConfirm} disabled={deleting}>{deleting ? 'Menghapus...' : 'Ya, Hapus'}</button>
        </div>
      </section>
    </div>
  )
}
