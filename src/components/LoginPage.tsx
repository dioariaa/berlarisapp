import { useState, type FormEvent } from 'react'
import { AlertCircle, Eye, EyeOff, LockKeyhole, Mail } from 'lucide-react'

export function LoginPage({
  loading,
  error,
  onLogin,
}: {
  loading: boolean
  error: string
  onLogin: (email: string, password: string) => void
}) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (email && password) onLogin(email, password)
  }

  return (
    <main className="login-page">
      <section className="login-brand">
        <div className="login-brand__mark">B</div>
        <span>BERLARISAPP</span>
        <h1>Administrasi karyawan yang lebih tertib dan mudah diaudit.</h1>
        <p>Kelola data karyawan, pencatatan cuti, ekspor operasional, dan histori perubahan dari satu ruang kerja aman.</p>
        <div className="login-brand__security"><LockKeyhole size={18} /> Akses terenkripsi dan berbasis peran</div>
      </section>
      <section className="login-card">
        <div className="login-card__header">
          <span>BERLARISAPP ADMIN</span>
          <h2>Masuk ke akun Anda</h2>
          <p>Gunakan kredensial admin yang telah diberikan superadmin.</p>
        </div>
        <form onSubmit={submit}>
          <label className="login-field">
            <span>Email</span>
            <div><Mail size={17} /><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" placeholder="nama@perusahaan.com" required /></div>
          </label>
          <label className="login-field">
            <span>Password</span>
            <div>
              <LockKeyhole size={17} />
              <input type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" placeholder="Masukkan password" required />
              <button type="button" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button>
            </div>
          </label>
          {error && <div className="login-error"><AlertCircle size={16} />{error}</div>}
          <button className="button button--primary login-submit" type="submit" disabled={loading}>
            {loading ? 'Memverifikasi...' : 'Masuk'}
          </button>
        </form>
        <small>Hubungi superadmin jika Anda tidak dapat mengakses akun.</small>
      </section>
    </main>
  )
}
