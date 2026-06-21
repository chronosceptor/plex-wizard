import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { ExpandableText } from './tagAssignment'

async function searchDiscogs(ratingKey) {
  const res = await fetch(`/api/album/${ratingKey}/discogs-search`)
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || 'Discogs error') }
  return res.json()
}

async function fetchDetail(ratingKey, discogsId) {
  const res = await fetch(`/api/album/${ratingKey}/discogs-detail?discogs_id=${discogsId}`)
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || 'Discogs error') }
  return res.json()
}

async function linkDiscogs(ratingKey, discogsId) {
  const res = await fetch(`/api/album/${ratingKey}/discogs-link`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ discogs_id: discogsId }),
  })
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || 'Error linking match') }
  return res.json()
}

async function applyDiscogs(ratingKey, payload) {
  const res = await fetch(`/api/album/${ratingKey}/apply-discogs`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      genres:     payload.genres     ?? null,
      styles:     payload.styles     ?? null,
      labels:     payload.labels     ?? null,
      bio:        payload.bio        ?? null,
      discogs_id: payload.discogsId  ?? null,
    }),
  })
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || 'Error applying changes') }
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
        applied ? 'bg-green-600 text-white' : 'bg-plex-orange text-plex-dark hover:opacity-90 disabled:opacity-50'
      }`}
    >
      {applied ? 'Applied ✓' : label}
    </button>
  )
}

function CompareHeader() {
  return (
    <div className="grid grid-cols-2 gap-4 px-1 text-[10px] uppercase tracking-wide text-plex-muted/60">
      <span>Plex (current)</span>
      <span>Discogs (suggested)</span>
    </div>
  )
}

function CompareRow({ label, note, children }) {
  return (
    <div className="rounded-lg border border-plex-border p-4 space-y-2">
      <p className="text-xs text-plex-muted">
        {label}{note && <span className="text-plex-muted/60"> — {note}</span>}
      </p>
      <div className="grid grid-cols-2 gap-4 items-start">
        {children}
      </div>
    </div>
  )
}

function PlexChips({ items }) {
  return items?.length > 0
    ? <div className="flex flex-wrap gap-1.5">{items.map(i => <TagChip key={i}>{i}</TagChip>)}</div>
    : <p className="text-plex-muted text-sm">—</p>
}

function PlexText({ value }) {
  return value
    ? <p className="text-sm text-gray-300 line-clamp-4">{value}</p>
    : <p className="text-plex-muted text-sm">—</p>
}

// Inner content shared by the modal (quick action from a table row) and the
// AlbumDetail page's Discogs tab (no modal chrome) — same data, two shells.
export function AlbumDiscogsPanel({ album, onApplied }) {
  const [confirmedId, setConfirmedId] = useState(null)
  const [manualSearch, setManualSearch] = useState(false)
  const [selectedGenre, setSelectedGenre] = useState(null)
  const [manualId, setManualId] = useState('')
  const [applied, setApplied] = useState({ genres: false, styles: false, labels: false, bio: false })

  // The match itself is confirmed (and persisted) the moment you pick a
  // candidate or paste an ID — same as artists. Applying fields afterward is
  // a separate, optional, repeatable step.
  const linkedId = confirmedId ?? album.discogs_id ?? null
  const searching = manualSearch || !linkedId
  const effectiveId = linkedId

  const searchQ = useQuery({
    queryKey: ['album-discogs-search', album.ratingKey],
    queryFn: () => searchDiscogs(album.ratingKey),
    enabled: searching,
    retry: false,
  })

  const detailQ = useQuery({
    queryKey: ['album-discogs-detail', album.ratingKey, effectiveId],
    queryFn: () => fetchDetail(album.ratingKey, effectiveId),
    enabled: !!effectiveId,
    retry: false,
  })

  const linkMutation = useMutation({
    mutationFn: (id) => linkDiscogs(album.ratingKey, id),
    onSuccess: (_, id) => {
      setConfirmedId(id)
      setManualSearch(false)
      setSelectedGenre(null)
      setApplied({ genres: false, styles: false, labels: false, bio: false })
    },
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

  const candidates = searchQ.data?.candidates ?? []
  const detail = detailQ.data

  function confirmMatch(id) {
    linkMutation.mutate(id)
  }

  function handleManualLink(e) {
    e.preventDefault()
    const id = parseInt(manualId, 10)
    if (!isNaN(id) && id > 0) { confirmMatch(id); setManualId('') }
  }

  return (
    <div className="space-y-4">
      {linkedId && !searching && (
        <div className="flex items-center justify-between text-xs text-plex-muted">
          <span>Linked to Discogs ID <span className="font-mono text-gray-300">{linkedId}</span></span>
          <button
            onClick={() => setManualSearch(true)}
            className="text-plex-orange hover:underline flex-shrink-0 ml-3"
          >
            Search another
          </button>
        </div>
      )}

      {searching && (
        <>
          {linkedId && (
            <div className="flex items-center justify-between text-xs text-plex-muted">
              <span>Searching for an alternative match to the linked one (Discogs ID <span className="font-mono text-gray-300">{linkedId}</span>)</span>
              <button
                onClick={() => setManualSearch(false)}
                className="text-plex-orange hover:underline flex-shrink-0 ml-3"
              >
                Back to linked
              </button>
            </div>
          )}

          {linkMutation.isError && <p className="text-red-400 text-sm">{linkMutation.error.message}</p>}

          <form onSubmit={handleManualLink} className="flex gap-2">
            <input
              type="number"
              value={manualId}
              onChange={e => setManualId(e.target.value)}
              placeholder="Or enter Discogs release ID directly..."
              min="1"
              disabled={linkMutation.isPending}
              className="flex-1 bg-plex-dark border border-plex-border rounded-lg px-3 py-2 text-sm text-white placeholder-plex-muted focus:outline-none focus:border-plex-orange disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!manualId || linkMutation.isPending}
              className="px-4 py-2 bg-plex-dark border border-plex-border hover:border-plex-orange text-white text-sm rounded-lg disabled:opacity-50 transition-colors whitespace-nowrap"
            >
              Link ID
            </button>
          </form>

          {searchQ.isLoading && <p className="text-plex-muted text-sm animate-pulse">Searching Discogs...</p>}
          {searchQ.error     && <p className="text-red-400 text-sm">{searchQ.error.message}</p>}

          {!searchQ.isLoading && !searchQ.error && candidates.length === 0 && (
            <p className="text-plex-muted text-sm">No match found on Discogs</p>
          )}

          {candidates.length > 0 && (
            <div className={`space-y-1.5 ${linkMutation.isPending ? 'opacity-50 pointer-events-none' : ''}`}>
              {candidates.map(c => (
                <div
                  key={c.id}
                  onClick={() => confirmMatch(c.id)}
                  className="flex items-center gap-3 p-3 rounded border cursor-pointer transition-colors border-plex-border hover:border-plex-orange/50"
                >
                  {c.thumb && <img src={c.thumb} alt="" className="w-10 h-10 rounded object-cover flex-shrink-0" />}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{c.title}</p>
                    <p className="text-xs text-plex-muted">
                      {c.year && `${c.year} · `}{c.country || ''}{c.label?.length ? ` · ${c.label[0]}` : ''}
                    </p>
                  </div>
                  <a
                    href={`https://www.discogs.com/release/${c.id}`}
                    target="_blank" rel="noopener noreferrer"
                    className="text-xs text-plex-orange hover:underline flex-shrink-0"
                    onClick={e => e.stopPropagation()}
                  >
                    View on Discogs ↗
                  </a>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {effectiveId && !searching && (
        <div className="space-y-4">
          {detailQ.isLoading && <p className="text-plex-muted text-sm animate-pulse">Loading data...</p>}
          {detailQ.error     && <p className="text-red-400 text-sm">{detailQ.error.message}</p>}

          {detail && (
            <>
              <CompareHeader />

              {detail.genres?.length > 0 && (() => {
                const chosen = selectedGenre ?? detail.genres[0]
                return (
                  <CompareRow label="Genre" note="pick the one to apply">
                    <PlexChips items={album.genres} />
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-1.5">
                        {detail.genres.map(g => (
                          <button
                            key={g}
                            onClick={() => setSelectedGenre(g)}
                            className={`inline-block rounded px-2 py-0.5 text-xs transition-colors ${
                              g === chosen
                                ? 'bg-plex-orange/20 text-plex-orange border border-plex-orange/40'
                                : 'bg-plex-border text-gray-300 hover:border-plex-orange/30 border border-transparent'
                            }`}
                          >
                            {g}
                          </button>
                        ))}
                      </div>
                      <ApplyBtn label="Apply genre" applied={applied.genres} disabled={mutation.isPending}
                        onClick={() => mutation.mutate({ genres: [chosen], discogsId: effectiveId })} />
                    </div>
                  </CompareRow>
                )
              })()}

              {detail.styles?.length > 0 && (
                <CompareRow label="Styles">
                  <PlexChips items={album.styles} />
                  <div className="space-y-2">
                    <PlexChips items={detail.styles} />
                    <ApplyBtn label="Apply styles" applied={applied.styles} disabled={mutation.isPending}
                      onClick={() => mutation.mutate({ styles: detail.styles, discogsId: effectiveId })} />
                  </div>
                </CompareRow>
              )}

              {detail.labels?.length > 0 && (
                <CompareRow label="Labels">
                  <PlexChips items={album.labels} />
                  <div className="space-y-2">
                    <PlexChips items={detail.labels} />
                    <ApplyBtn label="Apply labels" applied={applied.labels} disabled={mutation.isPending}
                      onClick={() => mutation.mutate({ labels: detail.labels, discogsId: effectiveId })} />
                  </div>
                </CompareRow>
              )}

              {detail.notes && (
                <CompareRow label="Review">
                  <PlexText value={album.summary} />
                  <div className="space-y-2">
                    <ExpandableText value={detail.notes} />
                    <ApplyBtn label="Apply review" applied={applied.bio} disabled={mutation.isPending}
                      onClick={() => mutation.mutate({ bio: detail.notes, discogsId: effectiveId })} />
                  </div>
                </CompareRow>
              )}

              {!detail.genres?.length && !detail.styles?.length && !detail.labels?.length && !detail.notes && (
                <p className="text-plex-muted text-sm">No genres/styles/labels/review on this release.</p>
              )}

              {(detail.genres?.length || detail.styles?.length || detail.labels?.length || detail.notes) && (
                <button
                  onClick={() => mutation.mutate({
                    genres:    detail.genres?.length ? [selectedGenre || detail.genres[0]] : null,
                    styles:    detail.styles?.length ? detail.styles : null,
                    labels:    detail.labels?.length ? detail.labels : null,
                    bio:       detail.notes || null,
                    discogsId: effectiveId,
                  })}
                  disabled={mutation.isPending}
                  className="w-full bg-plex-orange text-plex-dark font-semibold py-2 rounded text-sm hover:opacity-90 disabled:opacity-50"
                >
                  Apply all
                </button>
              )}
            </>
          )}
        </div>
      )}

      {mutation.isError && <p className="text-red-400 text-sm">{mutation.error.message}</p>}
    </div>
  )
}

export default function AlbumDiscogsModal({ album, onClose, onApplied }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-plex-card border border-plex-border rounded-xl w-full max-w-xl mx-4 shadow-2xl">
        <div className="flex items-start justify-between p-5 border-b border-plex-border">
          <div>
            <p className="text-xs text-plex-muted mb-0.5">Enrich album · Discogs</p>
            <h2 className="font-bold text-lg">{album.title}</h2>
            {album.artist && <p className="text-sm text-plex-muted">{album.artist}</p>}
          </div>
          <button onClick={onClose} className="text-plex-muted hover:text-white ml-4 text-xl leading-none">×</button>
        </div>

        <div className="p-5 max-h-[70vh] overflow-y-auto">
          <AlbumDiscogsPanel album={album} onApplied={onApplied} />
        </div>
      </div>
    </div>
  )
}
