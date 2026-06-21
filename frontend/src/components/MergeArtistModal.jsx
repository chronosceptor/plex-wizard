import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'

async function searchPlexArtists(ratingKey, query) {
  const res = await fetch(`/api/artist/${ratingKey}/plex-search?query=${encodeURIComponent(query)}`)
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || 'Search failed') }
  return res.json()
}

async function mergeArtists(targetRatingKey, ratingKeys) {
  const res = await fetch(`/api/artist/${targetRatingKey}/merge`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rating_keys: ratingKeys }),
  })
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || 'Merge failed') }
  return res.json()
}

// `artist` is the duplicate currently being viewed. Plex's native merge absorbs
// other ratingKeys INTO the target you call .merge() on — so here the user
// searches for the correct/canonical entry, and we merge the current one into it.
export default function MergeArtistModal({ artist, onClose }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [query, setQuery] = useState(artist.title)
  const [activeQuery, setActiveQuery] = useState(artist.title)
  const [target, setTarget] = useState(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['plex-artist-search', artist.ratingKey, activeQuery],
    queryFn: () => searchPlexArtists(artist.ratingKey, activeQuery),
    enabled: !!activeQuery.trim(),
    staleTime: 60 * 1000,
  })

  const mergeMutation = useMutation({
    mutationFn: () => mergeArtists(target.ratingKey, [artist.ratingKey]),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-artists'] })
      navigate(`/artists/${target.ratingKey}`)
    },
  })

  function handleSearch(e) {
    e.preventDefault()
    if (query.trim()) { setTarget(null); setActiveQuery(query.trim()) }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-plex-card border border-plex-border rounded-xl w-full max-w-lg mx-4 shadow-2xl">
        <div className="flex items-start justify-between p-5 border-b border-plex-border">
          <div>
            <p className="text-xs text-plex-muted mb-0.5">Merge duplicate artist</p>
            <h2 className="font-bold text-lg">{artist.title}</h2>
          </div>
          <button onClick={onClose} className="text-plex-muted hover:text-white ml-4 text-xl leading-none">×</button>
        </div>

        <div className="p-5 space-y-4">
          {!target && (
            <>
              <p className="text-sm text-plex-muted">
                Search for the correct artist entry in your Plex library.{' '}
                <span className="text-white">{artist.title}</span> will be merged into the one you
                pick — its albums and tracks move there, and this entry stops existing on its own.
              </p>

              <form onSubmit={handleSearch} className="flex gap-2">
                <input
                  type="text"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Search artist in your Plex library..."
                  className="flex-1 bg-plex-dark border border-plex-border rounded-lg px-3 py-2 text-sm text-white placeholder-plex-muted focus:outline-none focus:border-plex-orange"
                />
                <button
                  type="submit"
                  disabled={isLoading || !query.trim()}
                  className="px-4 py-2 bg-plex-orange hover:bg-plex-orange/80 text-white text-sm rounded-lg disabled:opacity-50 transition-colors"
                >
                  {isLoading ? '...' : 'Search'}
                </button>
              </form>

              {error && <p className="text-red-400 text-sm">{error.message}</p>}

              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {(data ?? []).map(a => (
                  <button
                    key={a.ratingKey}
                    onClick={() => setTarget(a)}
                    className="w-full flex items-center gap-3 p-3 rounded-lg border border-plex-border hover:border-plex-orange hover:bg-plex-dark/60 text-left transition-colors"
                  >
                    <div className={`w-9 h-9 rounded flex-shrink-0 flex items-center justify-center text-sm ${
                      a.thumb ? 'bg-plex-border' : 'bg-plex-dark border border-plex-border'
                    }`}>
                      {a.thumb ? '🎵' : '?'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{a.title}</p>
                      <p className="text-xs text-plex-muted font-mono">#{a.ratingKey}</p>
                    </div>
                  </button>
                ))}
                {data?.length === 0 && !isLoading && <p className="text-plex-muted text-sm">No matches.</p>}
              </div>
            </>
          )}

          {target && (
            <div className="space-y-4">
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 space-y-2">
                <p className="text-sm text-white">
                  Merge <span className="font-semibold">{artist.title}</span> into{' '}
                  <span className="font-semibold">{target.title}</span>?
                </p>
                <p className="text-xs text-plex-muted">
                  Native Plex merge — irreversible from here (Plex's own UI has a "Split" action if
                  you need to undo it). All albums/tracks from "{artist.title}" move under "
                  {target.title}", and ratingKey #{artist.ratingKey} stops existing as a separate
                  artist.
                </p>
              </div>

              {mergeMutation.isError && <p className="text-red-400 text-sm">{mergeMutation.error.message}</p>}

              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setTarget(null)}
                  disabled={mergeMutation.isPending}
                  className="px-4 py-2 rounded-lg border border-plex-border text-plex-muted hover:text-white hover:border-white transition-colors disabled:opacity-50"
                >
                  Back
                </button>
                <button
                  onClick={() => mergeMutation.mutate()}
                  disabled={mergeMutation.isPending}
                  className="px-4 py-2 rounded-lg bg-red-600 text-white font-medium hover:opacity-90 transition-colors disabled:opacity-50"
                >
                  {mergeMutation.isPending ? 'Merging...' : 'Merge'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
