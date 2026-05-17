import { useScan } from '../context/ScanContext'
import { useAuditData } from '../hooks/useAuditData'
import AuditTable from '../components/AuditTable'
import ScanGate from '../components/ScanGate'

const columns = [
  { key: 'artist', label: 'Artista' },
  { key: 'title', label: 'Album' },
  { key: 'year', label: 'Año' },
  { key: 'trackCount', label: 'Tracks' },
]

export default function AlbumAudit() {
  const { library } = useScan()
  const { data } = useAuditData('albums_no_artwork')

  return (
    <ScanGate stepKey="albums_no_artwork">
      <h1 className="text-2xl font-bold mb-1">Albums sin portada</h1>
      <p className="text-plex-muted mb-5 text-sm">{library}</p>
      <AuditTable columns={columns} data={data ?? []} emptyMessage="Todos los albums tienen portada ✓" />
    </ScanGate>
  )
}
