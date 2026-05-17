import { useState } from 'react'
import { useScan } from '../context/ScanContext'
import { useAuditData } from '../hooks/useAuditData'
import AuditTable from '../components/AuditTable'
import ScanGate from '../components/ScanGate'
import FixMatchModal from '../components/FixMatchModal'

const columns = [
  { key: 'artist', label: 'Artista' },
  { key: 'title', label: 'Album' },
  { key: 'year', label: 'Año' },
  { key: 'trackCount', label: 'Tracks' },
  {
    key: 'thumb',
    label: 'Portada',
    render: (val) => val
      ? <span className="text-green-400 text-xs">✓</span>
      : <span className="text-red-400 text-xs">✗</span>,
  },
  {
    key: '_fix',
    label: '',
    sortable: false,
    render: (_, row, ctx) => (
      <button
        onClick={() => ctx.openFix(row)}
        className="text-xs bg-plex-orange text-plex-dark font-semibold px-2.5 py-1 rounded hover:opacity-90"
      >
        Fix match
      </button>
    ),
  },
]

export default function AlbumNoMatch() {
  const { library } = useScan()
  const { data } = useAuditData('albums_no_match')
  const [fixItem, setFixItem] = useState(null)
  const [fixedKeys, setFixedKeys] = useState(new Set())

  const ctx = { openFix: setFixItem }
  const cols = columns.map((col) =>
    col.key === '_fix' ? { ...col, render: (val, row) => col.render(val, row, ctx) } : col
  )

  function handleFixed(ratingKey) {
    if (ratingKey) setFixedKeys(prev => new Set([...prev, ratingKey]))
    setFixItem(null)
  }

  const displayData = (data ?? []).filter(r => !fixedKeys.has(r.ratingKey))

  return (
    <ScanGate stepKey="albums_no_match">
      <h1 className="text-2xl font-bold mb-1">Albums sin match</h1>
      <p className="text-plex-muted mb-2 text-sm">{library}</p>
      <p className="text-xs text-plex-muted mb-5">
        Albums con GUID <code className="bg-plex-card px-1 rounded">local://</code> — Plex no los matcheó con ningún agente. Fijar el match descargará portada, año y géneros.
      </p>
      <AuditTable columns={cols} data={displayData} emptyMessage="Todos los albums tienen match ✓" />
      {fixItem && (
        <FixMatchModal item={fixItem} type="album" onClose={() => setFixItem(null)} onFixed={handleFixed} />
      )}
    </ScanGate>
  )
}
