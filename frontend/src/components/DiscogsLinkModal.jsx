import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import CompoundLinksSection from './CompoundLinksSection'

const BTN = 'px-4 py-2 bg-plex-dark border border-plex-border hover:border-plex-orange text-white text-sm rounded-lg disabled:opacity-50 transition-colors whitespace-nowrap'

function DiscogsSearchPanel({ ratingKey, initialQuery, onLink }) {
  const [searchQuery, setSearchQuery] = useState(initialQuery)
  const [activeQuery, setActiveQuery] = useState(initialQuery)
  const [manualId, setManualId] = useState('')

  const { data, isLoading, error } = useQuery({
    queryKey: ['discogs-search', ratingKey, activeQuery],
    queryFn: async () => {
      const params = new URLSearchParams({ q: activeQuery })
      const res = await fetch(`/api/artist/${ratingKey}/discogs-search?${params}`)
      if (!res.ok) throw new Error('Search failed')
      return res.json()
    },
    staleTime: 5 * 60 * 1000,
  })

  function handleSearch(e) {
    e.preventDefault()
    if (searchQuery.trim()) setActiveQuery(searchQuery.trim())
  }

  function handleManualLink(e) {
    e.preventDefault()
    const id = parseInt(manualId, 10)
    if (!isNaN(id) && id > 0) onLink(String(id))
  }

  return (
    <div className="space-y-2">
      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search Discogs..."
          className="flex-1 bg-plex-dark border border-plex-border rounded-lg px-3 py-2 text-sm text-white placeholder-plex-muted focus:outline-none focus:border-plex-orange"
        />
        <button type="submit" disabled={isLoading || !searchQuery.trim()} className={BTN}>
          Search
        </button>
      </form>

      <form onSubmit={handleManualLink} className="flex gap-2 items-center">
        <input
          type="number"
          value={manualId}
          onChange={e => setManualId(e.target.value)}
          placeholder="Or enter Discogs artist ID..."
          min="1"
          className="flex-1 bg-plex-dark border border-plex-border rounded-lg px-3 py-2 text-sm text-white placeholder-plex-muted focus:outline-none focus:border-plex-orange"
        />
        <button type="submit" disabled={!manualId} className={BTN}>
          Link ID
        </button>
      </form>

      {isLoading && <p className="text-plex-muted text-sm animate-pulse">Searching Discogs...</p>}
      {error && <p className="text-red-400 text-sm">{error.message}</p>}
      {!isLoading && data?.candidates?.length === 0 && (
        <p className="text-plex-muted text-sm">No results for "{activeQuery}".</p>
      )}

      <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
        {data?.candidates?.map(c => (
          <button
            key={c.id}
            onClick={() => onLink(String(c.id))}
            className="w-full flex items-center gap-3 p-3 rounded-lg border border-plex-border hover:border-plex-orange hover:bg-plex-dark/60 text-left transition-colors"
          >
            {c.thumb ? (
              <img src={c.thumb} alt="" className="w-10 h-10 rounded object-cover flex-shrink-0" />
            ) : (
              <div className="w-10 h-10 rounded bg-plex-border flex-shrink-0 flex items-center justify-center text-plex-muted text-xs">?</div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{c.name}</p>
              <p className="text-xs text-plex-muted">ID: {c.id}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

export default function DiscogsLinkModal({ artist, onClose }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-plex-card border border-plex-border rounded-xl w-full max-w-lg mx-4 shadow-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-plex-border flex-shrink-0">
          <div>
            <h2 className="font-semibold">Discogs</h2>
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
            service="discogs"
            defaultComponent={artist.title}
            renderSearch={(componentName, onLink) => (
              <DiscogsSearchPanel
                ratingKey={artist.ratingKey}
                initialQuery={componentName}
                onLink={onLink}
              />
            )}
          />
        </div>
      </div>
    </div>
  )
}
