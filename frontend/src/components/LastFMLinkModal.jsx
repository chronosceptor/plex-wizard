import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import CompoundLinksSection from './CompoundLinksSection'

const BTN = 'px-4 py-2 bg-plex-dark border border-plex-border hover:border-plex-orange text-white text-sm rounded-lg disabled:opacity-50 transition-colors whitespace-nowrap'

function LastFMSearchPanel({ initialQuery, onLink }) {
  const [query, setQuery]           = useState(initialQuery)
  const [searchTerm, setSearchTerm] = useState(initialQuery)
  const [manualName, setManualName] = useState('')

  const { data, isLoading, error } = useQuery({
    queryKey: ['lastfm-search', searchTerm],
    queryFn: async () => {
      const res = await fetch(`/api/lastfm/search?q=${encodeURIComponent(searchTerm)}`)
      if (!res.ok) throw new Error('Search failed')
      return res.json()
    },
    enabled: !!searchTerm,
    staleTime: 5 * 60 * 1000,
  })

  function handleSearch(e) {
    e.preventDefault()
    if (query.trim()) setSearchTerm(query.trim())
  }

  function handleManualLink(e) {
    e.preventDefault()
    if (manualName.trim()) onLink(manualName.trim())
  }

  return (
    <div className="space-y-2">
      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search Last.fm..."
          className="flex-1 bg-plex-dark border border-plex-border rounded-lg px-3 py-2 text-sm text-white placeholder-plex-muted focus:outline-none focus:border-plex-orange"
        />
        <button type="submit" disabled={isLoading || !query.trim()} className={BTN}>
          Search
        </button>
      </form>

      <form onSubmit={handleManualLink} className="flex gap-2 items-center">
        <input
          type="text"
          value={manualName}
          onChange={e => setManualName(e.target.value)}
          placeholder="Or enter exact Last.fm artist name..."
          className="flex-1 bg-plex-dark border border-plex-border rounded-lg px-3 py-2 text-sm text-white placeholder-plex-muted focus:outline-none focus:border-plex-orange"
        />
        <button type="submit" disabled={!manualName.trim()} className={BTN}>
          Link name
        </button>
      </form>

      {isLoading && <p className="text-plex-muted text-sm animate-pulse">Searching Last.fm...</p>}
      {error && <p className="text-red-400 text-sm">{error.message}</p>}
      {!isLoading && data?.results?.length === 0 && (
        <p className="text-plex-muted text-sm">No results for "{searchTerm}".</p>
      )}

      <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
        {data?.results?.map(r => (
          <button
            key={r.name}
            onClick={() => onLink(r.name)}
            className="w-full flex items-center justify-between gap-3 p-3 rounded-lg border border-plex-border hover:border-plex-orange hover:bg-plex-dark/60 text-left transition-colors"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{r.name}</p>
              {r.listeners > 0 && (
                <p className="text-xs text-plex-muted">{r.listeners.toLocaleString()} listeners</p>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

export default function LastFMLinkModal({ artist, onClose }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-plex-card border border-plex-border rounded-xl w-full max-w-lg mx-4 shadow-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-plex-border flex-shrink-0">
          <div>
            <h2 className="font-semibold">Last.fm</h2>
            <p className="text-sm text-plex-muted">{artist.title}</p>
          </div>
          <button
            onClick={() => onClose()}
            className="text-plex-muted hover:text-white text-2xl leading-none w-8 h-8 flex items-center justify-center"
          >
            ×
          </button>
        </div>

        <div className="p-4 overflow-y-auto">
          <CompoundLinksSection
            ratingKey={artist.ratingKey}
            service="lastfm"
            defaultComponent={artist.title}
            renderSearch={(componentName, onLink) => (
              <LastFMSearchPanel initialQuery={componentName} onLink={onLink} />
            )}
          />
        </div>
      </div>
    </div>
  )
}
