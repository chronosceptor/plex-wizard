import { useState, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import FixMatchModal from '../components/FixMatchModal'
import AlbumDiscogsModal from '../components/AlbumDiscogsModal'
import MusicBrainzLinkModal from '../components/MusicBrainzLinkModal'
import DiscogsLinkModal from '../components/DiscogsLinkModal'
import LastFMLinkModal from '../components/LastFMLinkModal'
import MergeArtistModal from '../components/MergeArtistModal'
import { LinkedChip, LinkBtn } from './Artists'
import AlbumsTable from '../components/AlbumsTable'
import {
  MusicBrainzSection,
  LastFMSection,
  DiscogsSection,
  WikidataSection,
} from '../components/ArtistEnrichSections'

const TABS = [
  { id: 'plex',        label: 'Plex' },
  { id: 'albums',      label: 'Albums' },
  { id: 'musicbrainz', label: 'MusicBrainz' },
  { id: 'discogs',     label: 'Discogs' },
  { id: 'lastfm',      label: 'Last.fm' },
  { id: 'wikidata',    label: 'Wikidata' },
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


function fieldsFromArtist(artist) {
  return {
    genres:      artist.genres ?? [],
    styles:      artist.styles ?? [],
    moods:       artist.moods ?? [],
    countries:   artist.countries ?? [],
    collections: artist.collections ?? [],
    labels:      artist.labels ?? [],
    similar:     artist.similar ?? [],
    summary:     artist.summary ?? '',
  }
}

function PlexTab({ artist }) {
  const queryClient = useQueryClient()

  const [baseline, setBaseline] = useState(() => fieldsFromArtist(artist))
  const [form,     setForm]     = useState(() => fieldsFromArtist(artist))

  // Resync local edits when navigating to a different artist
  useEffect(() => {
    const fresh = fieldsFromArtist(artist)
    setBaseline(fresh)
    setForm(fresh)
  }, [artist.ratingKey])

  const isDirty = JSON.stringify(form) !== JSON.stringify(baseline)

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/artist/${artist.ratingKey}/edit-metadata`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || 'Error saving') }
      return res.json()
    },
    onSuccess: () => {
      setBaseline(form)
      queryClient.invalidateQueries({ queryKey: ['artist-albums', artist.ratingKey] })
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
          <EditableTagGroup label="Genres"          items={form.genres}      onChange={setField('genres')} />
          <EditableTagGroup label="Styles"          items={form.styles}      onChange={setField('styles')} />
          <EditableTagGroup label="Moods"            items={form.moods}       onChange={setField('moods')} />
          <EditableTagGroup label="Countries"        items={form.countries}   onChange={setField('countries')} />
          <EditableTagGroup label="Collections"      items={form.collections} onChange={setField('collections')} />
          <EditableTagGroup label="Labels"            items={form.labels}      onChange={setField('labels')} />
          <EditableTagGroup label="Similar artists"   items={form.similar}     onChange={setField('similar')} />
        </div>

        {(artist.rating != null || artist.audienceRating != null) && (
          <div className="flex gap-6 text-xs text-plex-muted pt-1 border-t border-plex-border/60">
            {artist.rating != null && (
              <span>Rating <span className="text-white font-mono">{artist.rating}</span></span>
            )}
            {artist.audienceRating != null && (
              <span>Audience rating <span className="text-white font-mono">{artist.audienceRating}</span></span>
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
        {artist.guids?.length > 0 ? (
          <ul className="space-y-1">
            {artist.guids.map(g => (
              <li key={g} className="text-xs font-mono text-gray-300">{g}</li>
            ))}
          </ul>
        ) : (
          <p className="text-plex-muted text-sm">
            {artist.guid ? <span className="font-mono">{artist.guid}</span> : 'No additional guids.'}
          </p>
        )}
      </div>

      {/* Save bar */}
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

function AlbumsTab({ artist, onFix, onDiscogs }) {
  const albums = artist.albums ?? []
  return (
    <div>
      <h2 className="font-semibold text-sm mb-3 text-plex-muted uppercase tracking-wide">
        Albums ({albums.length})
      </h2>
      <AlbumsTable albums={albums} showArtist={false} onFix={onFix} onDiscogs={onDiscogs} />
    </div>
  )
}

export default function ArtistDetail() {
  const { ratingKey } = useParams()
  const navigate      = useNavigate()
  const queryClient   = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()

  const [fixItem,     setFixItem]     = useState(null)
  const [discogsItem, setDiscogsItem] = useState(null)

  const [mbLinkItem,      setMbLinkItem]      = useState(null)
  const [discogsLinkItem, setDiscogsLinkItem] = useState(null)
  const [lastfmLinkItem,  setLastfmLinkItem]  = useState(null)
  const [mergeItem,       setMergeItem]       = useState(null)

  const tab = TABS.some(t => t.id === searchParams.get('tab')) ? searchParams.get('tab') : 'plex'
  function setTab(id) {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      next.set('tab', id)
      return next
    })
  }

  const { data, isLoading, error } = useQuery({
    queryKey: ['artist-albums', ratingKey],
    queryFn: async () => {
      const res = await fetch(`/api/artist/${ratingKey}/albums`)
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || 'Error loading artist') }
      return res.json()
    },
    enabled: !!ratingKey,
  })

  // After any album action, refetch to show updated dots
  function handleAlbumAction() {
    setFixItem(null)
    setDiscogsItem(null)
    queryClient.invalidateQueries({ queryKey: ['artist-albums', ratingKey] })
  }

  // After applying enrichment data, refetch to show updated header status
  function handleEnrichApplied() {
    queryClient.invalidateQueries({ queryKey: ['artist-albums', ratingKey] })
  }

  function closeMbLink()      { setMbLinkItem(null);      queryClient.invalidateQueries({ queryKey: ['artist-albums', ratingKey] }) }
  function closeDiscogsLink() { setDiscogsLinkItem(null); queryClient.invalidateQueries({ queryKey: ['artist-albums', ratingKey] }) }
  function closeLastfmLink()  { setLastfmLinkItem(null);  queryClient.invalidateQueries({ queryKey: ['artist-albums', ratingKey] }) }

  return (
    <div className="space-y-6">
      <button onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-sm text-plex-muted hover:text-white transition-colors">
        ← Back
      </button>

      {isLoading && (
        <div className="flex items-center justify-center h-48">
          <p className="text-plex-muted animate-pulse">Loading artist...</p>
        </div>
      )}
      {error && <p className="text-red-400 text-sm">{error.message}</p>}

      {data && (
        <>
          {/* Artist header */}
          <div className="bg-plex-card border border-plex-border rounded-xl p-5">
            <div className="flex items-start gap-4">
              <div className={`w-16 h-16 rounded-lg flex-shrink-0 flex items-center justify-center text-2xl ${
                data.thumb ? 'bg-plex-border' : 'bg-plex-dark border border-plex-border'
              }`}>
                {data.thumb ? '🎵' : '?'}
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl font-bold">{data.title}</h1>
                <div className="flex flex-wrap items-center gap-2 mt-3">
                  {(data.mb_links ?? []).length > 1 ? (
                    <LinkedChip count={data.mb_links.length} label="MusicBrainz" onClick={() => setMbLinkItem(data)} />
                  ) : data.isMatched || (data.mb_links ?? []).length === 1 ? (
                    <LinkedChip label="MusicBrainz" onClick={() => setMbLinkItem(data)} />
                  ) : (
                    <LinkBtn onClick={() => setMbLinkItem(data)} />
                  )}
                  {(data.discogs_links ?? []).length === 0 ? (
                    <LinkBtn onClick={() => setDiscogsLinkItem(data)} />
                  ) : (
                    <LinkedChip count={data.discogs_links.length} label="Discogs" onClick={() => setDiscogsLinkItem(data)} />
                  )}
                  {(data.lastfm_links ?? []).length === 0 ? (
                    <LinkBtn onClick={() => setLastfmLinkItem(data)} />
                  ) : (
                    <LinkedChip count={data.lastfm_links.length} label="Last.fm" onClick={() => setLastfmLinkItem(data)} />
                  )}
                  <button
                    onClick={() => setMergeItem(data)}
                    title="Merge this artist into another (duplicate Plex entry)"
                    className="text-xs px-2.5 py-1 rounded border border-plex-border text-plex-muted hover:text-red-400 hover:border-red-400/50 transition-colors ml-1"
                  >
                    Merge duplicate
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Service tabs */}
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

          {tab === 'plex' && <PlexTab artist={data} />}
          {tab === 'albums' && (
            <AlbumsTab artist={data} onFix={setFixItem} onDiscogs={setDiscogsItem} />
          )}
          {tab === 'musicbrainz' && <MusicBrainzSection artist={data} onApplied={handleEnrichApplied} />}
          {tab === 'discogs'     && <DiscogsSection     artist={data} onApplied={handleEnrichApplied} />}
          {tab === 'lastfm'      && <LastFMSection      artist={data} onApplied={handleEnrichApplied} />}
          {tab === 'wikidata'    && <WikidataSection    artist={data} onApplied={handleEnrichApplied} />}
        </>
      )}

      {fixItem && (
        <FixMatchModal item={fixItem} type="album"
          onClose={handleAlbumAction} onFixed={handleAlbumAction} />
      )}
      {discogsItem && (
        <AlbumDiscogsModal album={discogsItem}
          onClose={handleAlbumAction} onApplied={handleAlbumAction} />
      )}

      {mbLinkItem      && <MusicBrainzLinkModal artist={mbLinkItem}      onClose={closeMbLink} />}
      {discogsLinkItem && <DiscogsLinkModal     artist={discogsLinkItem} onClose={closeDiscogsLink} />}
      {lastfmLinkItem  && <LastFMLinkModal      artist={lastfmLinkItem}  onClose={closeLastfmLink} />}
      {mergeItem       && <MergeArtistModal     artist={mergeItem}       onClose={() => setMergeItem(null)} />}
    </div>
  )
}
