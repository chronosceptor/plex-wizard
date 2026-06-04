import { useQuery, useMutation } from '@tanstack/react-query'

export default function DiscogsLinkModal({ artist, onClose }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['discogs-search', artist.ratingKey],
    queryFn: async () => {
      const res = await fetch(`/api/artist/${artist.ratingKey}/discogs-search`)
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

          {isLoading && (
            <p className="text-plex-muted text-sm animate-pulse">Searching Discogs...</p>
          )}
          {error && <p className="text-red-400 text-sm">{error.message}</p>}
          {(link.error || remove.error) && (
            <p className="text-red-400 text-sm">{(link.error || remove.error).message}</p>
          )}

          {!isLoading && data?.candidates?.length === 0 && (
            <p className="text-plex-muted text-sm">No results found for "{artist.title}".</p>
          )}

          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
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
