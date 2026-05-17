import { useScan } from '../context/ScanContext'

export default function ScanGate({ children, stepKey }) {
  const { status } = useScan()

  if (status.status === 'idle') {
    return <p className="text-plex-muted">Selecciona una librería para iniciar el scan.</p>
  }

  if (status.status === 'error') {
    return <p className="text-red-400">Error durante el scan: {status.error}</p>
  }

  if (status.status === 'scanning') {
    // If the specific step for this page is already done, show content
    if (stepKey) {
      const step = (status.steps ?? []).find(s => s.key === stepKey)
      if (step?.status === 'done') return children
    }

    const done  = (status.steps ?? []).filter(s => s.status === 'done').length
    const total = status.totalSteps ?? 6
    const current = (status.steps ?? []).find(s => s.status === 'running')
    const pct = total > 0 ? Math.round((done / total) * 100) : 0

    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-72">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-plex-muted">Escaneando librería...</span>
            <span className="text-sm text-plex-orange font-mono">{done}/{total}</span>
          </div>
          <div className="w-full bg-plex-card rounded-full h-1.5 mb-2">
            <div
              className="bg-plex-orange h-1.5 rounded-full transition-all duration-700"
              style={{ width: `${pct}%` }}
            />
          </div>
          {current && (
            <p className="text-xs text-plex-muted">
              <span className="text-white/50">›</span> {current.label}
            </p>
          )}
        </div>
      </div>
    )
  }

  return children
}
