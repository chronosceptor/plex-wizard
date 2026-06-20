import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useTagAssignment, TagAssignChips, ExpandableText } from './tagAssignment'

async function fetchLastFM(ratingKey) {
  const res = await fetch(`/api/album/${ratingKey}/lastfm-data`)
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || 'Last.fm error') }
  return res.json()
}

async function applyLastFM(ratingKey, payload) {
  const res = await fetch(`/api/album/${ratingKey}/apply-lastfm`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      styles: payload.styles ?? null,
      moods:  payload.moods  ?? null,
      bio:    payload.bio    ?? null,
    }),
  })
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || 'Error applying changes') }
  return res.json()
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

function Section({ title, note, children }) {
  return (
    <div className="rounded-lg border border-plex-border p-4 space-y-2">
      <p className="text-xs text-plex-muted">{title}{note && <span className="text-plex-muted/60"> — {note}</span>}</p>
      {children}
    </div>
  )
}

// Inner content shared by the modal (quick action from a table row) and the
// AlbumDetail page's Last.fm tab (no modal chrome) — same data, two shells.
export function AlbumLastFMPanel({ album, onApplied }) {
  const [applied, setApplied] = useState({ styles: false, moods: false, bio: false })
  const [tagAssignment, cycleTag] = useTagAssignment()

  const { data, isLoading, error } = useQuery({
    queryKey: ['album-lastfm', album.ratingKey],
    queryFn: () => fetchLastFM(album.ratingKey),
    retry: false,
  })

  const mutation = useMutation({
    mutationFn: (payload) => applyLastFM(album.ratingKey, payload),
    onSuccess: (_, vars) => {
      setApplied(prev => ({
        styles: prev.styles || !!vars.styles,
        moods:  prev.moods  || !!vars.moods,
        bio:    prev.bio    || !!vars.bio,
      }))
      onApplied?.()
    },
  })

  const styleTags = (data?.tags ?? []).filter(t => tagAssignment[t] === 'style')
  const moodTags  = (data?.tags ?? []).filter(t => tagAssignment[t] === 'mood')

  return (
    <div className="space-y-4">
      {isLoading && <p className="text-plex-muted text-sm animate-pulse">Querying Last.fm...</p>}
      {error     && <p className="text-red-400 text-sm">{error.message}</p>}

      {data && !data.tags?.length && !data.bio && (
        <p className="text-plex-muted text-sm">No data found on Last.fm for this album.</p>
      )}

      {data?.tags?.length > 0 && (
        <Section title="Tags" note="click a tag to assign it as a style, click again for mood, again to clear">
          <TagAssignChips items={data.tags} assignment={tagAssignment} onCycle={cycleTag}
            existingStyles={album.styles} existingMoods={album.moods} />
          <div className="flex flex-wrap gap-2">
            <ApplyBtn label="Apply as styles" applied={applied.styles} disabled={mutation.isPending || styleTags.length === 0}
              onClick={() => mutation.mutate({ styles: styleTags })} />
            <ApplyBtn label="Apply as moods" applied={applied.moods} disabled={mutation.isPending || moodTags.length === 0}
              onClick={() => mutation.mutate({ moods: moodTags })} />
          </div>
        </Section>
      )}

      {data?.bio && (
        <Section title="Bio">
          <ExpandableText value={data.bio} />
          <ApplyBtn label="Apply bio" applied={applied.bio} disabled={mutation.isPending}
            onClick={() => mutation.mutate({ bio: data.bio })} />
        </Section>
      )}

      {data && (data.tags?.length > 0 || data.bio) && (
        <button
          onClick={() => mutation.mutate({
            styles: styleTags.length > 0 ? styleTags : null,
            moods:  moodTags.length  > 0 ? moodTags  : null,
            bio:    data.bio || null,
          })}
          disabled={mutation.isPending}
          className="w-full bg-plex-orange text-plex-dark font-semibold py-2 rounded text-sm hover:opacity-90 disabled:opacity-50"
        >
          Apply all
        </button>
      )}

      {mutation.isError && <p className="text-red-400 text-sm">{mutation.error.message}</p>}
    </div>
  )
}

export default function AlbumLastFMModal({ album, onClose, onApplied }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-plex-card border border-plex-border rounded-xl w-full max-w-xl mx-4 shadow-2xl">
        <div className="flex items-start justify-between p-5 border-b border-plex-border">
          <div>
            <p className="text-xs text-plex-muted mb-0.5">Enrich album · Last.fm</p>
            <h2 className="font-bold text-lg">{album.title}</h2>
            {album.artist && <p className="text-sm text-plex-muted">{album.artist}</p>}
          </div>
          <button onClick={onClose} className="text-plex-muted hover:text-white ml-4 text-xl leading-none">×</button>
        </div>

        <div className="p-5 max-h-[70vh] overflow-y-auto">
          <AlbumLastFMPanel album={album} onApplied={onApplied} />
        </div>
      </div>
    </div>
  )
}
