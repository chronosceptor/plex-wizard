import { useState, useMemo, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { useScan } from '../context/ScanContext'
import FixMatchModal from '../components/FixMatchModal'
import AlbumDiscogsModal from '../components/AlbumDiscogsModal'
import AlbumsTable from '../components/AlbumsTable'

const PAGE_SIZE = 50

const FILTERS = [
  { id: 'all',        label: 'All' },
  { id: 'no_match',   label: 'No Match' },
  { id: 'no_mb',      label: 'No MusicBrainz' },
  { id: 'no_discogs', label: 'No Discogs' },
  { id: 'no_artwork', label: 'No Artwork' },
]

export default function Albums() {
  const { library, status } = useScan()
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

  const [fixItem,     setFixItem]     = useState(null)
  const [discogsItem, setDiscogsItem] = useState(null)
  const [overrides,   setOverrides]   = useState({})

  const allAlbumsReady = status.status === 'done' ||
    (status.steps ?? []).some(s => s.key === 'all_albums' && s.status === 'done')

  const { data: albums = [], isLoading, error } = useQuery({
    queryKey: ['all-albums', library],
    queryFn: async () => {
      const res = await fetch(`/api/albums?library=${encodeURIComponent(library)}`)
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || 'Error') }
      return res.json()
    },
    enabled: !!library && allAlbumsReady,
    staleTime: 10 * 60 * 1000,
  })

  const refreshAlbum = useCallback(async (ratingKey) => {
    if (!ratingKey) return
    try {
      const res = await fetch(`/api/album/${ratingKey}/status`)
      if (res.ok) {
        const fresh = await res.json()
        setOverrides(prev => ({ ...prev, [ratingKey]: fresh }))
      }
    } catch {}
  }, [])

  function closeFix(key)     { setFixItem(null);     refreshAlbum(key || fixItem?.ratingKey) }
  function closeDiscogs(key) { setDiscogsItem(null); refreshAlbum(key || discogsItem?.ratingKey) }

  const merged = useMemo(() =>
    albums.map(a => ({ ...a, ...(overrides[a.ratingKey] || {}) })),
    [albums, overrides]
  )

  const filtered = useMemo(() => {
    let list = merged
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(a => a.title.toLowerCase().includes(q) || a.artist.toLowerCase().includes(q))
    }
    switch (filter) {
      case 'no_match':   list = list.filter(a => !a.isMatched && !a.discogs_id); break
      case 'no_mb':      list = list.filter(a => !a.isMatched); break
      case 'no_discogs': list = list.filter(a => !a.discogs_id); break
      case 'no_artwork': list = list.filter(a => !a.thumb); break
      default: break
    }
    return list
  }, [merged, search, filter])

  const isSearching = search.trim() !== ''
  const totalPages  = isSearching ? 1 : Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = isSearching ? 1 : Math.min(page, totalPages)
  const pageItems   = isSearching ? filtered : filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  if (!library) return (
    <div className="flex items-center justify-center h-64">
      <p className="text-plex-muted">Select a library first.</p>
    </div>
  )

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold mb-1">Albums</h1>
        <p className="text-plex-muted text-sm">{library} · {albums.length} albums</p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          type="text"
          value={search}
          onChange={e => updateParams({ q: e.target.value, page: null })}
          placeholder="Search album or artist..."
          className="flex-1 bg-plex-dark border border-plex-border rounded px-3 py-1.5 text-sm focus:outline-none focus:border-plex-orange"
        />
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map(f => (
            <button
              key={f.id}
              onClick={() => updateParams({ filter: f.id, page: null })}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                filter === f.id
                  ? 'bg-plex-orange text-plex-dark'
                  : 'border border-plex-border text-plex-muted hover:text-white hover:border-white'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-red-400 text-sm">{error.message}</p>}

      <div className="text-xs text-plex-muted text-right h-4">
        {!isLoading && !error && (isSearching
          ? `${filtered.length} result${filtered.length !== 1 ? 's' : ''}`
          : `${filtered.length} albums · page ${currentPage}/${totalPages}`)}
      </div>

      <>
        {(!allAlbumsReady || isLoading) && (
          <div className="bg-plex-card border border-plex-border rounded-xl px-4 py-10 text-center text-plex-muted text-sm animate-pulse">
            {!allAlbumsReady
              ? `Scanning library... ${(status.steps ?? []).find(s => s.status === 'running')?.label ?? ''}`
              : 'Loading albums...'}
          </div>
        )}
        {allAlbumsReady && !isLoading && (
          <AlbumsTable albums={pageItems} onFix={setFixItem} onDiscogs={setDiscogsItem} />
        )}

        {!isSearching && totalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={() => updateParams({ page: currentPage - 1 })}
              disabled={currentPage === 1}
              className="px-3 py-1.5 rounded border border-plex-border text-sm text-plex-muted hover:text-white hover:border-white disabled:opacity-30 transition-colors"
            >
              ← Previous
            </button>
            <span className="text-sm text-plex-muted">{currentPage} / {totalPages}</span>
            <button
              onClick={() => updateParams({ page: currentPage + 1 })}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 rounded border border-plex-border text-sm text-plex-muted hover:text-white hover:border-white disabled:opacity-30 transition-colors"
            >
              Next →
            </button>
          </div>
        )}
      </>

      {fixItem && (
        <FixMatchModal item={fixItem} type="album"
          onClose={closeFix} onFixed={closeFix} />
      )}
      {discogsItem && (
        <AlbumDiscogsModal album={discogsItem}
          onClose={closeDiscogs} onApplied={closeDiscogs} />
      )}
    </div>
  )
}
