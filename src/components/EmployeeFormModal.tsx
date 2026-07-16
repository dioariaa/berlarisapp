import { useEffect, useState, type FormEvent } from 'react'
import { AlertCircle, X } from 'lucide-react'
import type { Employee, EmployeeFormValues } from '../types'

interface Props {
  employee: Employee | null
  submitting: boolean
  serverError?: string
  onClose: () => void
  onSubmit: (values: EmployeeFormValues) => void
}

const initialValues: EmployeeFormValues = {
  nama: '',
  jabatan: '',
  departemen: '',
  tanggal_masuk: '',
  status_aktif: true,
}

export function EmployeeFormModal({ employee, submitting, serverError, onClose, onSubmit }: Props) {
  const [values, setValues] = useState<EmployeeFormValues>(initialValues)
  const [errors, setErrors] = useState<Partial<Record<keyof EmployeeFormValues, string>>>({})

  useEffect(() => {
    setValues(employee ? {
      nama: employee.nama,
      jabatan: employee.jabatan,
      departemen: employee.departemen,
      tanggal_masuk: employee.tanggal_masuk,
      status_aktif: employee.status_aktif,
    } : initialValues)
  }, [employee])

  const setField = <K extends keyof EmployeeFormValues>(field: K, value: EmployeeFormValues[K]) => {
    setValues((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    const nextErrors: Partial<Record<keyof EmployeeFormValues, string>> = {}
    if (values.nama.trim().length < 2) nextErrors.nama = 'Nama karyawan minimal 2 karakter.'
    if (values.jabatan.trim().length < 2) nextErrors.jabatan = 'Jabatan wajib diisi.'
    if (values.departemen.trim().length < 2) nextErrors.departemen = 'Departemen wajib diisi.'
    if (!values.tanggal_masuk) nextErrors.tanggal_masuk = 'Tanggal masuk wajib diisi.'
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length === 0) onSubmit(values)
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="modal modal--employee" role="dialog" aria-modal="true" aria-labelledby="employee-modal-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal__header">
          <div>
            <h2 id="employee-modal-title">{employee ? 'Edit Data Karyawan' : 'Tambah Karyawan'}</h2>
            <p>Data ini menjadi sumber utama pilihan karyawan pada pencatatan cuti.</p>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Tutup modal"><X size={21} /></button>
        </div>
        <form onSubmit={handleSubmit} noValidate>
          <div className="modal__body">
            <EmployeeField label="Nama karyawan" error={errors.nama}>
              <input value={values.nama} onChange={(event) => setField('nama', event.target.value)} placeholder="Nama lengkap" />
            </EmployeeField>
            <div className="form-grid">
              <EmployeeField label="Jabatan" error={errors.jabatan}>
                <input value={values.jabatan} onChange={(event) => setField('jabatan', event.target.value)} placeholder="Contoh: Software Engineer" />
              </EmployeeField>
              <EmployeeField label="Departemen" error={errors.departemen}>
                <input value={values.departemen} onChange={(event) => setField('departemen', event.target.value)} placeholder="Contoh: Engineering" />
              </EmployeeField>
            </div>
            <div className="form-grid">
              <EmployeeField label="Tanggal masuk" error={errors.tanggal_masuk}>
                <input type="date" value={values.tanggal_masuk} onChange={(event) => setField('tanggal_masuk', event.target.value)} />
              </EmployeeField>
              <div className="field">
                <label htmlFor="employee-status">Status karyawan <span>*</span></label>
                <select id="employee-status" value={String(values.status_aktif)} onChange={(event) => setField('status_aktif', event.target.value === 'true')}>
                  <option value="true">Aktif</option>
                  <option value="false">Tidak aktif</option>
                </select>
              </div>
            </div>
            {serverError && <div className="form-alert form-alert--error"><AlertCircle size={16} />{serverError}</div>}
          </div>
          <div className="modal__footer">
            <button type="button" className="button button--secondary" onClick={onClose}>Batal</button>
            <button type="submit" className="button button--primary" disabled={submitting}>
              {submitting ? 'Menyimpan...' : employee ? 'Simpan Perubahan' : 'Simpan Karyawan'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}

function EmployeeField({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="field">
      <label>{label} <span>*</span></label>
      {children}
      {error && <small className="field-error"><AlertCircle size={13} />{error}</small>}
    </div>
  )
}
