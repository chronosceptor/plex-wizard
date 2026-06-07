import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import CompoundLinksSection from './CompoundLinksSection'

const BTN = 'px-4 py-2 bg-plex-dark border border-plex-border hover:border-plex-orange text-white text-sm rounded-lg disabled:opacity-50 transition-colors whitespace-nowrap'

// Used for single artists: searches via Plex agent, applies via fix-match
function PlexSearchPanel({ ratingKey, initialQuery, currentMbid, onApply }) {
  const [query, setQuery]         = useState(initialQuery)
  const [activeQuery, setActiveQuery] = useState(initialQuery)
  const [manualUuid, setManualUuid]   = useState('')
  const [autoMode, setAutoMode]       = useState(false)

  const { data: plexResults, isLoading: plexLoading } = useQuery({
    queryKey: ['plex-mb-search', ratingKey, activeQuery],
    queryFn: async () => {
      const res = await fetch(`/api/artist/${ratingKey}/matches?query=${encodeURIComponent(activeQuery)}`)
      if (!res.ok) throw new Error('Search failed')
      return res.json()
    },
    enabled: !autoMode,
    staleTime: 5 * 60 * 1000,
  })

  const { data: autoData, isLoading: autoLoading, refetch: runAuto } = useQuery({
    queryKey: ['mb-auto', ratingKey],
    queryFn: async () => {
      const res = await fetch(`/api/artist/${ratingKey}/auto-match`)
      if (!res.ok) throw new Error('Auto-match failed')
      return res.json()
    },
    enabled: false,
    staleTime: 5 * 60 * 1000,
  })

  function handleSearch(e) {
    e.preventDefault()
    if (query.trim()) { setAutoMode(false); setActiveQuery(query.trim()) }
  }

  function handleAuto() {
    setAutoMode(true)
    runAuto()
  }

  function handleManual(e) {
    e.preventDefault()
    const uuid = manualUuid.trim()
    if (uuid) onApply({ type: 'mbid', uuid })
  }

  const isLoading = autoMode ? autoLoading : plexLoading

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <form onSubmit={handleSearch} className="flex gap-2 flex-1">
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search MusicBrainz..."
            className="flex-1 bg-plex-dark border border-plex-border rounded-lg px-3 py-2 text-sm text-white placeholder-plex-muted focus:outline-none focus:border-plex-orange"
          />
          <button type="submit" disabled={isLoading || !query.trim()} className={BTN}>
            Search
          </button>
        </form>
        <button type="button" onClick={handleAuto} disabled={isLoading} className={BTN}
          title="Auto-match by comparing album lists">
          Auto
        </button>
      </div>

      <form onSubmit={handleManual} className="flex gap-2">
        <input
          type="text"
          value={manualUuid}
          onChange={e => setManualUuid(e.target.value)}
          placeholder="Or paste MusicBrainz UUID..."
          className="flex-1 bg-plex-dark border border-plex-border rounded-lg px-3 py-2 text-sm text-white placeholder-plex-muted focus:outline-none focus:border-plex-orange font-mono"
        />
        <button type="submit" disabled={!manualUuid.trim()} className={BTN}>
          Link ID
        </button>
      </form>

      {isLoading && (
        <p className="text-plex-muted text-sm animate-pulse">
          {autoMode ? 'Comparing albums with MusicBrainz...' : 'Searching...'}
        </p>
      )}

      {/* Plex search results */}
      {!autoMode && !plexLoading && (
        <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
          {(plexResults ?? []).map(r => {
            const mbid = r.guid?.replace('mbid://', '')
            const isLinked = mbid && currentMbid === mbid
            return (
              <button
                key={r.guid}
                onClick={() => onApply({ type: 'fix', guid: r.guid, name: r.name })}
                className={`w-full flex items-center justify-between gap-3 p-3 rounded-lg border text-left transition-colors ${
                  isLinked ? 'border-green-500/40 bg-green-500/10' : 'border-plex-border hover:border-plex-orange hover:bg-plex-dark/60'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate">{r.name}</p>
                    {r.year && <span className="text-xs text-plex-muted">{r.year}</span>}
                    {mbid && (
                      <a href={`https://musicbrainz.org/artist/${mbid}`} target="_blank"
                        rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                        className="text-xs text-plex-muted hover:text-plex-orange font-mono">
                        {mbid.slice(0, 8)}… ↗
                      </a>
                    )}
                  </div>
                  {r.score != null && <p className="text-xs text-plex-muted mt-0.5">Score: {r.score}</p>}
                </div>
                {isLinked && <span className="text-green-400 text-xs flex-shrink-0">✓</span>}
              </button>
            )
          })}
          {plexResults?.length === 0 && <p className="text-plex-muted text-sm">No results.</p>}
        </div>
      )}

      {/* Auto-match results */}
      {autoMode && !autoLoading && (
        <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
          {(autoData?.candidates ?? []).map(c => {
            const isLinked = currentMbid === c.mbid
            return (
              <button
                key={c.mbid}
                onClick={() => onApply({ type: 'mbid', uuid: c.mbid })}
                className={`w-full flex items-center justify-between gap-3 p-3 rounded-lg border text-left transition-colors ${
                  isLinked ? 'border-green-500/40 bg-green-500/10' : 'border-plex-border hover:border-plex-orange hover:bg-plex-dark/60'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate">{c.name}</p>
                    {c.founded && <span className="text-xs text-plex-muted">{c.founded}</span>}
                    {c.country && <span className="text-xs text-plex-muted">{c.country}</span>}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-plex-orange">{c.confidence}% match</span>
                    <a href={`https://musicbrainz.org/artist/${c.mbid}`} target="_blank"
                      rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                      className="text-xs text-plex-muted hover:text-plex-orange font-mono">
                      {c.mbid.slice(0, 8)}… ↗
                    </a>
                  </div>
                </div>
                {isLinked && <span className="text-green-400 text-xs flex-shrink-0">✓</span>}
              </button>
            )
          })}
          {autoData?.candidates?.length === 0 && <p className="text-plex-muted text-sm">No auto-match candidates found.</p>}
        </div>
      )}
    </div>
  )
}

// Used inside CompoundLinksSection: searches MB directly, returns mbid string
function MBDirectSearchPanel({ initialQuery, onLink }) {
  const [query, setQuery]       = useState(initialQuery)
  const [activeQuery, setActiveQuery] = useState(initialQuery)
  const [manualUuid, setManualUuid]   = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['mb-search', activeQuery],
    queryFn: async () => {
      const res = await fetch(`/api/mb-search?q=${encodeURIComponent(activeQuery)}`)
      if (!res.ok) throw new Error('Search failed')
      return res.json()
    },
    staleTime: 5 * 60 * 1000,
  })

  function handleSearch(e) {
    e.preventDefault()
    if (query.trim()) setActiveQuery(query.trim())
  }

  function handleManual(e) {
    e.preventDefault()
    if (manualUuid.trim()) onLink(manualUuid.trim())
  }

  return (
    <div className="space-y-2">
      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search MusicBrainz..."
          className="flex-1 bg-plex-dark border border-plex-border rounded-lg px-3 py-2 text-sm text-white placeholder-plex-muted focus:outline-none focus:border-plex-orange"
        />
        <button type="submit" disabled={isLoading || !query.trim()} className={BTN}>Search</button>
      </form>
      <form onSubmit={handleManual} className="flex gap-2">
        <input
          type="text"
          value={manualUuid}
          onChange={e => setManualUuid(e.target.value)}
          placeholder="Or paste UUID..."
          className="flex-1 bg-plex-dark border border-plex-border rounded-lg px-3 py-2 text-sm text-white placeholder-plex-muted focus:outline-none focus:border-plex-orange font-mono"
        />
        <button type="submit" disabled={!manualUuid.trim()} className={BTN}>Link ID</button>
      </form>
      {isLoading && <p className="text-plex-muted text-sm animate-pulse">Searching...</p>}
      <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
        {(data?.results ?? []).map(c => (
          <button key={c.mbid} onClick={() => onLink(c.mbid)}
            className="w-full flex items-center justify-between gap-3 p-2.5 rounded-lg border border-plex-border hover:border-plex-orange hover:bg-plex-dark/60 text-left transition-colors">
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{c.name}</p>
              <div className="flex gap-2 mt-0.5">
                {c.founded && <span className="text-xs text-plex-muted">{c.founded}</span>}
                {c.country && <span className="text-xs text-plex-muted">{c.country}</span>}
                <span className="text-xs text-plex-muted font-mono">{c.mbid.slice(0, 8)}…</span>
              </div>
            </div>
          </button>
        ))}
        {data?.results?.length === 0 && <p className="text-plex-muted text-sm">No results.</p>}
      </div>
    </div>
  )
}

export default function MusicBrainzLinkModal({ artist, onClose }) {
  const fixMatch = useMutation({
    mutationFn: async ({ guid, name }) => {
      const res = await fetch(`/api/artist/${artist.ratingKey}/fix-match`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guid, name }),
      })
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || 'Failed') }
      return res.json()
    },
    onSuccess: () => onClose(artist.ratingKey),
  })

  const fixMbid = useMutation({
    mutationFn: async (uuid) => {
      const res = await fetch(`/api/artist/${artist.ratingKey}/fix-match-mbid?uuid=${encodeURIComponent(uuid)}`, { method: 'PUT' })
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || 'Failed') }
      return res.json()
    },
    onSuccess: () => onClose(artist.ratingKey),
  })

  function handleApply(payload) {
    if (payload.type === 'fix') fixMatch.mutate({ guid: payload.guid, name: payload.name })
    else fixMbid.mutate(payload.uuid)
  }

  const isPending = fixMatch.isPending || fixMbid.isPending
  const applyError = fixMatch.error || fixMbid.error

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-plex-card border border-plex-border rounded-xl w-full max-w-lg mx-4 shadow-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-plex-border flex-shrink-0">
          <div>
            <h2 className="font-semibold">MusicBrainz</h2>
            <p className="text-sm text-plex-muted">{artist.title}</p>
          </div>
          <button onClick={() => onClose()}
            className="text-plex-muted hover:text-white text-2xl leading-none w-8 h-8 flex items-center justify-center">
            ×
          </button>
        </div>

        <div className="p-4 space-y-3 overflow-y-auto">
          {isPending && <p className="text-plex-muted text-sm animate-pulse">Applying match...</p>}
          {applyError && <p className="text-red-400 text-sm">{applyError.message}</p>}

          {artist.is_compound ? (
            <CompoundLinksSection
              ratingKey={artist.ratingKey}
              service="musicbrainz"
              renderSearch={(componentName, onLink) => (
                <MBDirectSearchPanel initialQuery={componentName} onLink={onLink} />
              )}
            />
          ) : (
            <PlexSearchPanel
              ratingKey={artist.ratingKey}
              initialQuery={artist.title}
              currentMbid={artist.mbid}
              onApply={handleApply}
            />
          )}
        </div>
      </div>
    </div>
  )
}
