import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'

// ── API helpers ────────────────────────────────────────────────────────────

async function fetchLastFM(ratingKey) {
  const res = await fetch(`/api/artist/${ratingKey}/lastfm-data`)
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || 'Error Last.fm') }
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
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || 'Error aplicando') }
  return res.json()
}

async function fetchDiscogsSearch(ratingKey) {
  const res = await fetch(`/api/artist/${ratingKey}/discogs-search`)
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || 'Error Discogs') }
  return res.json()
}

async function fetchDiscogsArtist(discogsId) {
  const res = await fetch(`/api/discogs/artist/${discogsId}`)
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || 'Error Discogs') }
  return res.json()
}

async function applyDiscogs(ratingKey, { genres, styles, bio }) {
  const res = await fetch(`/api/artist/${ratingKey}/apply-discogs`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ genres: genres ?? null, styles: styles ?? null, bio: bio ?? null }),
  })
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || 'Error aplicando') }
  return res.json()
}

// ── Sub-components ──────────────────────────────────────────────────────────

function TagChip({ children, color = 'gray' }) {
  const cls = {
    gray:   'bg-plex-border text-gray-300',
    orange: 'bg-plex-orange/20 text-plex-orange border border-plex-orange/40',
    green:  'bg-green-900/30 text-green-300 border border-green-700',
  }[color]
  return <span className={`inline-block rounded px-2 py-0.5 text-xs ${cls}`}>{children}</span>
}

function ApplyBtn({ onClick, disabled, applied, label = 'Aplicar' }) {
  return (
    <button
      onClick={onClick} disabled={disabled || applied}
      className={`flex-shrink-0 px-3 py-1.5 rounded text-xs font-semibold transition-colors ${
        applied ? 'bg-green-600 text-white' : 'bg-plex-orange text-plex-dark hover:opacity-90 disabled:opacity-50'
      }`}
    >
      {applied ? 'Aplicado ✓' : label}
    </button>
  )
}

// ── Last.fm tab ─────────────────────────────────────────────────────────────

function LastFMTab({ artist }) {
  const [applied, setApplied] = useState({ styles: false, moods: false, bio: false, similar: false })

  const { data, isLoading, error } = useQuery({
    queryKey: ['lastfm', artist.ratingKey],
    queryFn: () => fetchLastFM(artist.ratingKey),
    retry: false,
  })

  const mutation = useMutation({
    mutationFn: (payload) => applyLastFM(artist.ratingKey, payload),
    onSuccess: (_, vars) => setApplied(prev => ({
      styles:  prev.styles  || !!vars.styles,
      moods:   prev.moods   || !!vars.moods,
      bio:     prev.bio     || !!vars.bio,
      similar: prev.similar || !!vars.similar,
    })),
  })

  if (isLoading) return <p className="text-plex-muted text-sm animate-pulse">Consultando Last.fm...</p>
  if (error)     return <p className="text-red-400 text-sm">{error.message}</p>
  if (!data)     return null

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="flex gap-4 text-xs text-plex-muted">
        {data.listeners > 0 && <span><span className="text-white font-mono">{data.listeners.toLocaleString()}</span> listeners</span>}
        {data.playcount > 0 && <span><span className="text-white font-mono">{data.playcount.toLocaleString()}</span> scrobbles</span>}
        {data.url && <a href={data.url} target="_blank" rel="noopener noreferrer" className="text-plex-orange hover:underline">Ver en Last.fm ↗</a>}
      </div>

      {/* Tags — apply as styles or moods */}
      {data.tags.length > 0 && (
        <div className="rounded-lg border border-plex-border p-4 space-y-3">
          <div>
            <p className="text-xs text-plex-muted mb-2">Tags <span className="text-plex-muted/60">(se mergeán con los existentes)</span></p>
            <div className="flex flex-wrap gap-1.5">
              {data.tags.map(t => <TagChip key={t}>{t}</TagChip>)}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <ApplyBtn applied={applied.styles} disabled={mutation.isPending}
              label="→ Styles" onClick={() => mutation.mutate({ styles: data.tags })} />
            <ApplyBtn applied={applied.moods} disabled={mutation.isPending}
              label="→ Moods" onClick={() => mutation.mutate({ moods: data.tags })} />
          </div>
        </div>
      )}

      {/* Bio */}
      {data.bio && (
        <div className="rounded-lg border border-plex-border p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-plex-muted mb-2">Bio</p>
              <p className="text-sm text-gray-300 line-clamp-4">{data.bio}</p>
            </div>
            <ApplyBtn applied={applied.bio} disabled={mutation.isPending}
              label="Aplicar bio" onClick={() => mutation.mutate({ bio: data.bio })} />
          </div>
        </div>
      )}

      {/* Similar artists */}
      {data.similar.length > 0 && (
        <div className="rounded-lg border border-plex-border p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <p className="text-xs text-plex-muted mb-2">Artistas similares</p>
              <div className="flex flex-wrap gap-1.5">
                {data.similar.map(s => <TagChip key={s}>{s}</TagChip>)}
              </div>
            </div>
            <ApplyBtn applied={applied.similar} disabled={mutation.isPending}
              label="Aplicar similares" onClick={() => mutation.mutate({ similar: data.similar })} />
          </div>
        </div>
      )}

      {/* Apply all */}
      {data.tags.length > 0 && data.bio && (
        <button
          onClick={() => mutation.mutate({ styles: data.tags, moods: data.tags, bio: data.bio, similar: data.similar })}
          disabled={mutation.isPending}
          className="w-full bg-plex-orange text-plex-dark font-semibold py-2 rounded text-sm hover:opacity-90 disabled:opacity-50"
        >
          Aplicar todo
        </button>
      )}

      {mutation.isError && <p className="text-red-400 text-sm">{mutation.error.message}</p>}
    </div>
  )
}

// ── Discogs tab ──────────────────────────────────────────────────────────────

function DiscogsTab({ artist }) {
  const [selectedId, setSelectedId] = useState(null)
  const [applied, setApplied] = useState({ bio: false })

  const searchQ = useQuery({
    queryKey: ['discogs-search', artist.ratingKey],
    queryFn: () => fetchDiscogsSearch(artist.ratingKey),
    retry: false,
  })

  const detailQ = useQuery({
    queryKey: ['discogs-artist', selectedId],
    queryFn: () => fetchDiscogsArtist(selectedId),
    enabled: !!selectedId,
    retry: false,
  })

  const mutation = useMutation({
    mutationFn: (payload) => applyDiscogs(artist.ratingKey, payload),
    onSuccess: (_, vars) => setApplied(prev => ({
      ...prev,
      bio: prev.bio || !!vars.bio,
    })),
  })

  if (searchQ.isLoading) return <p className="text-plex-muted text-sm animate-pulse">Buscando en Discogs...</p>
  if (searchQ.error)     return <p className="text-red-400 text-sm">{searchQ.error.message}</p>

  const candidates = searchQ.data?.candidates ?? []

  return (
    <div className="space-y-4">
      {candidates.length === 0 && <p className="text-plex-muted text-sm">No se encontró en Discogs</p>}

      {/* Candidate list */}
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
                Ver en Discogs ↗
              </a>
            </div>
          </div>
        ))}
      </div>

      {/* Artist detail */}
      {selectedId && (
        <div className="border-t border-plex-border pt-4 space-y-3">
          {detailQ.isLoading && <p className="text-plex-muted text-sm animate-pulse">Cargando datos...</p>}
          {detailQ.error && <p className="text-red-400 text-sm">{detailQ.error.message}</p>}
          {detailQ.data && (
            <>
              {detailQ.data.profile ? (
                <div className="rounded-lg border border-plex-border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-plex-muted mb-1">Bio</p>
                      <p className="text-sm text-gray-300 line-clamp-4">{detailQ.data.profile}</p>
                    </div>
                    <ApplyBtn
                      applied={applied.bio}
                      disabled={mutation.isPending}
                      label="Aplicar bio"
                      onClick={() => mutation.mutate({ bio: detailQ.data.profile })}
                    />
                  </div>
                </div>
              ) : (
                <p className="text-xs text-plex-muted">Sin bio en Discogs</p>
              )}
              <p className="text-xs text-plex-muted">Los géneros/estilos se obtienen por release. Usa "Albums sin match" para aplicarlos a álbumes específicos.</p>
            </>
          )}
        </div>
      )}

      {mutation.isError && <p className="text-red-400 text-sm">{mutation.error.message}</p>}
    </div>
  )
}

// ── Wikidata tab ─────────────────────────────────────────────────────────────

async function fetchWikidata(ratingKey) {
  const res = await fetch(`/api/artist/${ratingKey}/wikidata-data`)
  if (!res.ok) {
    const e = await res.json().catch(() => ({}))
    throw new Error(e.detail || 'Error consultando Wikidata')
  }
  return res.json()
}

async function applyCountry(ratingKey, country) {
  const res = await fetch(`/api/artist/${ratingKey}/apply-mb`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ country }),
  })
  if (!res.ok) {
    const e = await res.json().catch(() => ({}))
    throw new Error(e.detail || 'Error aplicando país')
  }
  return res.json()
}

function WikidataTab({ artist }) {
  const [applied, setApplied] = useState(false)

  const { data, isLoading, error } = useQuery({
    queryKey: ['wikidata', artist.ratingKey],
    queryFn: () => fetchWikidata(artist.ratingKey),
    retry: false,
  })

  const mutation = useMutation({
    mutationFn: (country) => applyCountry(artist.ratingKey, country),
    onSuccess: () => setApplied(true),
  })

  if (isLoading) return <p className="text-plex-muted text-sm animate-pulse">Consultando Wikidata...</p>
  if (error)     return <p className="text-red-400 text-sm">{error.message}</p>
  if (!data)     return null

  return (
    <div className="space-y-4">
      {/* Links */}
      <div className="flex gap-4 text-xs">
        {data.wikidataUrl && (
          <a href={data.wikidataUrl} target="_blank" rel="noopener noreferrer"
             className="text-plex-orange hover:underline">
            Ver en Wikidata ↗
          </a>
        )}
        {data.wikipediaUrl && (
          <a href={data.wikipediaUrl} target="_blank" rel="noopener noreferrer"
             className="text-plex-orange hover:underline">
            Ver en Wikipedia ↗
          </a>
        )}
      </div>

      {/* Country */}
      <div className="rounded-lg border border-plex-border p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs text-plex-muted mb-1">País de origen</p>
            {data.country ? (
              <p className="font-medium text-sm">
                {data.country}
                {data.countryCode && (
                  <span className="ml-2 text-xs text-plex-muted font-mono">{data.countryCode}</span>
                )}
              </p>
            ) : (
              <p className="text-plex-muted text-sm">No disponible en Wikidata</p>
            )}
          </div>
          {data.country && (
            <ApplyBtn
              applied={applied}
              disabled={mutation.isPending}
              label="Aplicar país"
              onClick={() => mutation.mutate(data.country)}
            />
          )}
        </div>
      </div>

      {mutation.isError && <p className="text-red-400 text-sm">{mutation.error.message}</p>}
    </div>
  )
}

// ── MusicBrainz tab ──────────────────────────────────────────────────────────

async function fetchMBData(ratingKey) {
  const res = await fetch(`/api/artist/${ratingKey}/mb-data`)
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || 'Error MB') }
  return res.json()
}

async function applyMB(ratingKey, { country, genres }) {
  const res = await fetch(`/api/artist/${ratingKey}/apply-mb`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ country: country ?? null, genres: genres ?? null }),
  })
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || 'Error aplicando') }
  return res.json()
}

function MBTab({ artist }) {
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
    onSuccess: (_, vars) => setApplied(prev => ({
      country: prev.country || !!vars.country,
      genres:  prev.genres  || !!vars.genres,
    })),
  })

  if (!mbid) return (
    <div className="py-8 text-center space-y-2">
      <p className="text-plex-muted text-sm">Este artista no tiene MBID todavía.</p>
      <p className="text-xs text-plex-muted">Usa "Auto" o "Manual" para conectarlo con MusicBrainz primero.</p>
    </div>
  )

  if (isLoading) return <p className="text-plex-muted text-sm animate-pulse">Consultando MusicBrainz...</p>
  if (error)     return <p className="text-red-400 text-sm">{error.message}</p>
  if (!mb)       return null

  return (
    <div className="space-y-4">
      {/* Meta + link */}
      <div className="flex items-center gap-4 text-xs text-plex-muted">
        {mb.type    && <span>{mb.type}</span>}
        {mb.founded && <span>Fundado {mb.founded}{mb.foundedIn ? ` · ${mb.foundedIn}` : ''}</span>}
        {mbUrl && <a href={mbUrl} target="_blank" rel="noopener noreferrer" className="text-plex-orange hover:underline ml-auto">Ver en MB ↗</a>}
      </div>

      {/* Country */}
      <div className="rounded-lg border border-plex-border p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs text-plex-muted mb-1">País</p>
            {mb.country
              ? <p className="font-medium text-sm">{mb.country}</p>
              : <p className="text-plex-muted text-sm">No disponible en MB</p>}
          </div>
          {mb.country && (
            <ApplyBtn applied={applied.country} disabled={mutation.isPending}
              label="Aplicar país" onClick={() => mutation.mutate({ country: mb.country })} />
          )}
        </div>
      </div>

      {/* Genres */}
      {mb.genres?.length > 0 && (() => {
        const chosen = selectedGenre ?? mb.genres[0].name
        return (
          <div className="rounded-lg border border-plex-border p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <p className="text-xs text-plex-muted mb-2">
                  Géneros <span className="text-plex-muted/60">— selecciona el que quieres aplicar</span>
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {mb.genres.slice(0, 10).map(g => {
                    const isSelected = g.name === chosen
                    return (
                      <button
                        key={g.name}
                        onClick={() => setSelectedGenre(g.name)}
                        className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-plex-orange/20 text-plex-orange border border-plex-orange/60 ring-1 ring-plex-orange/40'
                            : 'bg-plex-border text-gray-300 hover:border-plex-orange/40 border border-transparent'
                        }`}
                      >
                        {g.name}
                        <span className={`text-[10px] ${isSelected ? 'opacity-70' : 'opacity-40'}`}>{g.count}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
              <ApplyBtn applied={applied.genres} disabled={mutation.isPending}
                label="Aplicar género"
                onClick={() => mutation.mutate({ genres: [chosen] })} />
            </div>
          </div>
        )
      })()}

      {mb.country && mb.genres?.length > 0 && (
        <button
          onClick={() => mutation.mutate({ country: mb.country, genres: [selectedGenre ?? mb.genres[0].name] })}
          disabled={mutation.isPending || (applied.country && applied.genres)}
          className="w-full bg-plex-orange text-plex-dark font-semibold py-2 rounded text-sm hover:opacity-90 disabled:opacity-50"
        >
          {applied.country && applied.genres ? 'Todo aplicado ✓' : 'Aplicar todo'}
        </button>
      )}

      {mutation.isError && <p className="text-red-400 text-sm">{mutation.error.message}</p>}
    </div>
  )
}

// ── Main modal ───────────────────────────────────────────────────────────────

const TABS = [
  { id: 'mb',       label: 'MusicBrainz' },
  { id: 'lastfm',   label: 'Last.fm' },
  { id: 'discogs',  label: 'Discogs' },
  { id: 'wikidata', label: 'Wikidata' },
]

export default function EnrichModal({ artist, onClose }) {
  const [tab, setTab] = useState('mb')

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-plex-card border border-plex-border rounded-xl w-full max-w-lg mx-4 shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-plex-border">
          <div>
            <p className="text-xs text-plex-muted mb-0.5">Enrich metadata</p>
            <h2 className="font-bold text-lg">{artist.title}</h2>
          </div>
          <button onClick={onClose} className="text-plex-muted hover:text-white ml-4 text-xl leading-none">×</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-plex-border px-5">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2.5 text-sm font-medium transition-colors ${
                tab === t.id
                  ? 'text-plex-orange border-b-2 border-plex-orange'
                  : 'text-plex-muted hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-5 max-h-[60vh] overflow-y-auto">
          {tab === 'mb'       && <MBTab       artist={artist} />}
          {tab === 'lastfm'   && <LastFMTab   artist={artist} />}
          {tab === 'discogs'  && <DiscogsTab  artist={artist} />}
          {tab === 'wikidata' && <WikidataTab artist={artist} />}
        </div>
      </div>
    </div>
  )
}
