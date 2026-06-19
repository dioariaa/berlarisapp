export function LoadingState({ label = 'Memuat data...' }: { label?: string }) {
  return (
    <div className="loading-state" role="status">
      <span className="spinner" />
      <p>{label}</p>
    </div>
  )
}
