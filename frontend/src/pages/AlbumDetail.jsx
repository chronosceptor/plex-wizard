import { useState, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { AlbumDiscogsPanel } from '../components/AlbumDiscogsModal'

const TABS = [
  { id: 'plex',        label: 'Plex' },
  { id: 'musicbrainz', label: 'MusicBrainz' },
  { id: 'discogs',     label: 'Discogs' },
]

function EditableTagGroup({ label, items, onChange }) {
  const [draft, setDraft] = useState('')

  function remove(item) {
    onChange(items.filter(i => i !== item))
  }

  function add(e) {
    e.preventDefault()
    const v = draft.trim()
    if (v && !items.includes(v)) onChange([...items, v])
    setDraft('')
  }

  return (
    <div>
      <p className="text-xs text-plex-muted mb-1.5">{label} <span className="text-plex-muted/60">({items.length})</span></p>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {items.length === 0 && <span className="text-plex-muted text-sm">—</span>}
        {items.map(item => (
          <span key={item} className="inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-xs bg-plex-border text-gray-300">
            {item}
            <button
              type="button"
              onClick={() => remove(item)}
              title={`Remove ${item}`}
              className="text-plex-muted hover:text-red-400 leading-none transition-colors"
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <form onSubmit={add} className="flex gap-1.5">
        <input
          type="text"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          placeholder={`Add ${label.toLowerCase()}...`}
          className="flex-1 bg-plex-dark border border-plex-border rounded px-2 py-1 text-xs text-white placeholder-plex-muted focus:outline-none focus:border-plex-orange"
        />
        <button
          type="submit"
          disabled={!draft.trim()}
          className="text-xs px-2.5 py-1 rounded border border-plex-border text-plex-muted hover:text-white hover:border-white disabled:opacity-30 transition-colors"
        >
          + Add
        </button>
      </form>
    </div>
  )
}

function fieldsFromAlbum(album) {
  return {
    genres:      album.genres ?? [],
    styles:      album.styles ?? [],
    moods:       album.moods ?? [],
    collections: album.collections ?? [],
    labels:      album.labels ?? [],
    summary:     album.summary ?? '',
  }
}

function PlexTab({ album }) {
  const queryClient = useQueryClient()

  const [baseline, setBaseline] = useState(() => fieldsFromAlbum(album))
  const [form,     setForm]     = useState(() => fieldsFromAlbum(album))

  useEffect(() => {
    const fresh = fieldsFromAlbum(album)
    setBaseline(fresh)
    setForm(fresh)
  }, [album.ratingKey])

  const isDirty = JSON.stringify(form) !== JSON.stringify(baseline)

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/album/${album.ratingKey}/edit-metadata`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || 'Error saving') }
      return res.json()
    },
    onSuccess: () => {
      setBaseline(form)
      queryClient.invalidateQueries({ queryKey: ['album-detail', album.ratingKey] })
    },
  })

  function setField(key) {
    return value => setForm(prev => ({ ...prev, [key]: value }))
  }

  function discard() {
    setForm(baseline)
    saveMutation.reset()
  }

  return (
    <div className="space-y-4">
      <div className="bg-plex-card border border-plex-border rounded-xl p-5 space-y-4">
        <h2 className="font-semibold text-sm text-plex-muted uppercase tracking-wide">Metadata</h2>

        <div className="grid sm:grid-cols-2 gap-4">
          <EditableTagGroup label="Genres"      items={form.genres}      onChange={setField('genres')} />
          <EditableTagGroup label="Styles"      items={form.styles}      onChange={setField('styles')} />
          <EditableTagGroup label="Moods"       items={form.moods}       onChange={setField('moods')} />
          <EditableTagGroup label="Collections" items={form.collections} onChange={setField('collections')} />
          <EditableTagGroup label="Labels"      items={form.labels}      onChange={setField('labels')} />
        </div>

        {(album.rating != null || album.audienceRating != null) && (
          <div className="flex gap-6 text-xs text-plex-muted pt-1 border-t border-plex-border/60">
            {album.rating != null && (
              <span>Rating <span className="text-white font-mono">{album.rating}</span></span>
            )}
            {album.audienceRating != null && (
              <span>Audience rating <span className="text-white font-mono">{album.audienceRating}</span></span>
            )}
          </div>
        )}
      </div>

      <div className="bg-plex-card border border-plex-border rounded-xl p-5 space-y-2">
        <h2 className="font-semibold text-sm text-plex-muted uppercase tracking-wide">Bio</h2>
        <textarea
          value={form.summary}
          onChange={e => setField('summary')(e.target.value)}
          placeholder="No bio in Plex."
          rows={5}
          className="w-full bg-plex-dark border border-plex-border rounded-lg px-3 py-2 text-sm text-gray-300 placeholder-plex-muted focus:outline-none focus:border-plex-orange resize-y"
        />
      </div>

      <div className="bg-plex-card border border-plex-border rounded-xl p-5 space-y-2">
        <h2 className="font-semibold text-sm text-plex-muted uppercase tracking-wide">External IDs (guids)</h2>
        {album.guids?.length > 0 ? (
          <ul className="space-y-1">
            {album.guids.map(g => (
              <li key={g} className="text-xs font-mono text-gray-300">{g}</li>
            ))}
          </ul>
        ) : (
          <p className="text-plex-muted text-sm">
            {album.guid ? <span className="font-mono">{album.guid}</span> : 'No additional guids.'}
          </p>
        )}
      </div>

      <div className="flex items-center justify-end gap-3 sticky bottom-0 bg-plex-dark/80 backdrop-blur border-t border-plex-border px-1 py-3">
        {saveMutation.isError && <p className="text-red-400 text-sm mr-auto">{saveMutation.error.message}</p>}
        {saveMutation.isSuccess && !isDirty && <p className="text-green-400 text-sm mr-auto">Saved.</p>}
        {isDirty && (
          <button
            onClick={discard}
            disabled={saveMutation.isPending}
            className="text-sm px-4 py-2 rounded-lg border border-plex-border text-plex-muted hover:text-white hover:border-white transition-colors disabled:opacity-50"
          >
            Discard changes
          </button>
        )}
        <button
          onClick={() => saveMutation.mutate()}
          disabled={!isDirty || saveMutation.isPending}
          className="text-sm px-5 py-2 rounded-lg bg-plex-orange text-plex-dark font-medium hover:opacity-90 transition-colors disabled:opacity-40"
        >
          {saveMutation.isPending ? 'Saving...' : 'Save changes'}
        </button>
      </div>
    </div>
  )
}

async function searchAlbumMatches(ratingKey, query) {
  const res = await fetch(`/api/album/${ratingKey}/matches?query=${encodeURIComponent(query)}`)
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || 'Search failed') }
  return res.json()
}

async function applyAlbumMatch(ratingKey, guid, name) {
  const res = await fetch(`/api/album/${ratingKey}/fix-match`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ guid, name }),
  })
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || 'Fix failed') }
  return res.json()
}

async function refreshAlbumItem(ratingKey) {
  const res = await fetch(`/api/album/${ratingKey}/refresh`, { method: 'PUT' })
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || 'Refresh failed') }
  return res.json()
}

async function applyAlbumMbid(ratingKey, uuid) {
  const res = await fetch(`/api/album/${ratingKey}/fix-match-mbid?uuid=${encodeURIComponent(uuid)}`, { method: 'PUT' })
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || 'MBID not found in Plex search results') }
  return res.json()
}

// Same matching flow as FixMatchModal, rendered inline as a tab instead of a
// popup — there's no extra "suggested data" to compare for MB releases, so
// the match search itself is the tab's content.
function MusicBrainzTab({ album, onApplied }) {
  const [query, setQuery]     = useState(album.title)
  const [results, setResults] = useState(null)
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState(null)
  const [appliedGuid, setAppliedGuid] = useState(null)
  const [manualMbid, setManualMbid] = useState('')

  const fixMutation = useMutation({
    mutationFn: ({ guid, name }) => applyAlbumMatch(album.ratingKey, guid, name),
    onSuccess: (_, vars) => { setAppliedGuid(vars.guid); onApplied?.() },
  })

  const mbidMutation = useMutation({
    mutationFn: (uuid) => applyAlbumMbid(album.ratingKey, uuid),
    onSuccess: (_, uuid) => { setAppliedGuid(`mbid://${uuid}`); onApplied?.() },
  })

  const refreshMutation = useMutation({
    mutationFn: () => refreshAlbumItem(album.ratingKey),
    onSuccess: () => onApplied?.(),
  })

  async function handleSearch(e) {
    e.preventDefault()
    setSearching(true)
    setSearchError(null)
    setResults(null)
    try {
      setResults(await searchAlbumMatches(album.ratingKey, query))
    } catch (err) {
      setSearchError(err.message)
    } finally {
      setSearching(false)
    }
  }

  function handleManualMbid(e) {
    e.preventDefault()
    const uuid = manualMbid.trim()
    if (uuid) mbidMutation.mutate(uuid)
  }

  const isLoading = fixMutation.isPending || refreshMutation.isPending || mbidMutation.isPending
  const mbUrl = album.mbid ? `https://musicbrainz.org/release/${album.mbid}` : null

  return (
    <div className="bg-plex-card border border-plex-border rounded-xl p-5 space-y-4">
      {album.mbid && (
        <div className="flex items-center justify-between p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-sm">
          <span className="text-green-400 font-mono text-xs">Currently linked: {album.mbid}</span>
          <a href={mbUrl} target="_blank" rel="noopener noreferrer" className="text-plex-orange hover:underline text-xs flex-shrink-0 ml-2">MB ↗</a>
        </div>
      )}

      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search by album title..."
          className="flex-1 bg-plex-dark border border-plex-border rounded-lg px-3 py-2 text-sm text-white placeholder-plex-muted focus:outline-none focus:border-plex-orange"
        />
        <button
          type="submit"
          disabled={searching || !query.trim()}
          className="px-4 py-2 bg-plex-orange hover:bg-plex-orange/80 text-white text-sm rounded-lg disabled:opacity-50 transition-colors"
        >
          {searching ? '...' : 'Search'}
        </button>
      </form>

      {/* Manual MBID entry */}
      <form onSubmit={handleManualMbid} className="flex gap-2 items-center">
        <input
          type="text"
          value={manualMbid}
          onChange={e => setManualMbid(e.target.value)}
          placeholder="Or enter MusicBrainz UUID directly..."
          className="flex-1 bg-plex-dark border border-plex-border rounded-lg px-3 py-2 text-sm text-white placeholder-plex-muted focus:outline-none focus:border-plex-orange font-mono"
        />
        <button
          type="submit"
          disabled={isLoading || !manualMbid.trim()}
          className="px-4 py-2 bg-plex-dark border border-plex-border hover:border-plex-orange text-white text-sm rounded-lg disabled:opacity-50 transition-colors whitespace-nowrap"
        >
          Apply ID
        </button>
      </form>

      {searchError && <p className="text-red-400 text-sm">{searchError}</p>}
      {fixMutation.isError && <p className="text-red-400 text-sm">Error: {fixMutation.error.message}</p>}
      {mbidMutation.isError && <p className="text-red-400 text-sm">Error: {mbidMutation.error.message}</p>}

      {results !== null && (
        <div className="space-y-2">
          <p className="text-xs text-plex-muted">{results.length === 0 ? 'No results' : `${results.length} results`}</p>
          <div className="space-y-1.5 max-h-96 overflow-y-auto">
            {results.map(r => {
              const link = r.guid ? `https://musicbrainz.org/release/${r.guid.replace('mbid://', '')}` : null
              const isApplied = appliedGuid === r.guid
              return (
                <div
                  key={r.guid}
                  className={`flex items-center justify-between p-3 rounded border transition-colors ${
                    isApplied ? 'border-green-500 bg-green-900/20' : 'border-plex-border bg-plex-dark hover:border-plex-orange/50'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm truncate">{r.name}</p>
                      {r.year && <span className="text-xs text-plex-muted flex-shrink-0">{r.year}</span>}
                      {link && <a href={link} target="_blank" rel="noopener noreferrer" className="text-xs text-plex-orange hover:underline flex-shrink-0" onClick={e => e.stopPropagation()}>MB ↗</a>}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {r.score != null && <span className="text-xs text-plex-muted">Score: {r.score}</span>}
                      {r.guid && (
                        <button
                          title="Click to copy MBID"
                          onClick={e => { e.stopPropagation(); navigator.clipboard.writeText(r.guid.replace('mbid://', '')) }}
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
                      isApplied ? 'bg-green-600 text-white' : 'bg-plex-orange text-plex-dark hover:opacity-90 disabled:opacity-50'
                    }`}
                  >
                    {isApplied ? 'Applied ✓' : 'Apply'}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="border-t border-plex-border pt-3">
        <p className="text-xs text-plex-muted mb-2">Or refresh metadata from the current agent:</p>
        <button
          onClick={() => refreshMutation.mutate()}
          disabled={isLoading}
          className="w-full border border-plex-border rounded-lg py-2 text-sm text-plex-muted hover:text-white hover:border-white transition-colors disabled:opacity-50"
        >
          {refreshMutation.isPending ? 'Refreshing...' : refreshMutation.isSuccess ? 'Refresh sent ✓' : 'Refresh metadata'}
        </button>
        {refreshMutation.isError && <p className="text-red-400 text-xs mt-1">{refreshMutation.error.message}</p>}
      </div>
    </div>
  )
}

export default function AlbumDetail() {
  const { ratingKey } = useParams()
  const navigate       = useNavigate()
  const queryClient     = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()

  const tab = TABS.some(t => t.id === searchParams.get('tab')) ? searchParams.get('tab') : 'plex'
  function setTab(id) {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      next.set('tab', id)
      return next
    })
  }

  const { data, isLoading, error } = useQuery({
    queryKey: ['album-detail', ratingKey],
    queryFn: async () => {
      const res = await fetch(`/api/album/${ratingKey}/detail`)
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || 'Error loading album') }
      return res.json()
    },
    enabled: !!ratingKey,
  })

  function handleApplied() {
    queryClient.invalidateQueries({ queryKey: ['album-detail', ratingKey] })
  }

  return (
    <div className="space-y-6">
      <button onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-sm text-plex-muted hover:text-white transition-colors">
        ← Back
      </button>

      {isLoading && (
        <div className="flex items-center justify-center h-48">
          <p className="text-plex-muted animate-pulse">Loading album...</p>
        </div>
      )}
      {error && <p className="text-red-400 text-sm">{error.message}</p>}

      {data && (
        <>
          <div className="bg-plex-card border border-plex-border rounded-xl p-5">
            <div className="flex items-start gap-4">
              <div className={`w-16 h-16 rounded-lg flex-shrink-0 flex items-center justify-center text-2xl ${
                data.thumb ? 'bg-plex-border' : 'bg-plex-dark border border-plex-border'
              }`}>
                {data.thumb ? '💿' : '?'}
              </div>
              <div className="flex-1 min-w-0">
                {data.parentRatingKey && (
                  <Link to={`/artists/${data.parentRatingKey}`}
                    className="text-xs text-plex-muted hover:text-white transition-colors">
                    ← {data.parentTitle}
                  </Link>
                )}
                <h1 className="text-2xl font-bold">{data.title}</h1>
                <p className="text-sm text-plex-muted mt-1">
                  {data.year || '—'}{data.trackCount > 0 ? ` · ${data.trackCount} tracks` : ''}
                </p>
              </div>
            </div>
          </div>

          <div className="flex gap-1 border-b border-plex-border">
            {TABS.map(({ id, label }) => (
              <button key={id} onClick={() => setTab(id)}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  tab === id ? 'text-plex-orange border-b-2 border-plex-orange' : 'text-plex-muted hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === 'plex'        && <PlexTab album={data} />}
          {tab === 'musicbrainz' && <MusicBrainzTab album={data} onApplied={handleApplied} />}
          {tab === 'discogs'     && (
            <div className="bg-plex-card border border-plex-border rounded-xl p-5">
              <AlbumDiscogsPanel album={data} onApplied={handleApplied} />
            </div>
          )}
        </>
      )}
    </div>
  )
}
