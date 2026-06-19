import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { AlertCircle, CalendarDays, X } from 'lucide-react'
import { LEAVE_TYPES, type Employee, type LeaveFormValues, type LeaveRecord } from '../types'
import { calculateTotalDays } from '../utils/date'

interface LeaveFormModalProps {
  record: LeaveRecord | null
  employees: Employee[]
  submitting: boolean
  serverError?: string
  overlapMessage?: string
  onClose: () => void
  onSubmit: (values: LeaveFormValues) => void
  onConfirmOverlap?: () => void
}

const initialValues: LeaveFormValues = {
  employee_id: 0,
  leave_type: 'Cuti Tahunan',
  start_date: '',
  end_date: '',
  description: '',
}

export function LeaveFormModal({
  record,
  employees,
  submitting,
  serverError,
  overlapMessage,
  onClose,
  onSubmit,
  onConfirmOverlap,
}: LeaveFormModalProps) {
  const [values, setValues] = useState<LeaveFormValues>(initialValues)
  const [errors, setErrors] = useState<Partial<Record<keyof LeaveFormValues, string>>>({})

  useEffect(() => {
    setValues(
      record
        ? {
            employee_id: record.employee_id,
            leave_type: record.leave_type,
            start_date: record.start_date,
            end_date: record.end_date,
            description: record.description || '',
          }
        : initialValues,
    )
  }, [record])

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleEscape)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = ''
    }
  }, [onClose])

  const totalDays = useMemo(
    () => calculateTotalDays(values.start_date, values.end_date),
    [values.end_date, values.start_date],
  )

  const setField = <K extends keyof LeaveFormValues>(field: K, value: LeaveFormValues[K]) => {
    setValues((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
  }

  const validate = () => {
    const nextErrors: Partial<Record<keyof LeaveFormValues, string>> = {}
    if (!values.employee_id) nextErrors.employee_id = 'Pilih karyawan terlebih dahulu.'
    if (!values.leave_type) nextErrors.leave_type = 'Pilih jenis cuti.'
    if (!values.start_date) nextErrors.start_date = 'Tanggal mulai wajib diisi.'
    if (!values.end_date) nextErrors.end_date = 'Tanggal selesai wajib diisi.'
    if (values.start_date && values.end_date && values.end_date < values.start_date) {
      nextErrors.end_date = 'Tanggal selesai tidak boleh sebelum tanggal mulai.'
    }
    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (!validate()) return
    onSubmit(values)
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="leave-modal-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal__header">
          <div>
            <h2 id="leave-modal-title">{record ? 'Edit Data Cuti' : 'Tambah Data Cuti'}</h2>
            <p>Lengkapi informasi cuti karyawan dengan benar.</p>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Tutup modal" type="button">
            <X size={21} />
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="modal__body">
            <div className="field field--full">
              <label htmlFor="employeeId">Nama karyawan <span>*</span></label>
              <select
                id="employeeId"
                value={values.employee_id}
                onChange={(event) => setField('employee_id', Number(event.target.value))}
                className={errors.employee_id ? 'input--error' : ''}
              >
                <option value={0}>Pilih karyawan</option>
                {employees.filter((employee) => employee.status_aktif || employee.id === record?.employee_id).map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.nama} — {employee.jabatan}
                  </option>
                ))}
              </select>
              {errors.employee_id && <FieldError message={errors.employee_id} />}
            </div>

            <div className="field field--full">
              <label htmlFor="leaveType">Jenis cuti <span>*</span></label>
              <select
                id="leaveType"
                value={values.leave_type}
                onChange={(event) => setField('leave_type', event.target.value as LeaveFormValues['leave_type'])}
              >
                {LEAVE_TYPES.map((type) => <option key={type}>{type}</option>)}
              </select>
            </div>

            <div className="form-grid">
              <div className="field">
                <label htmlFor="startDate">Tanggal mulai <span>*</span></label>
                <input
                  id="startDate"
                  type="date"
                  value={values.start_date}
                  onChange={(event) => setField('start_date', event.target.value)}
                  className={errors.start_date ? 'input--error' : ''}
                />
                {errors.start_date && <FieldError message={errors.start_date} />}
              </div>
              <div className="field">
                <label htmlFor="endDate">Tanggal selesai <span>*</span></label>
                <input
                  id="endDate"
                  type="date"
                  min={values.start_date || undefined}
                  value={values.end_date}
                  onChange={(event) => setField('end_date', event.target.value)}
                  className={errors.end_date ? 'input--error' : ''}
                />
                {errors.end_date && <FieldError message={errors.end_date} />}
              </div>
            </div>

            <div className="duration-preview">
              <div className="duration-preview__icon"><CalendarDays size={19} /></div>
              <div>
                <span>Durasi cuti</span>
                <strong>{totalDays ? `${totalDays} hari` : 'Pilih rentang tanggal'}</strong>
              </div>
            </div>

            <div className="field field--full">
              <label htmlFor="description">Keterangan</label>
              <textarea
                id="description"
                value={values.description}
                onChange={(event) => setField('description', event.target.value)}
                placeholder="Tambahkan keterangan bila diperlukan"
                rows={3}
                maxLength={300}
              />
              <small className="field__counter">{values.description.length}/300</small>
            </div>
            {serverError && <div className="form-alert form-alert--error"><AlertCircle size={16} />{serverError}</div>}
            {overlapMessage && (
              <div className="form-alert form-alert--warning">
                <AlertCircle size={16} />
                <div>
                  <strong>Data cuti bertabrakan</strong>
                  <span>{overlapMessage}</span>
                  <button type="button" onClick={onConfirmOverlap}>Tetap simpan dengan override</button>
                </div>
              </div>
            )}
          </div>

          <div className="modal__footer">
            <button type="button" className="button button--secondary" onClick={onClose}>Batal</button>
            <button type="submit" className="button button--primary" disabled={submitting}>
              {submitting ? 'Menyimpan...' : record ? 'Simpan Perubahan' : 'Simpan Data Cuti'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}

function FieldError({ message }: { message: string }) {
  return (
    <small className="field-error">
      <AlertCircle size={13} />
      {message}
    </small>
  )
}
