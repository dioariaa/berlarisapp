import { ShieldAlert } from 'lucide-react'

export function ForbiddenState({ onBack }: { onBack: () => void }) {
  return (
    <div className="error-state">
      <div className="error-state__icon"><ShieldAlert size={28} /></div>
      <h3>Akses tidak tersedia</h3>
      <p>Halaman ini hanya dapat diakses oleh superadmin.</p>
      <button className="button button--secondary" onClick={onBack}>Kembali ke Dashboard</button>
    </div>
  )
}
