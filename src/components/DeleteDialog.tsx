import { useEffect } from 'react'
import { Trash2, X } from 'lucide-react'
import type { LeaveRecord } from '../types'

interface DeleteDialogProps {
  record: LeaveRecord
  onCancel: () => void
  onConfirm: () => void
}

export function DeleteDialog({ record, onCancel, onConfirm }: DeleteDialogProps) {
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [onCancel])

  return (
    <div className="modal-backdrop modal-backdrop--top" role="presentation" onMouseDown={onCancel}>
      <section
        className="confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button className="icon-button confirm-dialog__close" onClick={onCancel} aria-label="Tutup dialog">
          <X size={19} />
        </button>
        <div className="confirm-dialog__icon"><Trash2 size={24} /></div>
        <h2 id="delete-title">Hapus data cuti?</h2>
        <p>
          Data cuti <strong>{record.employee.nama}</strong> akan dihapus secara permanen.
          Tindakan ini tidak dapat dibatalkan.
        </p>
        <div className="confirm-dialog__actions">
          <button className="button button--secondary" onClick={onCancel}>Batal</button>
          <button className="button button--danger" onClick={onConfirm}>Ya, Hapus</button>
        </div>
      </section>
    </div>
  )
}
