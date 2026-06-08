import { useState, useMemo, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useScan } from '../context/ScanContext'
import MusicBrainzLinkModal from '../components/MusicBrainzLinkModal'
import DiscogsLinkModal from '../components/DiscogsLinkModal'
import LastFMLinkModal from '../components/LastFMLinkModal'

const PAGE_SIZE = 50

const FILTERS = [
  { id: 'all',        label: 'All' },
  { id: 'no_match',   label: 'No Match' },
  { id: 'no_mb',      label: 'No MusicBrainz' },
  { id: 'no_discogs', label: 'No Discogs' },
  { id: 'no_lastfm',  label: 'No Last.fm' },
  { id: 'compound',   label: 'Compound' },
]

export function LinkedChip({ count = 1, label, onClick }) {
  return (
    <button
      onClick={onClick}
      title="View / change link"
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-green-500/15 text-green-400 border border-green-500/30 hover:bg-green-500/25 transition-colors whitespace-nowrap"
    >
      {count > 1 ? `${count} ${label}` : label}
    </button>
  )
}

export function LinkBtn({ onClick }) {
  return (
    <button
      onClick={onClick}
      className="text-xs border border-dashed border-plex-border text-plex-muted hover:text-white hover:border-white px-2 py-0.5 rounded transition-colors whitespace-nowrap"
    >
      + Link
    </button>
  )
}

export default function Artists() {
  const { library, status } = useScan()
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

  const [mbItem,      setMbItem]      = useState(null)
  const [discogsItem, setDiscogsItem] = useState(null)
  const [lastfmItem,  setLastfmItem]  = useState(null)
  const [overrides,   setOverrides]   = useState({})

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

  const allArtistsReady = status.status === 'done' ||
    (status.steps ?? []).some(s => s.key === 'all_artists' && s.status === 'done')

  const { data: artists = [], isLoading, error } = useQuery({
    queryKey: ['all-artists', library],
    queryFn: async () => {
      const res = await fetch(`/api/artists?library=${encodeURIComponent(library)}`)
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || 'Error') }
      return res.json()
    },
    enabled: !!library && allArtistsReady,
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

  function closeMb(key)      { setMbItem(null);      refreshArtist(key || mbItem?.ratingKey) }
  function closeDiscogs(key) { setDiscogsItem(null); refreshArtist(key || discogsItem?.ratingKey) }
  function closeLastfm(key)  { setLastfmItem(null);  refreshArtist(key || lastfmItem?.ratingKey) }

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
      case 'no_match':
        list = list.filter(a =>
          !a.isMatched &&
          (a.discogs_links ?? []).length === 0 &&
          (a.lastfm_links ?? []).length === 0 &&
          !a.is_compound
        )
        break
      case 'no_mb':      list = list.filter(a => !a.isMatched); break
      case 'no_discogs': list = list.filter(a => (a.discogs_links ?? []).length === 0); break
      case 'no_lastfm':  list = list.filter(a => (a.lastfm_links ?? []).length === 0); break
      case 'compound':   list = list.filter(a => a.is_compound); break
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
        <h1 className="text-2xl font-bold mb-1">Artists</h1>
        <p className="text-plex-muted text-sm">{library} · {artists.length} artists</p>
      </div>

      {/* Search + filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          type="text"
          value={search}
          onChange={e => updateParams({ q: e.target.value, page: null })}
          placeholder="Search artist..."
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
          : `${filtered.length} artists · page ${currentPage}/${totalPages}`)}
      </div>

      <>
        <div className="bg-plex-card border border-plex-border rounded-xl overflow-hidden">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-plex-border bg-plex-dark/40">
                <th className="text-xs text-plex-muted font-normal text-left px-4 py-2.5">Artist</th>
                <th className="text-xs text-plex-muted font-normal text-left px-3 py-2.5 w-48">MusicBrainz</th>
                <th className="text-xs text-plex-muted font-normal text-left px-3 py-2.5 w-36">Discogs</th>
                <th className="text-xs text-plex-muted font-normal text-left px-3 py-2.5 w-36">Last.fm</th>
                <th className="text-xs text-plex-muted font-normal text-center py-2.5 w-20">Plex</th>
              </tr>
            </thead>
            <tbody>
              {(!allArtistsReady || isLoading) && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-plex-muted text-sm animate-pulse">
                    {!allArtistsReady
                      ? `Scanning library... ${(status.steps ?? []).find(s => s.status === 'running')?.label ?? ''}`
                      : 'Loading artists...'}
                  </td>
                </tr>
              )}
              {allArtistsReady && !isLoading && pageItems.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-plex-muted text-sm">
                    No artists match this filter.
                  </td>
                </tr>
              )}
              {pageItems.map(a => {
                const discogsLinks = a.discogs_links ?? []
                const lastfmLinks  = a.lastfm_links ?? []
                const mbLinks      = a.mb_links ?? []
                return (
                  <tr
                    key={a.ratingKey}
                    className="border-b border-plex-border/40 last:border-0 hover:bg-plex-dark/30 transition-colors"
                  >
                    {/* Artist */}
                    <td className="px-4 py-2.5">
                      <button
                        onClick={() => navigate(`/artists/${a.ratingKey}`)}
                        className="text-sm font-medium truncate max-w-xs text-left hover:text-plex-orange hover:underline transition-colors"
                      >
                        {a.title}
                      </button>
                      {a.albumCount > 0 && (
                        <p className="text-xs text-plex-muted">
                          {a.albumCount} album{a.albumCount !== 1 ? 's' : ''}
                        </p>
                      )}
                    </td>

                    {/* MusicBrainz */}
                    <td className="px-3 py-2.5">
                      {mbLinks.length > 1 ? (
                        <LinkedChip count={mbLinks.length} label="MusicBrainz" onClick={() => setMbItem(a)} />
                      ) : a.isMatched || mbLinks.length === 1 ? (
                        <LinkedChip label="MusicBrainz" onClick={() => setMbItem(a)} />
                      ) : (
                        <LinkBtn onClick={() => setMbItem(a)} />
                      )}
                    </td>

                    {/* Discogs */}
                    <td className="px-3 py-2.5">
                      {discogsLinks.length === 0 ? (
                        <LinkBtn onClick={() => setDiscogsItem(a)} />
                      ) : (
                        <LinkedChip count={discogsLinks.length} label="Discogs" onClick={() => setDiscogsItem(a)} />
                      )}
                    </td>

                    {/* Last.fm */}
                    <td className="px-3 py-2.5">
                      {lastfmLinks.length === 0 ? (
                        <LinkBtn onClick={() => setLastfmItem(a)} />
                      ) : (
                        <LinkedChip count={lastfmLinks.length} label="Last.fm" onClick={() => setLastfmItem(a)} />
                      )}
                    </td>

                    {/* Plex */}
                    <td className="text-center py-2.5">
                      {plexArtistUrl(a.ratingKey) && (
                        <a
                          href={plexArtistUrl(a.ratingKey)}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Open in Plex"
                          className="text-xs border border-plex-border text-plex-muted hover:text-plex-orange hover:border-plex-orange px-2 py-0.5 rounded transition-colors"
                        >
                          Plex ↗
                        </a>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

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

      {mbItem      && <MusicBrainzLinkModal artist={mbItem}      onClose={closeMb} />}
      {discogsItem && <DiscogsLinkModal     artist={discogsItem} onClose={closeDiscogs} />}
      {lastfmItem  && <LastFMLinkModal      artist={lastfmItem}  onClose={closeLastfm} />}
    </div>
  )
}
