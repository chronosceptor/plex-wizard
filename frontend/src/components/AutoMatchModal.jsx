import { useState, useEffect } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'

async function fetchCandidates(ratingKey) {
  const res = await fetch(`/api/artist/${ratingKey}/auto-match`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || 'Error buscando en MusicBrainz')
  }
  return res.json()
}

async function applyMatch(ratingKey, guid, name) {
  const res = await fetch(`/api/artist/${ratingKey}/fix-match`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ guid, name }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || 'Error aplicando match')
  }
  return res.json()
}

async function fetchArtistGuid(ratingKey) {
  const res = await fetch(`/api/artist/${ratingKey}/guid`)
  if (!res.ok) return null
  return res.json()
}

function ConfidenceBar({ score }) {
  const pct = Math.round(score * 100)
  const color = pct >= 70 ? 'bg-green-500' : pct >= 40 ? 'bg-yellow-500' : 'bg-red-500'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-plex-dark rounded-full h-1.5">
        <div className={`${color} h-1.5 rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-xs font-mono font-bold flex-shrink-0 ${
        pct >= 70 ? 'text-green-400' : pct >= 40 ? 'text-yellow-400' : 'text-red-400'
      }`}>
        {pct}%
      </span>
    </div>
  )
}

const VERIFY_TIMEOUT_MS = 30_000

export default function AutoMatchModal({ artist, onClose, onFixed }) {
  const [pendingGuid, setPendingGuid] = useState(null)
  const [verifyStart, setVerifyStart] = useState(null)
  const [verifyResult, setVerifyResult] = useState(null) // 'confirmed' | 'timeout'

  const { data, isLoading, error } = useQuery({
    queryKey: ['auto-match', artist.ratingKey],
    queryFn: () => fetchCandidates(artist.ratingKey),
    retry: false,
  })

  const guidQuery = useQuery({
    queryKey: ['artist-guid', artist.ratingKey],
    queryFn: () => fetchArtistGuid(artist.ratingKey),
    enabled: !!pendingGuid && verifyResult === null,
    refetchInterval: 2000,
  })

  useEffect(() => {
    if (!pendingGuid || verifyResult !== null) return

    const data = guidQuery.data
    if (data?.guid === pendingGuid || data?.isMatched) {
      setVerifyResult('confirmed')
      setTimeout(() => onFixed?.(artist.ratingKey), 1200)
      return
    }

    if (verifyStart && Date.now() - verifyStart > VERIFY_TIMEOUT_MS) {
      setVerifyResult('timeout')
    }
  }, [guidQuery.data, pendingGuid, verifyStart, verifyResult, onFixed, artist.ratingKey])

  const applyMutation = useMutation({
    mutationFn: ({ guid, name }) => applyMatch(artist.ratingKey, guid, name),
    onSuccess: (_, { guid }) => {
      setPendingGuid(guid)
      setVerifyStart(Date.now())
      setVerifyResult(null)
    },
  })

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-plex-card border border-plex-border rounded-xl w-full max-w-xl mx-4 shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-plex-border">
          <div>
            <p className="text-xs text-plex-muted mb-0.5">Auto-match · MusicBrainz</p>
            <h2 className="font-bold text-lg">{artist.title}</h2>
          </div>
          <button onClick={onClose} className="text-plex-muted hover:text-white ml-4 text-xl leading-none">×</button>
        </div>

        <div className="p-5">
          {isLoading && (
            <div className="flex flex-col items-center justify-center h-32 gap-3">
              <div className="text-plex-muted text-sm animate-pulse">Buscando en MusicBrainz...</div>
              <p className="text-xs text-plex-muted">Comparando albums (puede tardar ~10s por el rate limit)</p>
            </div>
          )}

          {error && <p className="text-red-400 text-sm">{error.message}</p>}

          {data && (
            <div className="space-y-4">
              {/* Plex albums */}
              <div>
                <p className="text-xs text-plex-muted mb-1.5">
                  Albums en Plex <span className="text-white font-mono">({data.plexAlbums.length})</span>
                </p>
                <div className="flex flex-wrap gap-1">
                  {data.plexAlbums.map((a) => (
                    <span key={a} className="bg-plex-dark border border-plex-border rounded px-2 py-0.5 text-xs">{a}</span>
                  ))}
                </div>
              </div>

              {/* Candidates */}
              <div className="space-y-2">
                <p className="text-xs text-plex-muted">Candidatos en MusicBrainz</p>

                {data.candidates.length === 0 && (
                  <p className="text-plex-muted text-sm">No se encontraron candidatos</p>
                )}

                {data.candidates.map((c) => {
                  const pct = Math.round(c.confidence * 100)
                  const mbUrl = `https://musicbrainz.org/artist/${c.mbid}`
                  return (
                    <div
                      key={c.mbid}
                      className="border border-plex-border rounded-lg p-4 bg-plex-dark space-y-3"
                    >
                      {/* Name + meta */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm">{c.name}</span>
                            {c.type && <span className="text-xs text-plex-muted">{c.type}</span>}
                            {c.country && <span className="text-xs text-plex-muted">· {c.country}</span>}
                            {c.founded && <span className="text-xs text-plex-muted">· {c.founded}</span>}
                            <a
                              href={mbUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-plex-orange hover:underline"
                            >
                              MB ↗
                            </a>
                          </div>
                          <p className="text-xs text-plex-muted mt-0.5">
                            {c.mbReleaseCount} releases en MB · score de búsqueda: {c.score}
                          </p>
                        </div>
                        <button
                          onClick={() => applyMutation.mutate({ guid: `mbid://${c.mbid}`, name: c.name })}
                          disabled={applyMutation.isPending}
                          className={`flex-shrink-0 px-3 py-1.5 rounded text-xs font-semibold transition-colors ${
                            pct >= 70
                              ? 'bg-plex-orange text-plex-dark hover:opacity-90'
                              : 'border border-plex-border text-plex-muted hover:text-white hover:border-white'
                          } disabled:opacity-50`}
                        >
                          {applyMutation.isPending ? '...' : 'Aplicar'}
                        </button>
                      </div>

                      {/* Confidence bar */}
                      <ConfidenceBar score={c.confidence} />

                      {/* Matched albums */}
                      {c.matchedAlbums.length > 0 ? (
                        <div>
                          <p className="text-xs text-plex-muted mb-1">
                            Albums coincidentes ({c.matchedAlbums.length}/{data.plexAlbums.length}):
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {c.matchedAlbums.map((a) => (
                              <span key={a} className="bg-green-900/30 text-green-300 border border-green-800 rounded px-1.5 py-0.5 text-xs">
                                {a}
                              </span>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-red-400">No hay albums coincidentes</p>
                      )}
                    </div>
                  )
                })}
              </div>

              {applyMutation.isError && (
                <p className="text-red-400 text-sm">{applyMutation.error.message}</p>
              )}

              {pendingGuid && verifyResult === null && (
                <div className="flex items-center gap-2 text-sm text-plex-muted animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-plex-orange inline-block"></span>
                  Verificando cambio en Plex...
                </div>
              )}

              {verifyResult === 'confirmed' && (
                <p className="text-green-400 text-sm">Cambio confirmado en Plex</p>
              )}

              {verifyResult === 'timeout' && (
                <p className="text-yellow-400 text-sm">
                  Match aplicado — Plex puede tardar unos minutos en procesar la metadata.
                  <button
                    onClick={() => onFixed?.(artist.ratingKey)}
                    className="ml-2 underline hover:text-white"
                  >
                    Cerrar
                  </button>
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
