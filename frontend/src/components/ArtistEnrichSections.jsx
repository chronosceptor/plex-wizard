import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

// ── API helpers ────────────────────────────────────────────────────────────

async function fetchMBData(ratingKey) {
  const res = await fetch(`/api/artist/${ratingKey}/mb-data`)
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || 'Error MB') }
  return res.json()
}

async function applyMB(ratingKey, payload) {
  const res = await fetch(`/api/artist/${ratingKey}/apply-mb`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ country: payload.country ?? null, genres: payload.genres ?? null }),
  })
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || 'Error aplicando') }
  return res.json()
}

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

async function applyDiscogs(ratingKey, payload) {
  const res = await fetch(`/api/artist/${ratingKey}/apply-discogs`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ genres: payload.genres ?? null, styles: payload.styles ?? null, bio: payload.bio ?? null }),
  })
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || 'Error aplicando') }
  return res.json()
}

async function fetchWikidata(ratingKey) {
  const res = await fetch(`/api/artist/${ratingKey}/wikidata-data`)
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || 'Error consultando Wikidata') }
  return res.json()
}

async function applyCountry(ratingKey, country) {
  const res = await fetch(`/api/artist/${ratingKey}/apply-mb`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ country }),
  })
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || 'Error aplicando país') }
  return res.json()
}

// ── Shared sub-components ───────────────────────────────────────────────────

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

function SourceSection({ title, link, children }) {
  return (
    <div className="bg-plex-card border border-plex-border rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-sm text-plex-muted uppercase tracking-wide">{title}</h2>
        {link && (
          <a href={link} target="_blank" rel="noopener noreferrer" className="text-xs text-plex-orange hover:underline">
            Ver en {title} ↗
          </a>
        )}
      </div>
      {children}
    </div>
  )
}

// ── MusicBrainz section ──────────────────────────────────────────────────────

function MusicBrainzSection({ artist, onApplied }) {
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
          <p className="text-plex-muted text-sm">Este artista no tiene MBID todavía.</p>
          <p className="text-xs text-plex-muted">Usa "Fix Match" para conectarlo con MusicBrainz primero.</p>
        </div>
      )}

      {mbid && isLoading && <p className="text-plex-muted text-sm animate-pulse">Consultando MusicBrainz...</p>}
      {mbid && error && <p className="text-red-400 text-sm">{error.message}</p>}

      {mb && (
        <div className="space-y-4">
          {(mb.type || mb.founded) && (
            <div className="flex items-center gap-4 text-xs text-plex-muted">
              {mb.type    && <span>{mb.type}</span>}
              {mb.founded && <span>Fundado {mb.founded}{mb.foundedIn ? ` · ${mb.foundedIn}` : ''}</span>}
            </div>
          )}

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
      )}
    </SourceSection>
  )
}

// ── Last.fm section ──────────────────────────────────────────────────────────

function LastFMSection({ artist, onApplied }) {
  const [applied, setApplied] = useState({ styles: false, moods: false, bio: false, similar: false })

  const { data, isLoading, error } = useQuery({
    queryKey: ['lastfm', artist.ratingKey],
    queryFn: () => fetchLastFM(artist.ratingKey),
    retry: false,
  })

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
      {isLoading && <p className="text-plex-muted text-sm animate-pulse">Consultando Last.fm...</p>}
      {error     && <p className="text-red-400 text-sm">{error.message}</p>}

      {data && (
        <div className="space-y-4">
          {(data.listeners > 0 || data.playcount > 0) && (
            <div className="flex gap-4 text-xs text-plex-muted">
              {data.listeners > 0 && <span><span className="text-white font-mono">{data.listeners.toLocaleString()}</span> listeners</span>}
              {data.playcount > 0 && <span><span className="text-white font-mono">{data.playcount.toLocaleString()}</span> scrobbles</span>}
            </div>
          )}

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
      )}
    </SourceSection>
  )
}

// ── Discogs section ──────────────────────────────────────────────────────────

function DiscogsSection({ artist, onApplied }) {
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
    onSuccess: (_, vars) => {
      setApplied(prev => ({ ...prev, bio: prev.bio || !!vars.bio }))
      onApplied?.()
    },
  })

  const candidates = searchQ.data?.candidates ?? []
  const selected = candidates.find(c => c.id === selectedId)

  return (
    <SourceSection title="Discogs" link={selected ? `https://www.discogs.com${selected.url}` : null}>
      {searchQ.isLoading && <p className="text-plex-muted text-sm animate-pulse">Buscando en Discogs...</p>}
      {searchQ.error     && <p className="text-red-400 text-sm">{searchQ.error.message}</p>}

      {!searchQ.isLoading && !searchQ.error && (
        <div className="space-y-4">
          {candidates.length === 0 && <p className="text-plex-muted text-sm">No se encontró en Discogs</p>}

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
                      Ver en Discogs ↗
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}

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
                  <p className="text-xs text-plex-muted">Los géneros/estilos se obtienen por release. Usa el botón "Discogs" en la tabla de albums para aplicarlos.</p>
                </>
              )}
            </div>
          )}

          {mutation.isError && <p className="text-red-400 text-sm">{mutation.error.message}</p>}
        </div>
      )}
    </SourceSection>
  )
}

// ── Wikidata section ─────────────────────────────────────────────────────────

function WikidataSection({ artist, onApplied }) {
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
      {isLoading && <p className="text-plex-muted text-sm animate-pulse">Consultando Wikidata...</p>}
      {error     && <p className="text-red-400 text-sm">{error.message}</p>}

      {data && (
        <div className="space-y-4">
          {data.wikipediaUrl && (
            <a href={data.wikipediaUrl} target="_blank" rel="noopener noreferrer"
               className="text-xs text-plex-orange hover:underline">
              Ver en Wikipedia ↗
            </a>
          )}

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
      )}
    </SourceSection>
  )
}

// ── Main export ──────────────────────────────────────────────────────────────

export default function ArtistEnrichSections({ artist, onApplied }) {
  return (
    <div className="space-y-4">
      <h2 className="font-semibold text-sm text-plex-muted uppercase tracking-wide">Enrich</h2>
      <MusicBrainzSection artist={artist} onApplied={onApplied} />
      <LastFMSection      artist={artist} onApplied={onApplied} />
      <DiscogsSection     artist={artist} onApplied={onApplied} />
      <WikidataSection    artist={artist} onApplied={onApplied} />
    </div>
  )
}
