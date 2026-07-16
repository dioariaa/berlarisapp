import { ServerCrash } from 'lucide-react'

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="error-state" role="alert">
      <div className="error-state__icon"><ServerCrash size={28} /></div>
      <h3>Data belum dapat dimuat</h3>
      <p>{message}</p>
      <button className="button button--secondary" onClick={onRetry}>Coba Lagi</button>
    </div>
  )
}
