import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'

export default function LastFMLinkModal({ artist, onClose }) {
  const [query, setQuery]           = useState(artist.lastfm_name || artist.title)
  const [searchTerm, setSearchTerm] = useState(artist.lastfm_name || artist.title)

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

  const link = useMutation({
    mutationFn: async (lastfm_name) => {
      const res = await fetch(`/api/artist/${artist.ratingKey}/links/lastfm`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lastfm_name }),
      })
      if (!res.ok) throw new Error('Failed to save link')
      return res.json()
    },
    onSuccess: () => onClose(artist.ratingKey),
  })

  const remove = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/artist/${artist.ratingKey}/links/lastfm`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lastfm_name: null }),
      })
      if (!res.ok) throw new Error('Failed to remove link')
      return res.json()
    },
    onSuccess: () => onClose(artist.ratingKey),
  })

  function handleSearch(e) {
    e.preventDefault()
    if (query.trim()) setSearchTerm(query.trim())
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-plex-card border border-plex-border rounded-xl w-full max-w-lg mx-4 shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-plex-border">
          <div>
            <h2 className="font-semibold">Link to Last.fm</h2>
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
          {artist.lastfm_name && (
            <div className="flex items-center justify-between p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-sm">
              <span className="text-green-400">Currently linked: {artist.lastfm_name}</span>
              <button
                onClick={() => remove.mutate()}
                disabled={remove.isPending}
                className="text-red-400 hover:text-red-300 text-xs underline disabled:opacity-50"
              >
                Remove
              </button>
            </div>
          )}

          <form onSubmit={handleSearch} className="flex gap-2">
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search Last.fm..."
              className="flex-1 bg-plex-dark border border-plex-border rounded px-3 py-1.5 text-sm focus:outline-none focus:border-plex-orange"
            />
            <button
              type="submit"
              className="px-3 py-1.5 bg-plex-orange text-plex-dark text-sm font-semibold rounded hover:opacity-90 transition-opacity"
            >
              Search
            </button>
          </form>

          {isLoading && (
            <p className="text-plex-muted text-sm animate-pulse">Searching Last.fm...</p>
          )}
          {error && <p className="text-red-400 text-sm">{error.message}</p>}
          {(link.error || remove.error) && (
            <p className="text-red-400 text-sm">{(link.error || remove.error).message}</p>
          )}

          {!isLoading && data?.results?.length === 0 && (
            <p className="text-plex-muted text-sm">No results found for "{searchTerm}".</p>
          )}

          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {data?.results?.map(r => (
              <button
                key={r.name}
                onClick={() => link.mutate(r.name)}
                disabled={link.isPending}
                className={`w-full flex items-center justify-between gap-3 p-3 rounded-lg border text-left transition-colors disabled:opacity-60 ${
                  artist.lastfm_name === r.name
                    ? 'border-green-500/40 bg-green-500/10'
                    : 'border-plex-border hover:border-plex-orange hover:bg-plex-dark/60'
                }`}
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{r.name}</p>
                  {r.listeners > 0 && (
                    <p className="text-xs text-plex-muted">{r.listeners.toLocaleString()} listeners</p>
                  )}
                </div>
                {artist.lastfm_name === r.name && (
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
