import { useState, type FormEvent } from 'react'
import { Pencil, Plus, Search, ShieldCheck, UserRoundX, X } from 'lucide-react'
import type { AuthUser, UserFormValues } from '../types'
import { formatDate } from '../utils/date'
import { LoadingState } from './LoadingState'
import { ErrorState } from './ErrorState'

export function UserManagementPage({
  users,
  loading,
  error,
  submitting,
  onRetry,
  onSave,
  onDeactivate,
}: {
  users: AuthUser[]
  loading: boolean
  error: string
  submitting: boolean
  onRetry: () => void
  onSave: (id: string | null, values: UserFormValues) => void
  onDeactivate: (user: AuthUser) => void
}) {
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<AuthUser | null | undefined>(undefined)
  const [deactivateTarget, setDeactivateTarget] = useState<AuthUser | null>(null)
  const filtered = users.filter((user) =>
    !search || `${user.name} ${user.email}`.toLowerCase().includes(search.toLowerCase()),
  )

  if (loading) return <LoadingState label="Memuat akun administrator..." />
  if (error) return <ErrorState message={error} onRetry={onRetry} />

  return (
    <>
      <div className="page-heading">
        <div><span className="eyebrow">KONTROL AKSES</span><h1>Manajemen User</h1><p>Kelola akun admin, peran, dan status akses aplikasi.</p></div>
        <button className="button button--primary" onClick={() => setEditing(null)}><Plus size={17} /> Tambah User</button>
      </div>
      <section className="data-card">
        <div className="data-card__header"><div><h2>Daftar User</h2><p>{filtered.length} akun ditampilkan</p></div></div>
        <div className="filters"><div className="filter-control filter-control--employee"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari nama atau email" /></div></div>
        {filtered.length ? (
          <div className="table-scroll">
            <table className="leave-table user-table">
              <thead><tr><th>USER</th><th>ROLE</th><th>STATUS</th><th>LOGIN TERAKHIR</th><th>AKSI</th></tr></thead>
              <tbody>
                {filtered.map((user) => (
                  <tr key={user.id}>
                    <td><div className="employee-cell"><div className="avatar avatar--employee">{initials(user.name)}</div><div><strong>{user.name}</strong><span>{user.email}</span></div></div></td>
                    <td><span className={`role-badge role-badge--${user.role}`}><ShieldCheck size={13} />{user.role}</span></td>
                    <td><span className={`status-badge ${user.is_active ? 'status-badge--active' : ''}`}>{user.is_active ? 'Aktif' : 'Nonaktif'}</span></td>
                    <td>{user.last_login_at ? formatDate(user.last_login_at.slice(0, 10)) : 'Belum pernah login'}</td>
                    <td className="employee-actions"><button className="icon-button" onClick={() => setEditing(user)} aria-label={`Edit ${user.name}`}><Pencil size={16} /></button><button className="icon-button icon-button--danger" onClick={() => setDeactivateTarget(user)} aria-label={`Nonaktifkan ${user.name}`}><UserRoundX size={16} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <div className="empty-state"><h3>Belum ada user yang sesuai</h3><p>Tambahkan user atau ubah kata pencarian.</p></div>}
      </section>
      {editing !== undefined && <UserFormModal user={editing} submitting={submitting} onClose={() => setEditing(undefined)} onSubmit={(values) => { onSave(editing?.id ?? null, values); setEditing(undefined) }} />}
      {deactivateTarget && (
        <div className="modal-backdrop modal-backdrop--top" onMouseDown={() => setDeactivateTarget(null)}>
          <section className="confirm-dialog" role="alertdialog" aria-modal="true" aria-label="Nonaktifkan User" onMouseDown={(event) => event.stopPropagation()}>
            <div className="confirm-dialog__icon"><UserRoundX size={24} /></div>
            <h2>Nonaktifkan user?</h2>
            <p>Akses <strong>{deactivateTarget.name}</strong> akan dihentikan. Token aktif akan ditolak pada request berikutnya.</p>
            <div className="confirm-dialog__actions"><button className="button button--secondary" onClick={() => setDeactivateTarget(null)}>Batal</button><button className="button button--danger" onClick={() => { onDeactivate(deactivateTarget); setDeactivateTarget(null) }}>Nonaktifkan</button></div>
          </section>
        </div>
      )}
    </>
  )
}

function UserFormModal({ user, submitting, onClose, onSubmit }: { user: AuthUser | null; submitting: boolean; onClose: () => void; onSubmit: (values: UserFormValues) => void }) {
  const [values, setValues] = useState<UserFormValues>({
    name: user?.name || '',
    email: user?.email || '',
    password: '',
    role: user?.role || 'admin',
    is_active: user?.is_active ?? true,
  })
  const submit = (event: FormEvent) => {
    event.preventDefault()
    onSubmit(values)
  }
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section className="modal modal--employee" role="dialog" aria-modal="true" aria-label={user ? 'Edit User' : 'Tambah User'} onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal__header"><div><h2>{user ? 'Edit User' : 'Tambah User'}</h2><p>Atur identitas, role, dan status akses.</p></div><button className="icon-button" onClick={onClose}><X size={20} /></button></div>
        <form onSubmit={submit}>
          <div className="modal__body">
            <div className="field"><label>Nama <span>*</span></label><input value={values.name} onChange={(event) => setValues({ ...values, name: event.target.value })} required minLength={2} /></div>
            <div className="field"><label>Email <span>*</span></label><input type="email" value={values.email} onChange={(event) => setValues({ ...values, email: event.target.value })} required /></div>
            <div className="field"><label>Password {user ? '(opsional)' : <span>*</span>}</label><input type="password" value={values.password} onChange={(event) => setValues({ ...values, password: event.target.value })} required={!user} minLength={8} autoComplete="new-password" /></div>
            <div className="form-grid">
              <div className="field"><label>Role <span>*</span></label><select value={values.role} onChange={(event) => setValues({ ...values, role: event.target.value as UserFormValues['role'] })}><option value="admin">Admin</option><option value="superadmin">Superadmin</option></select></div>
              <div className="field"><label>Status <span>*</span></label><select value={String(values.is_active)} onChange={(event) => setValues({ ...values, is_active: event.target.value === 'true' })}><option value="true">Aktif</option><option value="false">Nonaktif</option></select></div>
            </div>
          </div>
          <div className="modal__footer"><button type="button" className="button button--secondary" onClick={onClose}>Batal</button><button type="submit" className="button button--primary" disabled={submitting}>{submitting ? 'Menyimpan...' : 'Simpan User'}</button></div>
        </form>
      </section>
    </div>
  )
}

function initials(name: string) {
  return name.split(' ').slice(0, 2).map((part) => part[0]).join('').toUpperCase()
}
