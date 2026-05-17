import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'

async function searchMatches(type, ratingKey, query) {
  const res = await fetch(`/api/${type}/${ratingKey}/matches?query=${encodeURIComponent(query)}`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || 'Search failed')
  }
  return res.json()
}

async function applyMatch(type, ratingKey, guid, name) {
  const res = await fetch(`/api/${type}/${ratingKey}/fix-match`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ guid, name }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || 'Fix failed')
  }
  return res.json()
}

async function refreshItem(type, ratingKey) {
  const res = await fetch(`/api/${type}/${ratingKey}/refresh`, { method: 'PUT' })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || 'Refresh failed')
  }
  return res.json()
}

function mbLink(guid, type) {
  const uuid = guid?.replace('mbid://', '')
  if (!uuid) return null
  const section = type === 'album' ? 'release' : 'artist'
  return `https://musicbrainz.org/${section}/${uuid}`
}

// item = { ratingKey, title }
// type = 'artist' | 'album'
export default function FixMatchModal({ item, type = 'artist', onClose, onFixed }) {
  const [query, setQuery] = useState(item.title)
  const [results, setResults] = useState(null)
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState(null)
  const [appliedGuid, setAppliedGuid] = useState(null)

  const fixMutation = useMutation({
    mutationFn: ({ guid, name }) => applyMatch(type, item.ratingKey, guid, name),
    onSuccess: (_, vars) => {
      setAppliedGuid(vars.guid)
      onFixed?.(item.ratingKey)
    },
  })

  const refreshMutation = useMutation({
    mutationFn: () => refreshItem(type, item.ratingKey),
    onSuccess: () => onFixed?.(null),
  })

  async function handleSearch(e) {
    e.preventDefault()
    setSearching(true)
    setSearchError(null)
    setResults(null)
    try {
      setResults(await searchMatches(type, item.ratingKey, query))
    } catch (err) {
      setSearchError(err.message)
    } finally {
      setSearching(false)
    }
  }

  const isLoading = fixMutation.isPending || refreshMutation.isPending
  const typeLabel = type === 'album' ? 'album' : 'artista'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-plex-card border border-plex-border rounded-xl w-full max-w-lg mx-4 shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-plex-border">
          <div>
            <p className="text-xs text-plex-muted mb-0.5">Fix match · {typeLabel}</p>
            <h2 className="font-bold text-lg">{item.title}</h2>
            {item.artist && <p className="text-sm text-plex-muted">{item.artist}</p>}
          </div>
          <button onClick={onClose} className="text-plex-muted hover:text-white ml-4 text-xl leading-none">×</button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <form onSubmit={handleSearch} className="flex gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1 bg-plex-dark border border-plex-border rounded px-3 py-2 text-sm focus:outline-none focus:border-plex-orange"
              placeholder={`Nombre del ${typeLabel}...`}
            />
            <button
              type="submit"
              disabled={searching || !query.trim()}
              className="bg-plex-orange text-plex-dark font-semibold px-4 py-2 rounded text-sm hover:opacity-90 disabled:opacity-50"
            >
              {searching ? '...' : 'Buscar'}
            </button>
          </form>

          {searchError && <p className="text-red-400 text-sm">{searchError}</p>}

          {results !== null && (
            <div className="space-y-2">
              <p className="text-xs text-plex-muted">
                {results.length === 0 ? 'Sin resultados' : `${results.length} resultados`}
              </p>
              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {results.map((r) => {
                  const link = mbLink(r.guid, type)
                  const isApplied = appliedGuid === r.guid
                  return (
                    <div
                      key={r.guid}
                      className={`flex items-center justify-between p-3 rounded border transition-colors ${
                        isApplied
                          ? 'border-green-500 bg-green-900/20'
                          : 'border-plex-border bg-plex-dark hover:border-plex-orange/50'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm truncate">{r.name}</p>
                          {r.year && <span className="text-xs text-plex-muted flex-shrink-0">{r.year}</span>}
                          {link && (
                            <a
                              href={link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-plex-orange hover:underline flex-shrink-0"
                              onClick={(e) => e.stopPropagation()}
                            >
                              MB ↗
                            </a>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          {r.score != null && (
                            <span className="text-xs text-plex-muted">Score: {r.score}</span>
                          )}
                          {r.guid && (
                            <button
                              title="Click para copiar MBID"
                              onClick={(e) => {
                                e.stopPropagation()
                                const uuid = r.guid.replace('mbid://', '')
                                navigator.clipboard.writeText(uuid)
                              }}
                              className="text-xs font-mono text-plex-muted hover:text-white transition-colors"
                            >
                              {r.guid.replace('mbid://', '').slice(0, 8)}…
                            </button>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => fixMutation.mutate({ guid: r.guid, name: r.name })}
                        disabled={isLoading || isApplied}
                        className={`ml-3 flex-shrink-0 px-3 py-1 rounded text-xs font-semibold transition-colors ${
                          isApplied
                            ? 'bg-green-600 text-white'
                            : 'bg-plex-orange text-plex-dark hover:opacity-90 disabled:opacity-50'
                        }`}
                      >
                        {isApplied ? 'Aplicado ✓' : 'Aplicar'}
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {fixMutation.isError && (
            <p className="text-red-400 text-sm">Error: {fixMutation.error.message}</p>
          )}

          <div className="border-t border-plex-border pt-3">
            <p className="text-xs text-plex-muted mb-2">O refrescar metadata desde el agente actual:</p>
            <button
              onClick={() => refreshMutation.mutate()}
              disabled={isLoading}
              className="w-full border border-plex-border rounded py-2 text-sm text-plex-muted hover:text-white hover:border-white transition-colors disabled:opacity-50"
            >
              {refreshMutation.isPending ? 'Refrescando...'
                : refreshMutation.isSuccess ? 'Refresh enviado ✓'
                : 'Refrescar metadata'}
            </button>
            {refreshMutation.isError && (
              <p className="text-red-400 text-xs mt-1">{refreshMutation.error.message}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
