import { useState, useMemo, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSearchParams, Link } from 'react-router-dom'
import { useScan } from '../context/ScanContext'
import AutoMatchModal from '../components/AutoMatchModal'
import FixMatchModal from '../components/FixMatchModal'
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

// Separators that indicate a compound artist name
const COMPOUND_RE = /\s+[Aa]nd\s+|\s+&\s+|\s*\/\s+|\s+[Xx×]\s+|\s+[Ff]eat(?:\.?|uring)\s+|\s+\+\s+|\s+[Vv]s\.?\s+|\s+,\s+/

function parseComponents(title) {
  return title.split(COMPOUND_RE).map(s => s.trim()).filter(Boolean)
}

function looksCompound(title) {
  return parseComponents(title).length > 1
}

// is_single overrides auto-detection; is_compound forces compound for non-detected names
function isEffectivelyCompound(a) {
  if (a.is_single)   return false
  if (a.is_compound) return true
  return looksCompound(a.title)
}

function mbSearchUrl(q)      { return `https://musicbrainz.org/search?query=${encodeURIComponent(q)}&type=artist` }
function discogsSearchUrl(q) { return `https://www.discogs.com/search/?q=${encodeURIComponent(q)}&type=artist` }
function lastfmSearchUrl(q)  { return `https://www.last.fm/search/artists?q=${encodeURIComponent(q)}` }

function ServiceChip({ href, label, onEdit }) {
  return (
    <div className="flex items-center gap-1">
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-xs font-medium bg-green-500/15 text-green-400 border border-green-500/30 hover:bg-green-500/25 transition-colors whitespace-nowrap"
      >
        {label} ↗
      </a>
      <button
        onClick={onEdit}
        title="Change link"
        className="text-plex-muted hover:text-white text-xs w-5 h-5 flex items-center justify-center rounded hover:bg-plex-border transition-colors"
      >
        ⋯
      </button>
    </div>
  )
}

function LinkBtn({ onClick }) {
  return (
    <button
      onClick={onClick}
      className="text-xs border border-dashed border-plex-border text-plex-muted hover:text-white hover:border-white px-2 py-0.5 rounded transition-colors whitespace-nowrap"
    >
      + Link
    </button>
  )
}

// Shows parsed components with: internal artist link if found in library, otherwise external search links
function CompoundComponents({ title, allArtists }) {
  const parts = parseComponents(title)
  if (parts.length <= 1) return null

  return (
    <div className="mt-1.5 space-y-1.5">
      {parts.map((part, i) => {
        const match = allArtists.find(
          a => a.title.toLowerCase() === part.toLowerCase()
        )
        return (
          <div key={i} className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs text-plex-muted truncate max-w-[160px]" title={part}>
              {part}
            </span>
            {match ? (
              <Link
                to={`/artists/${match.ratingKey}`}
                className="text-[10px] px-2 py-0.5 rounded border border-plex-orange/40 text-plex-orange hover:bg-plex-orange/10 transition-colors whitespace-nowrap"
                title="This artist exists in your library — go to their page to map services"
              >
                → Go to artist
              </Link>
            ) : (
              <>
                <a href={mbSearchUrl(part)} target="_blank" rel="noopener noreferrer"
                  className="text-[10px] px-1.5 py-0.5 rounded border border-plex-border text-plex-muted hover:text-white hover:border-white transition-colors whitespace-nowrap">
                  MB ↗
                </a>
                <a href={discogsSearchUrl(part)} target="_blank" rel="noopener noreferrer"
                  className="text-[10px] px-1.5 py-0.5 rounded border border-plex-border text-plex-muted hover:text-white hover:border-white transition-colors whitespace-nowrap">
                  Discogs ↗
                </a>
                <a href={lastfmSearchUrl(part)} target="_blank" rel="noopener noreferrer"
                  className="text-[10px] px-1.5 py-0.5 rounded border border-plex-border text-plex-muted hover:text-white hover:border-white transition-colors whitespace-nowrap">
                  Last.fm ↗
                </a>
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default function Artists() {
  const { library } = useScan()
  const queryClient = useQueryClient()
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

  const [autoItem,    setAutoItem]    = useState(null)
  const [fixItem,     setFixItem]     = useState(null)
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

  function closeAuto(key)    { setAutoItem(null);    refreshArtist(key || autoItem?.ratingKey) }
  function closeFix(key)     { setFixItem(null);     refreshArtist(key || fixItem?.ratingKey) }
  function closeDiscogs(key) { setDiscogsItem(null); refreshArtist(key || discogsItem?.ratingKey) }
  function closeLastfm(key)  { setLastfmItem(null);  refreshArtist(key || lastfmItem?.ratingKey) }

  // Compound manual flag — for names the regex doesn't detect
  const compoundMutation = useMutation({
    mutationFn: async ({ ratingKey, is_compound }) => {
      const res = await fetch(`/api/artist/${ratingKey}/links/compound`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_compound }),
      })
      if (!res.ok) throw new Error('Failed')
      return res.json()
    },
    onSuccess: (_, { ratingKey, is_compound }) => {
      setOverrides(prev => ({ ...prev, [ratingKey]: { ...prev[ratingKey], is_compound } }))
    },
  })

  // Single-artist override — marks auto-detected compound as actually a single artist
  const singleMutation = useMutation({
    mutationFn: async ({ ratingKey, is_single }) => {
      const res = await fetch(`/api/artist/${ratingKey}/links/single`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_single }),
      })
      if (!res.ok) throw new Error('Failed')
      return res.json()
    },
    onSuccess: (_, { ratingKey, is_single }) => {
      setOverrides(prev => ({ ...prev, [ratingKey]: { ...prev[ratingKey], is_single } }))
    },
  })

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
        list = list.filter(a => !a.isMatched && !a.discogs_id && !a.lastfm_name && !isEffectivelyCompound(a))
        break
      case 'no_mb':      list = list.filter(a => !a.isMatched); break
      case 'no_discogs': list = list.filter(a => !a.discogs_id); break
      case 'no_lastfm':  list = list.filter(a => !a.lastfm_name); break
      case 'compound':   list = list.filter(a => isEffectivelyCompound(a)); break
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

      {isLoading && (
        <div className="flex flex-col items-center justify-center h-48 gap-2">
          <p className="text-plex-muted animate-pulse">Loading artists...</p>
          <p className="text-xs text-plex-muted">This may take a few seconds for large libraries</p>
        </div>
      )}
      {error && <p className="text-red-400 text-sm">{error.message}</p>}

      {!isLoading && !error && (
        <>
          <div className="text-xs text-plex-muted text-right">
            {isSearching
              ? `${filtered.length} result${filtered.length !== 1 ? 's' : ''}`
              : `${filtered.length} artists · page ${currentPage}/${totalPages}`}
          </div>

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
                {pageItems.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-plex-muted text-sm">
                      No artists match this filter.
                    </td>
                  </tr>
                )}
                {pageItems.map(a => {
                  const autoDetected = looksCompound(a.title)
                  const effectivelyCompound = isEffectivelyCompound(a)
                  return (
                    <tr
                      key={a.ratingKey}
                      className="border-b border-plex-border/40 last:border-0 hover:bg-plex-dark/30 transition-colors"
                    >
                      {/* Artist */}
                      <td className="px-4 py-2.5">
                        <div className="flex items-start gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate max-w-xs">{a.title}</p>
                            {a.albumCount > 0 && (
                              <p className="text-xs text-plex-muted">
                                {a.albumCount} album{a.albumCount !== 1 ? 's' : ''}
                              </p>
                            )}
                            {/* Component breakdown — only in compound filter */}
                            {filter === 'compound' && effectivelyCompound && (
                              <CompoundComponents title={a.title} allArtists={merged} />
                            )}
                          </div>

                          {/* Compound status badge/button */}
                          {(filter === 'compound' || filter === 'no_match' || filter === 'all') && (
                            <div className="flex-shrink-0 mt-0.5">
                              {a.is_single ? (
                                // User marked as single artist — show badge + undo
                                <button
                                  onClick={() => singleMutation.mutate({ ratingKey: a.ratingKey, is_single: false })}
                                  title="Marked as single artist — click to undo"
                                  className="text-[10px] px-1.5 py-0.5 rounded border border-blue-500/40 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors whitespace-nowrap"
                                >
                                  ✓ single
                                </button>
                              ) : autoDetected ? (
                                // Auto-detected as compound — offer "Not compound" override
                                <button
                                  onClick={() => singleMutation.mutate({ ratingKey: a.ratingKey, is_single: true })}
                                  title="Auto-detected as compound — click if this is actually a single artist"
                                  className="text-[10px] px-1.5 py-0.5 rounded border border-amber-500/30 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-colors whitespace-nowrap"
                                >
                                  ⋱ auto
                                </button>
                              ) : (
                                // Not detected — allow manual compound flag
                                <button
                                  onClick={() => compoundMutation.mutate({ ratingKey: a.ratingKey, is_compound: !a.is_compound })}
                                  title={a.is_compound ? 'Unflag as compound' : 'Flag as compound'}
                                  className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors whitespace-nowrap ${
                                    a.is_compound
                                      ? 'border-amber-500/40 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20'
                                      : 'border-plex-border text-plex-muted hover:text-amber-400 hover:border-amber-500/40'
                                  }`}
                                >
                                  {a.is_compound ? '⋱ manual' : '⋱'}
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* MusicBrainz */}
                      <td className="px-3 py-2.5">
                        {a.isMatched ? (
                          <ServiceChip
                            href={`https://musicbrainz.org/artist/${a.mbid}`}
                            label="MusicBrainz"
                            onEdit={() => setAutoItem(a)}
                          />
                        ) : (
                          <div className="flex gap-1">
                            <button
                              onClick={() => setAutoItem(a)}
                              className="text-xs bg-plex-orange/20 text-plex-orange border border-plex-orange/40 hover:bg-plex-orange hover:text-plex-dark px-2 py-0.5 rounded transition-colors font-medium"
                            >
                              Auto
                            </button>
                            <button
                              onClick={() => setFixItem(a)}
                              className="text-xs border border-plex-border text-plex-muted hover:text-white hover:border-white px-2 py-0.5 rounded transition-colors"
                            >
                              Fix
                            </button>
                          </div>
                        )}
                      </td>

                      {/* Discogs */}
                      <td className="px-3 py-2.5">
                        {a.discogs_id ? (
                          <ServiceChip
                            href={`https://www.discogs.com/artist/${a.discogs_id}`}
                            label="Discogs"
                            onEdit={() => setDiscogsItem(a)}
                          />
                        ) : (
                          <LinkBtn onClick={() => setDiscogsItem(a)} />
                        )}
                      </td>

                      {/* Last.fm */}
                      <td className="px-3 py-2.5">
                        {a.lastfm_name ? (
                          <ServiceChip
                            href={`https://www.last.fm/music/${encodeURIComponent(a.lastfm_name)}`}
                            label="Last.fm"
                            onEdit={() => setLastfmItem(a)}
                          />
                        ) : (
                          <LinkBtn onClick={() => setLastfmItem(a)} />
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
      )}

      {autoItem    && <AutoMatchModal artist={autoItem}  onClose={() => closeAuto()}    onFixed={closeAuto} />}
      {fixItem     && <FixMatchModal  item={fixItem} type="artist" onClose={() => closeFix()} onFixed={closeFix} />}
      {discogsItem && <DiscogsLinkModal artist={discogsItem} onClose={closeDiscogs} />}
      {lastfmItem  && <LastFMLinkModal  artist={lastfmItem}  onClose={closeLastfm} />}
    </div>
  )
}
