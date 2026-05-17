import { Link } from 'react-router-dom'
import { useScan } from '../context/ScanContext'
import ScanGate from '../components/ScanGate'

const cards = [
  { key: 'artistsNoMatch',     label: 'Artistas sin match',             to: '/artists-no-match', icon: '🔗', color: 'border-red-600' },
  { key: 'albumsNoMatch',      label: 'Albums sin match',               to: '/albums-no-match',  icon: '💿', color: 'border-red-400' },
  { key: 'albumsNoArtwork',    label: 'Albums sin portada',             to: '/albums',           icon: '🖼️', color: 'border-red-500' },
  { key: 'artistsNoGenre',     label: 'Artistas sin género',            to: '/artists-genre',    icon: '🏷️', color: 'border-yellow-500' },
  { key: 'artistsNoPhoto',     label: 'Artistas sin foto / bio',        to: '/artists-photo',    icon: '👤', color: 'border-blue-500' },
  { key: 'artistsNoCountry',   label: 'Artistas sin país',              to: '/artists-country',  icon: '🌍', color: 'border-green-500' },
  { key: 'tracksIncomplete',   label: 'Tracks con metadata incompleta', to: '/tracks',           icon: '🎵', color: 'border-purple-500' },
  { key: 'artistsNeverPlayed', label: 'Artistas nunca escuchados',      to: '/listening',        icon: '📊', color: 'border-orange-500' },
]

function DashboardContent() {
  const { status, results } = useScan()
  const summary = status.summary || {}

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Dashboard</h1>
      {status.scannedAt && (
        <p className="text-plex-muted mb-6 text-sm">
          Último scan: {new Date(status.scannedAt).toLocaleString()}
        </p>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        {cards.map(({ key, label, to, icon, color }) => {
          const count = summary[key]
          return (
            <Link
              key={key}
              to={to}
              className={`bg-plex-card border-l-4 ${color} rounded-lg p-5 hover:bg-plex-border/20 transition-colors`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-plex-muted text-xs uppercase tracking-wider mb-1">{label}</p>
                  <p className="text-3xl font-bold">{count ?? '—'}</p>
                </div>
                <span className="text-2xl">{icon}</span>
              </div>
              {count > 0 && <p className="text-xs text-plex-orange mt-2">Ver detalles →</p>}
              {count === 0 && <p className="text-xs text-green-400 mt-2">Todo correcto ✓</p>}
            </Link>
          )
        })}
      </div>
    </div>
  )
}

export default function Dashboard() {
  return (
    <ScanGate>
      <DashboardContent />
    </ScanGate>
  )
}
