import { useState, useMemo, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useScan } from '../context/ScanContext'
import EnrichModal from '../components/EnrichModal'
import AutoMatchModal from '../components/AutoMatchModal'
import FixMatchModal from '../components/FixMatchModal'

const PAGE_SIZE = 50

const FILTERS = [
  { id: 'all',        label: 'Todos' },
  { id: 'issues',     label: 'Con problemas' },
  { id: 'no_match',   label: 'Sin match' },
  { id: 'no_country', label: 'Sin país' },
  { id: 'no_genres',  label: 'Sin géneros' },
  { id: 'no_styles',  label: 'Sin styles' },
  { id: 'no_mood',    label: 'Sin mood' },
  { id: 'no_photo',   label: 'Sin foto/bio' },
]

function Dot({ ok, title, count }) {
  return (
    <div className="flex flex-col items-center gap-0.5" title={title}>
      <span className={`inline-block w-2.5 h-2.5 rounded-full ${ok ? 'bg-green-400' : 'bg-red-500'}`} />
      {count != null && (
        <span className={`text-[9px] font-mono leading-none ${ok ? 'text-green-400' : 'text-red-500/60'}`}>
          {count}
        </span>
      )}
    </div>
  )
}

export default function Artists() {
  const { library } = useScan()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const search = searchParams.get('q') ?? ''
  const filter = searchParams.get('filter') ?? 'all'
  const page   = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))

  function updateParams(updates) {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      for (const [k, v] of Object.entries(updates)) {
        if (v == null || v === '' || v === 'all' || v === 1 || v === '1') next.delete(k)
        else next.set(k, String(v))
      }
      return next
    }, { replace: true })
  }

  const [enrichItem, setEnrichItem] = useState(null)
  const [autoItem, setAutoItem]     = useState(null)
  const [fixItem, setFixItem]       = useState(null)
  const [overrides, setOverrides]   = useState({})

  const { data: plexInfo } = useQuery({
    queryKey: ['plex-info'],
    queryFn: async () => {
      const res = await fetch('/api/plex-info')
      if (!res.ok) throw new Error('plex-info failed')
      return res.json()
    },
    staleTime: 30 * 60 * 1000,
    retry: 2,
  })

  const { data: artists = [], isLoading, error } = useQuery({
    queryKey: ['all-artists', library],
    queryFn: async () => {
      const res = await fetch(`/api/artists?library=${encodeURIComponent(library)}`)
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || 'Error') }
      return res.json()
    },
    enabled: !!library,
    staleTime: 10 * 60 * 1000,
  })

  function plexArtistUrl(ratingKey) {
    if (!plexInfo?.machineIdentifier) return null
    const key = encodeURIComponent(`/library/metadata/${ratingKey}`)
    return `https://app.plex.tv/desktop/#!/server/${plexInfo.machineIdentifier}/details?key=${key}&context=source%3Acontent.library~0~0`
  }

  const refreshArtist = useCallback(async (ratingKey) => {
    if (!ratingKey) return
    try {
      const res = await fetch(`/api/artist/${ratingKey}/status`)
      if (res.ok) {
        const fresh = await res.json()
        setOverrides(prev => ({ ...prev, [ratingKey]: fresh }))
      }
    } catch {}
  }, [])

  function closeEnrich()  { const k = enrichItem?.ratingKey; setEnrichItem(null); refreshArtist(k) }
  function closeAuto(key) { setAutoItem(null); refreshArtist(key || autoItem?.ratingKey) }
  function closeFix(key)  { setFixItem(null);  refreshArtist(key || fixItem?.ratingKey)  }

  const merged = useMemo(() =>
    artists.map(a => ({ ...a, ...(overrides[a.ratingKey] || {}) })),
    [artists, overrides]
  )

  const filtered = useMemo(() => {
    let list = merged
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(a => a.title.toLowerCase().includes(q))
    }
    switch (filter) {
      case 'issues':     list = list.filter(a => !a.isMatched || !a.country || !a.genres?.length || !a.styles?.length || !a.moods?.length || !a.thumb || !a.hasBio); break
      case 'no_match':   list = list.filter(a => !a.isMatched); break
      case 'no_country': list = list.filter(a => !a.country); break
      case 'no_genres':  list = list.filter(a => !a.genres?.length); break
      case 'no_styles':  list = list.filter(a => !a.styles?.length); break
      case 'no_mood':    list = list.filter(a => !a.moods?.length); break
      case 'no_photo':   list = list.filter(a => !a.thumb || !a.hasBio); break
    }
    return list
  }, [merged, search, filter])

  // When searching, show all results without pagination
  const isSearching  = search.trim() !== ''
  const totalPages   = isSearching ? 1 : Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage  = isSearching ? 1 : Math.min(page, totalPages)
  const pageItems    = isSearching ? filtered : filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  if (!library) return (
    <div className="flex items-center justify-center h-64">
      <p className="text-plex-muted">Selecciona una librería primero.</p>
    </div>
  )

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold mb-1">Artistas</h1>
        <p className="text-plex-muted text-sm">{library} · {artists.length} artistas</p>
      </div>

      {/* Search + filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          type="text"
          value={search}
          onChange={e => updateParams({ q: e.target.value, page: null })}
          placeholder="Buscar artista..."
          className="flex-1 bg-plex-dark border border-plex-border rounded px-3 py-1.5 text-sm focus:outline-none focus:border-plex-orange"
        />
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map(f => (
            <button key={f.id} onClick={() => updateParams({ filter: f.id, page: null })}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                filter === f.id ? 'bg-plex-orange text-plex-dark' : 'border border-plex-border text-plex-muted hover:text-white hover:border-white'
              }`}
            >{f.label}</button>
          ))}
        </div>
      </div>

      {isLoading && (
        <div className="flex flex-col items-center justify-center h-48 gap-2">
          <p className="text-plex-muted animate-pulse">Cargando artistas...</p>
          <p className="text-xs text-plex-muted">Puede tomar unos segundos para librerías grandes</p>
        </div>
      )}
      {error && <p className="text-red-400 text-sm">{error.message}</p>}

      {!isLoading && !error && (
        <>
          <div className="flex gap-4 text-xs text-plex-muted">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-green-400 inline-block" /> OK</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" /> Falta</span>
            <span className="ml-auto">
              {isSearching
                ? `${filtered.length} resultado${filtered.length !== 1 ? 's' : ''}`
                : `${filtered.length} artistas · pág. ${currentPage}/${totalPages}`}
            </span>
          </div>

          <div className="bg-plex-card border border-plex-border rounded-xl overflow-hidden">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-plex-border bg-plex-dark/40">
                  <th className="text-xs text-plex-muted font-normal text-left px-4 py-2">Artista</th>
                  <th className="text-xs text-plex-muted font-normal text-center w-14 py-2" title="Matcheado con MusicBrainz">Match</th>
                  <th className="text-xs text-plex-muted font-normal text-center w-14 py-2" title="País de origen">País</th>
                  <th className="text-xs text-plex-muted font-normal text-center w-16 py-2" title="Géneros (cantidad)">Géneros</th>
                  <th className="text-xs text-plex-muted font-normal text-center w-14 py-2" title="Styles (cantidad)">Styles</th>
                  <th className="text-xs text-plex-muted font-normal text-center w-14 py-2" title="Moods (cantidad)">Mood</th>
                  <th className="text-xs text-plex-muted font-normal text-center w-12 py-2" title="Foto del artista">Foto</th>
                  <th className="text-xs text-plex-muted font-normal text-center w-12 py-2" title="Biografía">Bio</th>
                  <th className="py-2 px-4 w-36"></th>
                </tr>
              </thead>
              <tbody>
                {pageItems.length === 0 && (
                  <tr><td colSpan={9} className="px-4 py-10 text-center text-plex-muted text-sm">No hay artistas con ese criterio.</td></tr>
                )}
                {pageItems.map(a => (
                  <tr key={a.ratingKey} className="border-b border-plex-border/40 last:border-0 hover:bg-plex-dark/30 transition-colors">
                    <td className="px-4 py-2.5">
                      <button onClick={() => navigate(`/artists/${a.ratingKey}`)}
                        className="text-sm font-medium truncate block max-w-xs hover:text-plex-orange transition-colors text-left">
                        {a.title}
                      </button>
                      <p className="text-xs text-plex-muted">
                        {a.albumCount > 0 ? `${a.albumCount} album${a.albumCount !== 1 ? 's' : ''}` : ''}
                        {a.viewCount > 0 && ` · ${a.viewCount} plays`}
                      </p>
                    </td>
                    <td className="text-center py-2.5">
                      <div className="flex justify-center">
                        <Dot ok={a.isMatched} title={a.isMatched ? 'Matcheado con MB' : 'Sin match'} />
                      </div>
                    </td>
                    <td className="text-center py-2.5">
                      <div className="flex justify-center">
                        <Dot ok={!!a.country} title={a.country || 'Sin país'} />
                      </div>
                    </td>
                    <td className="text-center py-2.5">
                      <div className="flex justify-center">
                        <Dot ok={a.genres?.length > 0} title={a.genres?.join(', ') || 'Sin géneros'} count={a.genres?.length || 0} />
                      </div>
                    </td>
                    <td className="text-center py-2.5">
                      <div className="flex justify-center">
                        <Dot ok={a.styles?.length > 0} title={a.styles?.join(', ') || 'Sin styles'} count={a.styles?.length || 0} />
                      </div>
                    </td>
                    <td className="text-center py-2.5">
                      <div className="flex justify-center">
                        <Dot ok={a.moods?.length > 0} title={a.moods?.join(', ') || 'Sin moods'} count={a.moods?.length || 0} />
                      </div>
                    </td>
                    <td className="text-center py-2.5">
                      <div className="flex justify-center">
                        <Dot ok={a.thumb} title={a.thumb ? 'Tiene foto' : 'Sin foto'} />
                      </div>
                    </td>
                    <td className="text-center py-2.5">
                      <div className="flex justify-center">
                        <Dot ok={a.hasBio} title={a.hasBio ? 'Tiene bio' : 'Sin bio'} />
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex gap-1 justify-end">
                        {!a.isMatched && (
                          <>
                            <button onClick={() => setAutoItem(a)}
                              className="text-xs bg-plex-orange/20 text-plex-orange border border-plex-orange/40 hover:bg-plex-orange hover:text-plex-dark px-2 py-1 rounded transition-colors font-medium">
                              Auto
                            </button>
                            <button onClick={() => setFixItem(a)}
                              className="text-xs border border-plex-border text-plex-muted hover:text-white hover:border-white px-2 py-1 rounded transition-colors">
                              Manual
                            </button>
                          </>
                        )}
                        <button onClick={() => setEnrichItem(a)}
                          className="text-xs bg-plex-orange text-plex-dark font-semibold px-2.5 py-1 rounded hover:opacity-90 transition-opacity">
                          Enrich
                        </button>
                        {plexArtistUrl(a.ratingKey) && (
                          <a href={plexArtistUrl(a.ratingKey)} target="_blank" rel="noopener noreferrer"
                            title="Ver en Plex"
                            className="text-xs border border-plex-border text-plex-muted hover:text-plex-orange hover:border-plex-orange px-2 py-1 rounded transition-colors">
                            Plex ↗
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!isSearching && totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button onClick={() => updateParams({ page: currentPage - 1 })} disabled={currentPage === 1}
                className="px-3 py-1.5 rounded border border-plex-border text-sm text-plex-muted hover:text-white hover:border-white disabled:opacity-30 transition-colors">
                ← Anterior
              </button>
              <span className="text-sm text-plex-muted">{currentPage} / {totalPages}</span>
              <button onClick={() => updateParams({ page: currentPage + 1 })} disabled={currentPage === totalPages}
                className="px-3 py-1.5 rounded border border-plex-border text-sm text-plex-muted hover:text-white hover:border-white disabled:opacity-30 transition-colors">
                Siguiente →
              </button>
            </div>
          )}
        </>
      )}

      {enrichItem && <EnrichModal artist={enrichItem} onClose={closeEnrich} />}
      {autoItem   && <AutoMatchModal artist={autoItem} onClose={() => closeAuto()} onFixed={closeAuto} />}
      {fixItem    && <FixMatchModal item={fixItem} type="artist" onClose={() => closeFix()} onFixed={closeFix} />}
    </div>
  )
}
