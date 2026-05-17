import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'

async function fetchMBData(ratingKey) {
  const res = await fetch(`/api/artist/${ratingKey}/mb-data`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || 'Error consultando MusicBrainz')
  }
  return res.json()
}

async function applyMBData(ratingKey, { country, genres }) {
  const res = await fetch(`/api/artist/${ratingKey}/apply-mb`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ country: country ?? null, genres: genres ?? null }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || 'Error aplicando datos')
  }
  return res.json()
}

function Tag({ children, color = 'gray' }) {
  const colors = {
    gray:   'bg-plex-border text-gray-300',
    orange: 'bg-plex-orange/20 text-plex-orange border border-plex-orange/40',
    green:  'bg-green-900/30 text-green-300 border border-green-700',
  }
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-xs ${colors[color]}`}>
      {children}
    </span>
  )
}

export default function MBDataModal({ artist, onClose, onApplied }) {
  const [applied, setApplied] = useState({ country: false, genres: false })

  const { data: mb, isLoading, error } = useQuery({
    queryKey: ['mb-data', artist.ratingKey],
    queryFn: () => fetchMBData(artist.ratingKey),
    retry: false,
  })

  const applyMutation = useMutation({
    mutationFn: ({ country, genres }) => applyMBData(artist.ratingKey, { country, genres }),
    onSuccess: (_, vars) => {
      setApplied(prev => ({
        country: prev.country || !!vars.country,
        genres:  prev.genres  || !!vars.genres,
      }))
      onApplied?.()
    },
  })

  const rawGuid = artist.guid || ''
  const mbid = artist.mbid || (rawGuid.startsWith('mbid://') ? rawGuid.replace('mbid://', '') : null)
  const mbUrl = mbid ? `https://musicbrainz.org/artist/${mbid}` : null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-plex-card border border-plex-border rounded-xl w-full max-w-lg mx-4 shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-plex-border">
          <div>
            <p className="text-xs text-plex-muted mb-0.5">Datos de MusicBrainz</p>
            <h2 className="font-bold text-lg">{artist.title}</h2>
          </div>
          <div className="flex items-center gap-3 ml-4">
            {mbUrl && (
              <a
                href={mbUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-plex-orange hover:underline"
              >
                Ver en MB ↗
              </a>
            )}
            <button onClick={onClose} className="text-plex-muted hover:text-white text-xl leading-none">×</button>
          </div>
        </div>

        {/* Body */}
        <div className="p-5">
          {isLoading && (
            <div className="flex items-center justify-center h-24 text-plex-muted text-sm animate-pulse">
              Consultando MusicBrainz...
            </div>
          )}

          {error && (
            <p className="text-red-400 text-sm">{error.message}</p>
          )}

          {mb && (
            <div className="space-y-5">
              {/* Info row */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                {mb.type && (
                  <div>
                    <p className="text-xs text-plex-muted mb-1">Tipo</p>
                    <p>{mb.type}</p>
                  </div>
                )}
                {mb.founded && (
                  <div>
                    <p className="text-xs text-plex-muted mb-1">Fundado</p>
                    <p>{mb.founded}{mb.foundedIn ? ` · ${mb.foundedIn}` : ''}</p>
                  </div>
                )}
              </div>

              {/* Country */}
              <div className="rounded-lg border border-plex-border p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-plex-muted mb-1">País</p>
                    {mb.country
                      ? <p className="font-medium">{mb.country}</p>
                      : <p className="text-plex-muted text-sm">No disponible en MusicBrainz</p>
                    }
                  </div>
                  {mb.country && (
                    <button
                      onClick={() => applyMutation.mutate({ country: mb.country })}
                      disabled={applyMutation.isPending || applied.country}
                      className={`px-3 py-1.5 rounded text-sm font-semibold transition-colors ${
                        applied.country
                          ? 'bg-green-600 text-white'
                          : 'bg-plex-orange text-plex-dark hover:opacity-90 disabled:opacity-50'
                      }`}
                    >
                      {applied.country ? 'Aplicado ✓' : 'Aplicar país'}
                    </button>
                  )}
                </div>
              </div>

              {/* Genres */}
              {mb.genres.length > 0 && (
                <div className="rounded-lg border border-plex-border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <p className="text-xs text-plex-muted mb-2">Géneros en MusicBrainz</p>
                      <div className="flex flex-wrap gap-1.5">
                        {mb.genres.slice(0, 8).map((g) => (
                          <Tag key={g.name}>
                            {g.name} <span className="opacity-50 text-[10px]">{g.count}</span>
                          </Tag>
                        ))}
                      </div>
                    </div>
                    <button
                      onClick={() => applyMutation.mutate({ genres: mb.genres.slice(0, 8).map(g => g.name) })}
                      disabled={applyMutation.isPending || applied.genres}
                      className={`flex-shrink-0 px-3 py-1.5 rounded text-sm font-semibold transition-colors ${
                        applied.genres
                          ? 'bg-green-600 text-white'
                          : 'bg-plex-orange text-plex-dark hover:opacity-90 disabled:opacity-50'
                      }`}
                    >
                      {applied.genres ? 'Aplicado ✓' : 'Aplicar géneros'}
                    </button>
                  </div>
                </div>
              )}

              {/* Apply both */}
              {mb.country && mb.genres.length > 0 && (
                <button
                  onClick={() => applyMutation.mutate({
                    country: mb.country,
                    genres: mb.genres.slice(0, 8).map(g => g.name),
                  })}
                  disabled={applyMutation.isPending || (applied.country && applied.genres)}
                  className="w-full bg-plex-orange text-plex-dark font-semibold py-2 rounded hover:opacity-90 disabled:opacity-50 transition-opacity text-sm"
                >
                  {applied.country && applied.genres ? 'Todo aplicado ✓' : 'Aplicar todo'}
                </button>
              )}

              {applyMutation.isError && (
                <p className="text-red-400 text-sm">{applyMutation.error.message}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
