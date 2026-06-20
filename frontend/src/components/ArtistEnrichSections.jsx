import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTagAssignment, TagAssignChips, ExpandableText } from './tagAssignment'

// ── API helpers ────────────────────────────────────────────────────────────

async function fetchMBData(ratingKey) {
  const res = await fetch(`/api/artist/${ratingKey}/mb-data`)
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || 'MusicBrainz error') }
  return res.json()
}

async function applyMB(ratingKey, payload) {
  const res = await fetch(`/api/artist/${ratingKey}/apply-mb`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ country: payload.country ?? null, genres: payload.genres ?? null }),
  })
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || 'Error applying changes') }
  return res.json()
}

async function fetchLastFM(ratingKey) {
  const res = await fetch(`/api/artist/${ratingKey}/lastfm-data`)
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || 'Last.fm error') }
  return res.json()
}

async function applyLastFM(ratingKey, payload) {
  const res = await fetch(`/api/artist/${ratingKey}/apply-lastfm`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      styles:  payload.styles  ?? null,
      moods:   payload.moods   ?? null,
      similar: payload.similar ?? null,
      bio:     payload.bio     ?? null,
    }),
  })
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || 'Error applying changes') }
  return res.json()
}

async function fetchDiscogsSearch(ratingKey) {
  const res = await fetch(`/api/artist/${ratingKey}/discogs-search`)
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || 'Discogs error') }
  return res.json()
}

async function fetchDiscogsArtist(discogsId) {
  const res = await fetch(`/api/discogs/artist/${discogsId}`)
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || 'Discogs error') }
  return res.json()
}

async function fetchDiscogsAlbumStyles(ratingKey) {
  const res = await fetch(`/api/artist/${ratingKey}/discogs-album-styles`)
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || 'Discogs error') }
  return res.json()
}

async function applyDiscogs(ratingKey, payload) {
  const res = await fetch(`/api/artist/${ratingKey}/apply-discogs`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ genres: payload.genres ?? null, styles: payload.styles ?? null, bio: payload.bio ?? null }),
  })
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || 'Error applying changes') }
  return res.json()
}

async function fetchWikidata(ratingKey) {
  const res = await fetch(`/api/artist/${ratingKey}/wikidata-data`)
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || 'Error querying Wikidata') }
  return res.json()
}

async function applyCountry(ratingKey, country) {
  const res = await fetch(`/api/artist/${ratingKey}/apply-mb`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ country }),
  })
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || 'Error applying country') }
  return res.json()
}

// ── Shared sub-components ───────────────────────────────────────────────────

export function TagChip({ children, color = 'gray' }) {
  const cls = {
    gray:   'bg-plex-border text-gray-300',
    orange: 'bg-plex-orange/20 text-plex-orange border border-plex-orange/40',
    green:  'bg-green-900/30 text-green-300 border border-green-700',
  }[color]
  return <span className={`inline-block rounded px-2 py-0.5 text-xs ${cls}`}>{children}</span>
}

function ApplyBtn({ onClick, disabled, applied, label = 'Apply' }) {
  return (
    <button
      onClick={onClick} disabled={disabled || applied}
      className={`flex-shrink-0 px-3 py-1.5 rounded text-xs font-semibold transition-colors ${
        applied ? 'bg-green-600 text-white' : 'bg-plex-orange text-plex-dark hover:opacity-90 disabled:opacity-50'
      }`}
    >
      {applied ? 'Applied ✓' : label}
    </button>
  )
}

function SourceSection({ title, link, children }) {
  return (
    <div className="bg-plex-card border border-plex-border rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-sm text-plex-muted uppercase tracking-wide">{title}</h2>
        {link && (
          <a href={link} target="_blank" rel="noopener noreferrer" className="text-xs text-plex-orange hover:underline">
            View on {title} ↗
          </a>
        )}
      </div>
      {children}
    </div>
  )
}

// ── Plex vs. service comparison helpers ─────────────────────────────────────
// Left column always shows what Plex currently has; right column shows what
// the service offers, with apply controls — lets the user compare before acting.

function CompareHeader({ service }) {
  return (
    <div className="grid grid-cols-2 gap-4 px-1 text-[10px] uppercase tracking-wide text-plex-muted/60">
      <span>Plex (current)</span>
      <span>{service} (suggested)</span>
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

// Toggleable selection over a suggested list — defaults to "all selected" until
// the user deselects individual items, so existing apply-all behavior is unchanged.
function useToggleSet(items) {
  const [overrides, setOverrides] = useState(null)
  const selected = overrides ?? new Set(items)
  function toggle(item) {
    setOverrides(prev => {
      const base = new Set(prev ?? items)
      if (base.has(item)) base.delete(item)
      else base.add(item)
      return base
    })
  }
  return [selected, toggle]
}

// Suggested chips the user can toggle on/off before applying. Items already
// present in the corresponding Plex field are marked so the diff is obvious.
function SelectableChips({ items, existing = [], selected, onToggle }) {
  if (!items?.length) return <p className="text-plex-muted text-sm">—</p>
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map(item => {
        const isSelected = selected.has(item)
        const isExisting = existing.includes(item)
        return (
          <button
            key={item}
            type="button"
            onClick={() => onToggle(item)}
            title={isExisting ? 'Already in Plex' : 'New'}
            className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs border transition-colors ${
              !isSelected
                ? 'bg-transparent text-plex-muted/50 border-plex-border/40 line-through'
                : isExisting
                  ? 'bg-plex-border text-gray-300 border-plex-border'
                  : 'bg-plex-orange/15 text-plex-orange border-plex-orange/40'
            }`}
          >
            {isExisting && isSelected && <span className="opacity-60">✓</span>}
            {item}
          </button>
        )
      })}
    </div>
  )
}

// ── MusicBrainz section ──────────────────────────────────────────────────────

export function MusicBrainzSection({ artist, onApplied }) {
  const [applied, setApplied] = useState({ country: false, genres: false })
  const [selectedGenre, setSelectedGenre] = useState(null)

  const mbid = artist.mbid || (artist.guid?.startsWith('mbid://') ? artist.guid.replace('mbid://', '') : null)
  const mbUrl = mbid ? `https://musicbrainz.org/artist/${mbid}` : null

  const { data: mb, isLoading, error } = useQuery({
    queryKey: ['mb-data', artist.ratingKey],
    queryFn: () => fetchMBData(artist.ratingKey),
    enabled: !!mbid,
    retry: false,
  })

  const mutation = useMutation({
    mutationFn: (payload) => applyMB(artist.ratingKey, payload),
    onSuccess: (_, vars) => {
      setApplied(prev => ({
        country: prev.country || !!vars.country,
        genres:  prev.genres  || !!vars.genres,
      }))
      onApplied?.()
    },
  })

  return (
    <SourceSection title="MusicBrainz" link={mbUrl}>
      {!mbid && (
        <div className="py-4 text-center space-y-1">
          <p className="text-plex-muted text-sm">This artist doesn't have an MBID yet.</p>
          <p className="text-xs text-plex-muted">Use "Fix Match" to link it to MusicBrainz first.</p>
        </div>
      )}

      {mbid && isLoading && <p className="text-plex-muted text-sm animate-pulse">Querying MusicBrainz...</p>}
      {mbid && error && <p className="text-red-400 text-sm">{error.message}</p>}

      {mb && (
        <div className="space-y-4">
          {(mb.type || mb.founded) && (
            <div className="flex items-center gap-4 text-xs text-plex-muted">
              {mb.type    && <span>{mb.type}</span>}
              {mb.founded && <span>Founded {mb.founded}{mb.foundedIn ? ` · ${mb.foundedIn}` : ''}</span>}
            </div>
          )}

          <CompareHeader service="MusicBrainz" />

          <CompareRow label="Country">
            <PlexText value={artist.country} />
            <div className="space-y-2">
              {mb.country
                ? <p className="text-sm text-gray-300">{mb.country}</p>
                : <p className="text-plex-muted text-sm">Not available on MB</p>}
              {mb.country && mb.country !== artist.country && (
                <ApplyBtn applied={applied.country} disabled={mutation.isPending}
                  label="Apply country" onClick={() => mutation.mutate({ country: mb.country })} />
              )}
            </div>
          </CompareRow>

          {mb.genres?.length > 0 && (() => {
            const chosen = selectedGenre ?? mb.genres[0].name
            return (
              <CompareRow label="Genres" note="pick the one to apply">
                <PlexChips items={artist.genres} />
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-1.5">
                    {mb.genres.slice(0, 10).map(g => {
                      const isSelected = g.name === chosen
                      const isExisting = artist.genres?.includes(g.name)
                      return (
                        <button
                          key={g.name}
                          onClick={() => setSelectedGenre(g.name)}
                          title={isExisting ? 'Already in Plex' : 'New'}
                          className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-plex-orange/20 text-plex-orange border border-plex-orange/60 ring-1 ring-plex-orange/40'
                              : 'bg-plex-border text-gray-300 hover:border-plex-orange/40 border border-transparent'
                          }`}
                        >
                          {isExisting && <span className="opacity-60">✓</span>}
                          {g.name}
                          <span className={`text-[10px] ${isSelected ? 'opacity-70' : 'opacity-40'}`}>{g.count}</span>
                        </button>
                      )
                    })}
                  </div>
                  <ApplyBtn applied={applied.genres} disabled={mutation.isPending}
                    label="Apply genre"
                    onClick={() => mutation.mutate({ genres: [chosen] })} />
                </div>
              </CompareRow>
            )
          })()}

          {mb.country && mb.genres?.length > 0 && (
            <button
              onClick={() => mutation.mutate({ country: mb.country, genres: [selectedGenre ?? mb.genres[0].name] })}
              disabled={mutation.isPending || (applied.country && applied.genres)}
              className="w-full bg-plex-orange text-plex-dark font-semibold py-2 rounded text-sm hover:opacity-90 disabled:opacity-50"
            >
              {applied.country && applied.genres ? 'All applied ✓' : 'Apply all'}
            </button>
          )}

          {mutation.isError && <p className="text-red-400 text-sm">{mutation.error.message}</p>}
        </div>
      )}
    </SourceSection>
  )
}

// ── Last.fm section ──────────────────────────────────────────────────────────

export function LastFMSection({ artist, onApplied }) {
  const [applied, setApplied] = useState({ styles: false, moods: false, bio: false, similar: false })

  const { data, isLoading, error } = useQuery({
    queryKey: ['lastfm', artist.ratingKey],
    queryFn: () => fetchLastFM(artist.ratingKey),
    retry: false,
  })

  const [tagAssignment, cycleTag]        = useTagAssignment()
  const [selectedSimilar, toggleSimilar] = useToggleSet(data?.similar ?? [])

  const styleTags = (data?.tags ?? []).filter(t => tagAssignment[t] === 'style')
  const moodTags  = (data?.tags ?? []).filter(t => tagAssignment[t] === 'mood')

  const mutation = useMutation({
    mutationFn: (payload) => applyLastFM(artist.ratingKey, payload),
    onSuccess: (_, vars) => {
      setApplied(prev => ({
        styles:  prev.styles  || !!vars.styles,
        moods:   prev.moods   || !!vars.moods,
        bio:     prev.bio     || !!vars.bio,
        similar: prev.similar || !!vars.similar,
      }))
      onApplied?.()
    },
  })

  return (
    <SourceSection title="Last.fm" link={data?.url}>
      {isLoading && <p className="text-plex-muted text-sm animate-pulse">Querying Last.fm...</p>}
      {error     && <p className="text-red-400 text-sm">{error.message}</p>}

      {data && (
        <div className="space-y-4">
          {(data.listeners > 0 || data.playcount > 0) && (
            <div className="flex gap-4 text-xs text-plex-muted">
              {data.listeners > 0 && <span><span className="text-white font-mono">{data.listeners.toLocaleString()}</span> listeners</span>}
              {data.playcount > 0 && <span><span className="text-white font-mono">{data.playcount.toLocaleString()}</span> scrobbles</span>}
            </div>
          )}

          <CompareHeader service="Last.fm" />

          {data.tags.length > 0 && (
            <CompareRow label="Tags" note="click a tag to assign it as a style, click again for mood, again to clear">
              <div className="space-y-2">
                <div>
                  <p className="text-[10px] text-plex-muted/70 mb-1">Styles</p>
                  <PlexChips items={artist.styles} />
                </div>
                <div>
                  <p className="text-[10px] text-plex-muted/70 mb-1">Moods</p>
                  <PlexChips items={artist.moods} />
                </div>
              </div>
              <div className="space-y-2">
                <TagAssignChips items={data.tags} assignment={tagAssignment} onCycle={cycleTag}
                  existingStyles={artist.styles} existingMoods={artist.moods} />
                <div className="flex flex-wrap gap-2">
                  <ApplyBtn applied={applied.styles} disabled={mutation.isPending || styleTags.length === 0}
                    label="Apply as styles" onClick={() => mutation.mutate({ styles: styleTags })} />
                  <ApplyBtn applied={applied.moods} disabled={mutation.isPending || moodTags.length === 0}
                    label="Apply as moods" onClick={() => mutation.mutate({ moods: moodTags })} />
                </div>
              </div>
            </CompareRow>
          )}

          {data.bio && (
            <CompareRow label="Bio">
              <PlexText value={artist.summary} />
              <div className="space-y-2">
                <ExpandableText value={data.bio} />
                <ApplyBtn applied={applied.bio} disabled={mutation.isPending}
                  label="Apply bio" onClick={() => mutation.mutate({ bio: data.bio })} />
              </div>
            </CompareRow>
          )}

          {data.similar.length > 0 && (
            <CompareRow label="Similar artists" note="toggle which ones to apply">
              <PlexChips items={artist.similar} />
              <div className="space-y-2">
                <SelectableChips items={data.similar} existing={artist.similar} selected={selectedSimilar} onToggle={toggleSimilar} />
                <ApplyBtn applied={applied.similar} disabled={mutation.isPending || selectedSimilar.size === 0}
                  label="Apply similar" onClick={() => mutation.mutate({ similar: Array.from(selectedSimilar) })} />
              </div>
            </CompareRow>
          )}

          {data.bio && (
            <button
              onClick={() => mutation.mutate({
                styles: styleTags.length > 0 ? styleTags : null,
                moods: moodTags.length > 0 ? moodTags : null,
                bio: data.bio,
                similar: Array.from(selectedSimilar),
              })}
              disabled={mutation.isPending}
              className="w-full bg-plex-orange text-plex-dark font-semibold py-2 rounded text-sm hover:opacity-90 disabled:opacity-50"
            >
              Apply all
            </button>
          )}

          {mutation.isError && <p className="text-red-400 text-sm">{mutation.error.message}</p>}
        </div>
      )}
    </SourceSection>
  )
}

// ── Discogs section ──────────────────────────────────────────────────────────

export function DiscogsSection({ artist, onApplied }) {
  const linkedId = artist.discogs_id ?? null

  const [manualSearch, setManualSearch] = useState(false)
  const [selectedId, setSelectedId] = useState(null)
  const [selectedGenre, setSelectedGenre] = useState(null)
  const [applied, setApplied] = useState({ bio: false, albumGenre: false, albumStyles: false })

  const searching = manualSearch || !linkedId
  const effectiveId = searching ? selectedId : linkedId

  const searchQ = useQuery({
    queryKey: ['discogs-search', artist.ratingKey],
    queryFn: () => fetchDiscogsSearch(artist.ratingKey),
    enabled: searching,
    retry: false,
  })

  const detailQ = useQuery({
    queryKey: ['discogs-artist', effectiveId],
    queryFn: () => fetchDiscogsArtist(effectiveId),
    enabled: !!effectiveId,
    retry: false,
  })

  const albumStylesQ = useQuery({
    queryKey: ['discogs-album-styles', artist.ratingKey],
    queryFn: () => fetchDiscogsAlbumStyles(artist.ratingKey),
    retry: false,
  })

  const [selectedAlbumStyles, toggleAlbumStyle] = useToggleSet((albumStylesQ.data?.styles ?? []).map(s => s.name))

  const mutation = useMutation({
    mutationFn: (payload) => applyDiscogs(artist.ratingKey, payload),
    onSuccess: (_, vars) => {
      setApplied(prev => ({
        ...prev,
        bio:         prev.bio         || !!vars.bio,
        albumGenre:  prev.albumGenre  || (!!vars.genres && vars.source === 'albums'),
        albumStyles: prev.albumStyles || (!!vars.styles && vars.source === 'albums'),
      }))
      onApplied?.()
    },
  })

  const candidates = searchQ.data?.candidates ?? []
  const selectedCandidate = searching ? candidates.find(c => c.id === selectedId) : null
  const link = selectedCandidate
    ? `https://www.discogs.com${selectedCandidate.url}`
    : (effectiveId ? `https://www.discogs.com/artist/${effectiveId}` : null)

  return (
    <SourceSection title="Discogs" link={link}>
      <div className="space-y-4">
        {linkedId && (
          <div className="flex items-center justify-between text-xs text-plex-muted">
            {searching
              ? <span>Searching for an alternative match to the linked one (Discogs ID <span className="font-mono text-gray-300">{linkedId}</span>)</span>
              : <span>Linked to Discogs ID <span className="font-mono text-gray-300">{linkedId}</span></span>}
            <button
              onClick={() => { setManualSearch(s => !s); setSelectedId(null) }}
              className="text-plex-orange hover:underline flex-shrink-0 ml-3"
            >
              {searching ? 'Back to linked' : 'Search another'}
            </button>
          </div>
        )}

        {searching && (
          <>
            {searchQ.isLoading && <p className="text-plex-muted text-sm animate-pulse">Searching Discogs...</p>}
            {searchQ.error     && <p className="text-red-400 text-sm">{searchQ.error.message}</p>}

            {!searchQ.isLoading && !searchQ.error && candidates.length === 0 && (
              <p className="text-plex-muted text-sm">No match found on Discogs</p>
            )}

            {candidates.length > 0 && (
              <div className="space-y-1.5">
                {candidates.map(c => (
                  <div
                    key={c.id}
                    onClick={() => setSelectedId(c.id)}
                    className={`flex items-center gap-3 p-3 rounded border cursor-pointer transition-colors ${
                      selectedId === c.id
                        ? 'border-plex-orange bg-plex-orange/10'
                        : 'border-plex-border hover:border-plex-orange/50'
                    }`}
                  >
                    {c.thumb && <img src={c.thumb} alt="" className="w-10 h-10 rounded object-cover flex-shrink-0" />}
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{c.name}</p>
                      <a
                        href={`https://www.discogs.com${c.url}`}
                        target="_blank" rel="noopener noreferrer"
                        className="text-xs text-plex-orange hover:underline"
                        onClick={e => e.stopPropagation()}
                      >
                        View on Discogs ↗
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {effectiveId && (
          <div className={searching ? 'border-t border-plex-border pt-4 space-y-3' : 'space-y-3'}>
            {detailQ.isLoading && <p className="text-plex-muted text-sm animate-pulse">Loading data...</p>}
            {detailQ.error && <p className="text-red-400 text-sm">{detailQ.error.message}</p>}
            {detailQ.data && (
              <>
                {detailQ.data.profile ? (
                  <>
                    <CompareHeader service="Discogs" />
                    <CompareRow label="Bio">
                      <PlexText value={artist.summary} />
                      <div className="space-y-2">
                        <ExpandableText value={detailQ.data.profile} />
                        <ApplyBtn
                          applied={applied.bio}
                          disabled={mutation.isPending}
                          label="Apply bio"
                          onClick={() => mutation.mutate({ bio: detailQ.data.profile })}
                        />
                      </div>
                    </CompareRow>
                  </>
                ) : (
                  <p className="text-xs text-plex-muted">No bio on Discogs</p>
                )}

                {albumStylesQ.isLoading && (
                  <p className="text-plex-muted text-sm animate-pulse">Rolling up genres/styles from matched albums...</p>
                )}

                {albumStylesQ.data && (albumStylesQ.data.genres.length > 0 || albumStylesQ.data.styles.length > 0) ? (
                  <>
                    <p className="text-[10px] text-plex-muted/60">
                      Rolled up from {albumStylesQ.data.albumsConsidered} of {albumStylesQ.data.totalAlbums} albums with a confirmed Discogs match
                    </p>

                    {albumStylesQ.data.genres.length > 0 && (() => {
                      const chosen = selectedGenre ?? albumStylesQ.data.genres[0].name
                      return (
                        <CompareRow label="Genre (from albums)" note="pick the one to apply">
                          <PlexChips items={artist.genres} />
                          <div className="space-y-2">
                            <div className="flex flex-wrap gap-1.5">
                              {albumStylesQ.data.genres.slice(0, 10).map(g => {
                                const isSelected = g.name === chosen
                                const isExisting = artist.genres?.includes(g.name)
                                return (
                                  <button
                                    key={g.name}
                                    onClick={() => setSelectedGenre(g.name)}
                                    title={isExisting ? 'Already in Plex' : 'New'}
                                    className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs transition-colors cursor-pointer ${
                                      isSelected
                                        ? 'bg-plex-orange/20 text-plex-orange border border-plex-orange/60 ring-1 ring-plex-orange/40'
                                        : 'bg-plex-border text-gray-300 hover:border-plex-orange/40 border border-transparent'
                                    }`}
                                  >
                                    {isExisting && <span className="opacity-60">✓</span>}
                                    {g.name}
                                    <span className={`text-[10px] ${isSelected ? 'opacity-70' : 'opacity-40'}`}>{g.count}</span>
                                  </button>
                                )
                              })}
                            </div>
                            <ApplyBtn applied={applied.albumGenre} disabled={mutation.isPending}
                              label="Apply genre" onClick={() => mutation.mutate({ genres: [chosen], source: 'albums' })} />
                          </div>
                        </CompareRow>
                      )
                    })()}

                    {albumStylesQ.data.styles.length > 0 && (
                      <CompareRow label="Styles (from albums)" note="toggle which to apply">
                        <PlexChips items={artist.styles} />
                        <div className="space-y-2">
                          <SelectableChips items={albumStylesQ.data.styles.map(s => s.name)} existing={artist.styles}
                            selected={selectedAlbumStyles} onToggle={toggleAlbumStyle} />
                          <ApplyBtn applied={applied.albumStyles} disabled={mutation.isPending || selectedAlbumStyles.size === 0}
                            label="Apply styles" onClick={() => mutation.mutate({ styles: Array.from(selectedAlbumStyles), source: 'albums' })} />
                        </div>
                      </CompareRow>
                    )}
                  </>
                ) : (
                  !albumStylesQ.isLoading && (
                    <p className="text-xs text-plex-muted">
                      No genres/styles yet — confirm a Discogs match for at least one album (via the "Discogs" button in the Albums tab) to roll them up here.
                    </p>
                  )
                )}
              </>
            )}
          </div>
        )}

        {mutation.isError && <p className="text-red-400 text-sm">{mutation.error.message}</p>}
      </div>
    </SourceSection>
  )
}

// ── Wikidata section ─────────────────────────────────────────────────────────

export function WikidataSection({ artist, onApplied }) {
  const [applied, setApplied] = useState(false)

  const { data, isLoading, error } = useQuery({
    queryKey: ['wikidata', artist.ratingKey],
    queryFn: () => fetchWikidata(artist.ratingKey),
    retry: false,
  })

  const mutation = useMutation({
    mutationFn: (country) => applyCountry(artist.ratingKey, country),
    onSuccess: () => { setApplied(true); onApplied?.() },
  })

  return (
    <SourceSection title="Wikidata" link={data?.wikidataUrl}>
      {isLoading && <p className="text-plex-muted text-sm animate-pulse">Querying Wikidata...</p>}
      {error     && <p className="text-red-400 text-sm">{error.message}</p>}

      {data && (
        <div className="space-y-4">
          {data.wikipediaUrl && (
            <a href={data.wikipediaUrl} target="_blank" rel="noopener noreferrer"
               className="text-xs text-plex-orange hover:underline">
              View on Wikipedia ↗
            </a>
          )}

          <CompareHeader service="Wikidata" />
          <CompareRow label="Country of origin">
            <PlexText value={artist.country} />
            <div className="space-y-2">
              {data.country ? (
                <p className="text-sm text-gray-300">
                  {data.country}
                  {data.countryCode && (
                    <span className="ml-2 text-xs text-plex-muted font-mono">{data.countryCode}</span>
                  )}
                </p>
              ) : (
                <p className="text-plex-muted text-sm">Not available on Wikidata</p>
              )}
              {data.country && data.country !== artist.country && (
                <ApplyBtn
                  applied={applied}
                  disabled={mutation.isPending}
                  label="Apply country"
                  onClick={() => mutation.mutate(data.country)}
                />
              )}
            </div>
          </CompareRow>

          {mutation.isError && <p className="text-red-400 text-sm">{mutation.error.message}</p>}
        </div>
      )}
    </SourceSection>
  )
}
