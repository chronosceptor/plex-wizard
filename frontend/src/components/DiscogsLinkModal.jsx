import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'

export default function DiscogsLinkModal({ artist, onClose }) {
  const [searchQuery, setSearchQuery] = useState(artist.title)
  const [activeQuery, setActiveQuery] = useState(artist.title)
  const [manualId, setManualId] = useState('')

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['discogs-search', artist.ratingKey, activeQuery],
    queryFn: async () => {
      const params = new URLSearchParams({ q: activeQuery })
      const res = await fetch(`/api/artist/${artist.ratingKey}/discogs-search?${params}`)
      if (!res.ok) throw new Error('Search failed')
      return res.json()
    },
    staleTime: 5 * 60 * 1000,
  })

  const link = useMutation({
    mutationFn: async (discogs_id) => {
      const res = await fetch(`/api/artist/${artist.ratingKey}/links/discogs`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ discogs_id }),
      })
      if (!res.ok) throw new Error('Failed to save link')
      return res.json()
    },
    onSuccess: () => onClose(artist.ratingKey),
  })

  const remove = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/artist/${artist.ratingKey}/links/discogs`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ discogs_id: null }),
      })
      if (!res.ok) throw new Error('Failed to remove link')
      return res.json()
    },
    onSuccess: () => onClose(artist.ratingKey),
  })

  function handleSearch(e) {
    e.preventDefault()
    if (searchQuery.trim()) setActiveQuery(searchQuery.trim())
  }

  function handleManualLink(e) {
    e.preventDefault()
    const id = parseInt(manualId, 10)
    if (!isNaN(id) && id > 0) link.mutate(id)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-plex-card border border-plex-border rounded-xl w-full max-w-lg mx-4 shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-plex-border">
          <div>
            <h2 className="font-semibold">Link to Discogs</h2>
            <p className="text-sm text-plex-muted">{artist.title}</p>
          </div>
          <button
            onClick={() => onClose()}
            className="text-plex-muted hover:text-white text-2xl leading-none w-8 h-8 flex items-center justify-center"
          >
            ×
          </button>
        </div>

        <div className="p-4 space-y-3">
          {/* Current link */}
          {artist.discogs_id && (
            <div className="flex items-center justify-between p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-sm">
              <span className="text-green-400">Currently linked: Discogs #{artist.discogs_id}</span>
              <button
                onClick={() => remove.mutate()}
                disabled={remove.isPending}
                className="text-red-400 hover:text-red-300 text-xs underline disabled:opacity-50"
              >
                Remove
              </button>
            </div>
          )}

          {/* Search box */}
          <form onSubmit={handleSearch} className="flex gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search Discogs..."
              className="flex-1 bg-plex-dark border border-plex-border rounded-lg px-3 py-2 text-sm text-white placeholder-plex-muted focus:outline-none focus:border-plex-orange"
            />
            <button
              type="submit"
              disabled={isLoading || !searchQuery.trim()}
              className="px-4 py-2 bg-plex-orange hover:bg-plex-orange/80 text-white text-sm rounded-lg disabled:opacity-50 transition-colors"
            >
              Search
            </button>
          </form>

          {/* Manual ID entry */}
          <form onSubmit={handleManualLink} className="flex gap-2 items-center">
            <input
              type="number"
              value={manualId}
              onChange={e => setManualId(e.target.value)}
              placeholder="Or enter Discogs artist ID..."
              min="1"
              className="flex-1 bg-plex-dark border border-plex-border rounded-lg px-3 py-2 text-sm text-white placeholder-plex-muted focus:outline-none focus:border-plex-orange"
            />
            <button
              type="submit"
              disabled={link.isPending || !manualId}
              className="px-4 py-2 bg-plex-dark border border-plex-border hover:border-plex-orange text-white text-sm rounded-lg disabled:opacity-50 transition-colors whitespace-nowrap"
            >
              Link ID
            </button>
          </form>

          {/* Status messages */}
          {isLoading && (
            <p className="text-plex-muted text-sm animate-pulse">Searching Discogs...</p>
          )}
          {error && <p className="text-red-400 text-sm">{error.message}</p>}
          {(link.error || remove.error) && (
            <p className="text-red-400 text-sm">{(link.error || remove.error).message}</p>
          )}
          {!isLoading && data?.candidates?.length === 0 && (
            <p className="text-plex-muted text-sm">No results found for "{activeQuery}".</p>
          )}

          {/* Candidates list */}
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {data?.candidates?.map(c => (
              <button
                key={c.id}
                onClick={() => link.mutate(c.id)}
                disabled={link.isPending}
                className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-colors disabled:opacity-60 ${
                  artist.discogs_id === c.id
                    ? 'border-green-500/40 bg-green-500/10'
                    : 'border-plex-border hover:border-plex-orange hover:bg-plex-dark/60'
                }`}
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
                {artist.discogs_id === c.id && (
                  <span className="text-green-400 text-xs flex-shrink-0">✓</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
