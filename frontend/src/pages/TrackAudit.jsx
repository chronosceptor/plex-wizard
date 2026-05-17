import { useScan } from '../context/ScanContext'
import { useAuditData } from '../hooks/useAuditData'
import AuditTable from '../components/AuditTable'
import ScanGate from '../components/ScanGate'

const ISSUE_LABELS = {
  missing_year: 'Sin año',
  missing_genre: 'Sin género',
  missing_album: 'Sin album',
  missing_artist: 'Sin artista',
}

const columns = [
  { key: 'title', label: 'Track' },
  { key: 'artist', label: 'Artista' },
  { key: 'album', label: 'Album' },
  { key: 'year', label: 'Año' },
  {
    key: 'issues',
    label: 'Problemas',
    sortable: false,
    render: (val) => (
      <div className="flex flex-wrap gap-1">
        {(val || []).map((issue) => (
          <span key={issue} className="bg-red-900/40 text-red-300 border border-red-700 rounded px-1.5 py-0.5 text-xs">
            {ISSUE_LABELS[issue] ?? issue}
          </span>
        ))}
      </div>
    ),
  },
  {
    key: 'bitrate',
    label: 'Bitrate',
    render: (val) => val ? `${val} kbps` : '—',
  },
]

export default function TrackAudit() {
  const { library } = useScan()
  const { data } = useAuditData('tracks_incomplete')

  return (
    <ScanGate stepKey="tracks_incomplete">
      <h1 className="text-2xl font-bold mb-1">Tracks con metadata incompleta</h1>
      <p className="text-plex-muted mb-5 text-sm">{library}</p>
      <AuditTable columns={columns} data={data ?? []} emptyMessage="Todos los tracks tienen metadata completa ✓" />
    </ScanGate>
  )
}
