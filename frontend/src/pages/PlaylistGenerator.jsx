import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useScan } from '../context/ScanContext'

async function fetchTags(library, tag) {
  const res = await fetch(`/api/playlist/tags?library=${encodeURIComponent(library)}&tag=${tag}`)
  if (!res.ok) return []
  return res.json()
}

async function previewPlaylist(library, filters) {
  const res = await fetch(`/api/playlist/preview?library=${encodeURIComponent(library)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(filters),
  })
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || 'Error en preview') }
  return res.json()
}

async function createPlaylist(library, name, filters) {
  const res = await fetch(`/api/playlist/create?library=${encodeURIComponent(library)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, filters }),
  })
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || 'Error creando playlist') }
  return res.json()
}

function GenreChip({ label, selected, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
        selected
          ? 'bg-plex-orange text-plex-dark'
          : 'bg-plex-border text-gray-300 hover:bg-plex-border/80'
      }`}
    >
      {label}
    </button>
  )
}

export default function PlaylistGenerator() {
  const { library } = useScan()

  const [selectedGenres, setSelectedGenres] = useState([])
  const [yearFrom, setYearFrom]     = useState('')
  const [yearTo, setYearTo]         = useState('')
  const [playedOnly, setPlayedOnly] = useState(false)
  const [maxTracks, setMaxTracks]   = useState(50)
  const [shuffle, setShuffle]       = useState(true)
  const [playlistName, setPlaylistName] = useState('')
  const [created, setCreated]       = useState(null)

  const { data: genres = [] } = useQuery({
    queryKey: ['playlist-genres', library],
    queryFn: () => fetchTags(library, 'genre'),
    enabled: !!library,
  })

  const filters = {
    genres:     selectedGenres.length > 0 ? selectedGenres : null,
    yearFrom:   yearFrom ? parseInt(yearFrom) : null,
    yearTo:     yearTo   ? parseInt(yearTo)   : null,
    playedOnly,
    maxTracks,
    shuffle,
  }

  const previewMutation = useMutation({
    mutationFn: () => previewPlaylist(library, filters),
  })

  const createMutation = useMutation({
    mutationFn: () => createPlaylist(library, playlistName, filters),
    onSuccess: (data) => setCreated(data),
  })

  function toggleGenre(genre) {
    setSelectedGenres(prev =>
      prev.includes(genre) ? prev.filter(g => g !== genre) : [...prev, genre]
    )
  }

  if (!library) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-plex-muted">Selecciona una librería primero.</p>
      </div>
    )
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-1">Generador de Playlists</h1>
        <p className="text-plex-muted text-sm">Combiná géneros, años y otros filtros para crear playlists automáticas en Plex.</p>
      </div>

      {/* Genres */}
      <section className="bg-plex-card border border-plex-border rounded-xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-sm">Géneros</h2>
          {selectedGenres.length > 0 && (
            <button onClick={() => setSelectedGenres([])} className="text-xs text-plex-muted hover:text-white underline">
              Limpiar ({selectedGenres.length})
            </button>
          )}
        </div>
        {genres.length === 0 ? (
          <p className="text-plex-muted text-xs">Cargando géneros...</p>
        ) : (
          <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto pr-1">
            {genres.map(g => (
              <GenreChip
                key={g.title}
                label={g.title}
                selected={selectedGenres.includes(g.title)}
                onClick={() => toggleGenre(g.title)}
              />
            ))}
          </div>
        )}
        {selectedGenres.length === 0 && (
          <p className="text-xs text-plex-muted">Sin selección = todos los géneros.</p>
        )}
      </section>

      {/* Filters */}
      <section className="bg-plex-card border border-plex-border rounded-xl p-5 space-y-4">
        <h2 className="font-semibold text-sm">Filtros</h2>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-plex-muted mb-1">Año desde</label>
            <input
              type="number" value={yearFrom} onChange={e => setYearFrom(e.target.value)}
              placeholder="1970"
              className="w-full bg-plex-dark border border-plex-border rounded px-3 py-1.5 text-sm focus:outline-none focus:border-plex-orange"
            />
          </div>
          <div>
            <label className="block text-xs text-plex-muted mb-1">Año hasta</label>
            <input
              type="number" value={yearTo} onChange={e => setYearTo(e.target.value)}
              placeholder="2024"
              className="w-full bg-plex-dark border border-plex-border rounded px-3 py-1.5 text-sm focus:outline-none focus:border-plex-orange"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-plex-muted mb-1">Máx. tracks</label>
            <input
              type="number" value={maxTracks} min={1} max={500}
              onChange={e => setMaxTracks(parseInt(e.target.value) || 50)}
              className="w-full bg-plex-dark border border-plex-border rounded px-3 py-1.5 text-sm focus:outline-none focus:border-plex-orange"
            />
          </div>
          <div className="flex flex-col gap-2 pt-1">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={shuffle} onChange={e => setShuffle(e.target.checked)}
                className="accent-plex-orange" />
              Orden aleatorio
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={playedOnly} onChange={e => setPlayedOnly(e.target.checked)}
                className="accent-plex-orange" />
              Solo escuchados
            </label>
          </div>
        </div>
      </section>

      {/* Preview */}
      <section className="bg-plex-card border border-plex-border rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-sm">Preview</h2>
          <button
            onClick={() => { setCreated(null); previewMutation.mutate() }}
            disabled={previewMutation.isPending}
            className="px-4 py-1.5 bg-plex-dark border border-plex-border rounded text-sm hover:border-plex-orange transition-colors disabled:opacity-50"
          >
            {previewMutation.isPending ? 'Buscando...' : 'Previsualizar'}
          </button>
        </div>

        {previewMutation.isError && (
          <p className="text-red-400 text-sm">{previewMutation.error.message}</p>
        )}

        {previewMutation.data && (
          <div className="space-y-3">
            <p className="text-sm">
              <span className="text-plex-orange font-mono font-bold">{previewMutation.data.total}</span>
              <span className="text-plex-muted ml-1">tracks encontrados</span>
              {previewMutation.data.total > 15 && (
                <span className="text-plex-muted"> · mostrando primeros 15</span>
              )}
            </p>
            <div className="space-y-1">
              {previewMutation.data.sample.map((t, i) => (
                <div key={i} className="flex items-center gap-3 text-sm py-1 border-b border-plex-border/40 last:border-0">
                  <span className="text-plex-muted font-mono text-xs w-5 text-right flex-shrink-0">{i + 1}</span>
                  <div className="min-w-0">
                    <span className="font-medium truncate block">{t.title}</span>
                    <span className="text-xs text-plex-muted truncate block">
                      {t.artist}{t.album ? ` · ${t.album}` : ''}{t.year ? ` · ${t.year}` : ''}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Create */}
      <section className="bg-plex-card border border-plex-border rounded-xl p-5 space-y-4">
        <h2 className="font-semibold text-sm">Crear en Plex</h2>

        <div className="flex gap-3">
          <input
            type="text"
            value={playlistName}
            onChange={e => setPlaylistName(e.target.value)}
            placeholder="Nombre de la playlist, ej: Playlist del Mar 🌊"
            className="flex-1 bg-plex-dark border border-plex-border rounded px-3 py-2 text-sm focus:outline-none focus:border-plex-orange"
          />
          <button
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending || !playlistName.trim()}
            className="px-4 py-2 bg-plex-orange text-plex-dark font-semibold rounded text-sm hover:opacity-90 disabled:opacity-50 transition-opacity flex-shrink-0"
          >
            {createMutation.isPending ? 'Creando...' : 'Crear playlist'}
          </button>
        </div>

        {createMutation.isError && (
          <p className="text-red-400 text-sm">{createMutation.error.message}</p>
        )}

        {created && (
          <div className="rounded-lg bg-green-900/20 border border-green-700 p-4">
            <p className="text-green-400 font-semibold text-sm">Playlist creada en Plex</p>
            <p className="text-green-300 text-xs mt-0.5">
              "{created.name}" · {created.trackCount} tracks
            </p>
          </div>
        )}
      </section>
    </div>
  )
}
