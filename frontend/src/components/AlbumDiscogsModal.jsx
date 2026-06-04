import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'

async function searchDiscogs(ratingKey) {
  const res = await fetch(`/api/album/${ratingKey}/discogs-search`)
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || 'Error Discogs') }
  return res.json()
}

async function fetchDetail(ratingKey, discogsId) {
  const res = await fetch(`/api/album/${ratingKey}/discogs-detail?discogs_id=${discogsId}`)
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || 'Error Discogs') }
  return res.json()
}

async function applyDiscogs(ratingKey, payload) {
  const res = await fetch(`/api/album/${ratingKey}/apply-discogs`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      genres: payload.genres ?? null,
      styles: payload.styles ?? null,
      labels: payload.labels ?? null,
      bio:    payload.bio    ?? null,
    }),
  })
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || 'Error aplicando') }
  return res.json()
}

function TagChip({ children }) {
  return <span className="inline-block bg-plex-border text-gray-300 rounded px-2 py-0.5 text-xs">{children}</span>
}

function ApplyBtn({ label, applied, disabled, onClick }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || applied}
      className={`flex-shrink-0 px-3 py-1.5 rounded text-xs font-semibold transition-colors ${
        applied
          ? 'bg-green-600 text-white'
          : 'bg-plex-orange text-plex-dark hover:opacity-90 disabled:opacity-50'
      }`}
    >
      {applied ? 'Aplicado ✓' : label}
    </button>
  )
}

function Section({ title, children }) {
  return (
    <div className="rounded-lg border border-plex-border p-4 space-y-2">
      <p className="text-xs text-plex-muted">{title} <span className="text-plex-muted/50">(merge)</span></p>
      {children}
    </div>
  )
}

export default function AlbumDiscogsModal({ album, onClose, onApplied }) {
  const [selectedId, setSelectedId] = useState(null)
  const [selectedGenre, setSelectedGenre] = useState(null)
  const [applied, setApplied] = useState({ genres: false, styles: false, labels: false, bio: false })

  const searchQ = useQuery({
    queryKey: ['album-discogs-search', album.ratingKey],
    queryFn: () => searchDiscogs(album.ratingKey),
    retry: false,
  })

  const detailQ = useQuery({
    queryKey: ['album-discogs-detail', album.ratingKey, selectedId],
    queryFn: () => fetchDetail(album.ratingKey, selectedId),
    enabled: !!selectedId,
    retry: false,
  })

  const mutation = useMutation({
    mutationFn: (payload) => applyDiscogs(album.ratingKey, payload),
    onSuccess: (_, vars) => {
      setApplied(prev => ({
        genres: prev.genres || !!vars.genres,
        styles: prev.styles || !!vars.styles,
        labels: prev.labels || !!vars.labels,
        bio:    prev.bio    || !!vars.bio,
      }))
      onApplied?.()
    },
  })

  const results = searchQ.data?.results ?? []
  const detail  = detailQ.data

  const canApplyAll = detail && (
    detail.genres?.length || detail.styles?.length || detail.labels?.length || detail.notes
  )

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-plex-card border border-plex-border rounded-xl w-full max-w-xl mx-4 shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-plex-border">
          <div>
            <p className="text-xs text-plex-muted mb-0.5">Enrich album · Discogs</p>
            <h2 className="font-bold text-lg">{album.title}</h2>
            {album.artist && <p className="text-sm text-plex-muted">{album.artist}</p>}
          </div>
          <button onClick={onClose} className="text-plex-muted hover:text-white ml-4 text-xl leading-none">×</button>
        </div>

        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {searchQ.isLoading && <p className="text-plex-muted text-sm animate-pulse">Buscando en Discogs...</p>}
          {searchQ.error   && <p className="text-red-400 text-sm">{searchQ.error.message}</p>}
          {results.length === 0 && !searchQ.isLoading && (
            <p className="text-plex-muted text-sm">No se encontró en Discogs.</p>
          )}

          {/* Search results */}
          <div className="space-y-1.5">
            {results.map(r => (
              <div
                key={r.id}
                onClick={() => { setSelectedId(r.id === selectedId ? null : r.id); setSelectedGenre(null) }}
                className={`flex items-center gap-3 p-3 rounded border cursor-pointer transition-colors ${
                  selectedId === r.id
                    ? 'border-plex-orange bg-plex-orange/10'
                    : 'border-plex-border hover:border-plex-orange/50'
                }`}
              >
                {r.thumb && <img src={r.thumb} alt="" className="w-10 h-10 rounded object-cover flex-shrink-0" />}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{r.title}</p>
                  <p className="text-xs text-plex-muted">
                    {r.year && `${r.year} · `}{r.country || ''}{r.label?.length ? ` · ${r.label[0]}` : ''}
                  </p>
                </div>
                <a
                  href={`https://www.discogs.com/release/${r.id}`}
                  target="_blank" rel="noopener noreferrer"
                  className="text-xs text-plex-orange hover:underline flex-shrink-0"
                  onClick={e => e.stopPropagation()}
                >
                  ↗
                </a>
              </div>
            ))}
          </div>

          {/* Detail */}
          {selectedId && (
            <div className="border-t border-plex-border pt-4 space-y-3">
              {detailQ.isLoading && <p className="text-plex-muted text-sm animate-pulse">Cargando detalle...</p>}
              {detailQ.error    && <p className="text-red-400 text-sm">{detailQ.error.message}</p>}

              {detail && (
                <>
                  {detail.genres?.length > 0 && (
                    <Section title="Género (1 solo)">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex flex-wrap gap-1.5 flex-1">
                          {detail.genres.length === 1
                            ? <TagChip>{detail.genres[0]}</TagChip>
                            : detail.genres.map(g => (
                                <button
                                  key={g}
                                  onClick={() => setSelectedGenre(g === selectedGenre ? null : g)}
                                  className={`inline-block rounded px-2 py-0.5 text-xs transition-colors ${
                                    (selectedGenre === g) || (!selectedGenre && g === detail.genres[0])
                                      ? 'bg-plex-orange/20 text-plex-orange border border-plex-orange/40'
                                      : 'bg-plex-border text-gray-300 hover:border-plex-orange/30 border border-transparent'
                                  }`}
                                >
                                  {g}
                                </button>
                              ))
                          }
                          {detail.genres.length > 1 && (
                            <span className="text-xs text-plex-muted/60 w-full mt-0.5">
                              {selectedGenre ? `Seleccionado: ${selectedGenre}` : `Se aplicará el primero`}
                            </span>
                          )}
                        </div>
                        <ApplyBtn label="Aplicar" applied={applied.genres} disabled={mutation.isPending}
                          onClick={() => mutation.mutate({ genres: [selectedGenre || detail.genres[0]] })} />
                      </div>
                    </Section>
                  )}

                  {detail.styles?.length > 0 && (
                    <Section title="Styles">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex flex-wrap gap-1.5 flex-1">
                          {detail.styles.map(s => <TagChip key={s}>{s}</TagChip>)}
                        </div>
                        <ApplyBtn label="Aplicar" applied={applied.styles} disabled={mutation.isPending}
                          onClick={() => mutation.mutate({ styles: detail.styles })} />
                      </div>
                    </Section>
                  )}

                  {detail.labels?.length > 0 && (
                    <Section title="Labels">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex flex-wrap gap-1.5 flex-1">
                          {detail.labels.map(l => <TagChip key={l}>{l}</TagChip>)}
                        </div>
                        <ApplyBtn label="Aplicar" applied={applied.labels} disabled={mutation.isPending}
                          onClick={() => mutation.mutate({ labels: detail.labels })} />
                      </div>
                    </Section>
                  )}

                  {detail.notes && (
                    <Section title="Review">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm text-gray-300 line-clamp-4 flex-1">{detail.notes}</p>
                        <ApplyBtn label="Aplicar" applied={applied.bio} disabled={mutation.isPending}
                          onClick={() => mutation.mutate({ bio: detail.notes })} />
                      </div>
                    </Section>
                  )}

                  {canApplyAll && (
                    <button
                      onClick={() => mutation.mutate({
                        genres: detail.genres?.length ? [selectedGenre || detail.genres[0]] : null,
                        styles: detail.styles?.length ? detail.styles : null,
                        labels: detail.labels?.length ? detail.labels : null,
                        bio:    detail.notes || null,
                      })}
                      disabled={mutation.isPending}
                      className="w-full bg-plex-orange text-plex-dark font-semibold py-2 rounded text-sm hover:opacity-90 disabled:opacity-50"
                    >
                      Aplicar todo
                    </button>
                  )}

                  {mutation.isError && <p className="text-red-400 text-sm">{mutation.error.message}</p>}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
