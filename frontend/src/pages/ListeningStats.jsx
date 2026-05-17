import { useState } from 'react'
import { useScan } from '../context/ScanContext'
import { useAuditData } from '../hooks/useAuditData'
import AuditTable from '../components/AuditTable'
import ScanGate from '../components/ScanGate'
import FixMatchModal from '../components/FixMatchModal'

const TAB_NEVER = 'never'
const TAB_TOP   = 'top'
const TAB_STALE = 'stale'

const neverCols = [
  { key: 'title', label: 'Artista' },
  { key: 'daysInLibrary', label: 'Días en librería', render: (val) => val != null ? `${val}d` : '—' },
  {
    key: '_fix',
    label: '',
    sortable: false,
    render: (_, row, ctx) => (
      <button onClick={() => ctx.openFix(row)} className="text-xs bg-plex-orange text-plex-dark font-semibold px-2.5 py-1 rounded hover:opacity-90">
        Fix match
      </button>
    ),
  },
]

const topCols = [
  { key: 'title', label: 'Artista' },
  { key: 'viewCount', label: 'Plays' },
  { key: 'lastViewedAt', label: 'Último play', render: (val) => val ? new Date(val).toLocaleDateString() : '—' },
]

const staleCols = [
  { key: 'title', label: 'Artista' },
  { key: 'viewCount', label: 'Plays totales' },
  { key: 'daysSincePlay', label: 'Días sin escuchar', render: (val) => val != null ? `${val}d` : '—' },
  { key: 'lastViewedAt', label: 'Último play', render: (val) => val ? new Date(val).toLocaleDateString() : '—' },
]

function Content() {
  const { library } = useScan()
  const { data } = useAuditData('listening_stats')
  const [tab, setTab] = useState(TAB_NEVER)
  const [fixArtist, setFixArtist] = useState(null)
  const [fixedKeys, setFixedKeys] = useState(new Set())

  const summary = data?.summary || {}
  const ctx = { openFix: setFixArtist }

  const neverColsWithCtx = neverCols.map((col) =>
    col.key === '_fix' ? { ...col, render: (val, row) => col.render(val, row, ctx) } : col
  )

  function handleFixed(ratingKey) {
    if (ratingKey) setFixedKeys(prev => new Set([...prev, ratingKey]))
    setFixArtist(null)
  }

  const neverPlayed = (data?.neverPlayed ?? []).filter(r => !fixedKeys.has(r.ratingKey))

  const tabs = [
    { id: TAB_NEVER, label: `Nunca escuchados (${neverPlayed.length})` },
    { id: TAB_TOP,   label: `Top 20 artistas` },
    { id: TAB_STALE, label: `Sin escuchar +180d (${summary.stalePlayed180dCount ?? 0})` },
  ]

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Stats de escucha</h1>
      <p className="text-plex-muted mb-5 text-sm">{library}</p>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-plex-card border border-plex-border rounded-lg p-4">
          <p className="text-xs text-plex-muted mb-1">Total plays</p>
          <p className="text-2xl font-bold">{(summary.totalPlays ?? 0).toLocaleString()}</p>
        </div>
        <div className="bg-plex-card border-l-4 border-red-500 rounded-lg p-4">
          <p className="text-xs text-plex-muted mb-1">Nunca escuchados</p>
          <p className="text-2xl font-bold">{neverPlayed.length}</p>
        </div>
        <div className="bg-plex-card border-l-4 border-yellow-500 rounded-lg p-4">
          <p className="text-xs text-plex-muted mb-1">Sin escuchar +6 meses</p>
          <p className="text-2xl font-bold">{summary.stalePlayed180dCount ?? 0}</p>
        </div>
      </div>

      <div className="flex gap-1 mb-4 border-b border-plex-border">
        {tabs.map(({ id, label }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              tab === id ? 'text-plex-orange border-b-2 border-plex-orange' : 'text-plex-muted hover:text-white'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === TAB_NEVER && <AuditTable columns={neverColsWithCtx} data={neverPlayed} emptyMessage="Todos los artistas han sido escuchados ✓" />}
      {tab === TAB_TOP   && <AuditTable columns={topCols} data={data?.topPlayed ?? []} emptyMessage="Sin datos de plays" />}
      {tab === TAB_STALE && <AuditTable columns={staleCols} data={data?.stalePlayed ?? []} emptyMessage="No hay artistas sin escuchar en +180 días ✓" />}

      {fixArtist && (
        <FixMatchModal item={fixArtist} type="artist" onClose={() => setFixArtist(null)} onFixed={handleFixed} />
      )}
    </div>
  )
}

export default function ListeningStats() {
  return <ScanGate stepKey="listening_stats"><Content /></ScanGate>
}
