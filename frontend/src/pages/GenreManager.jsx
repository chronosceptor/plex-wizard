import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useScan } from '../context/ScanContext'

async function fetchGenres(library) {
  const res = await fetch(`/api/genres?library=${encodeURIComponent(library)}`)
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || 'Error') }
  return res.json()
}

async function reassignGenre(payload) {
  const res = await fetch('/api/genres/reassign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || 'Error') }
  return res.json()
}

export default function GenreManager() {
  const { library } = useScan()
  const queryClient = useQueryClient()

  const [selectedGenre, setSelectedGenre] = useState(null)
  const [checked, setChecked] = useState(new Set())
  const [targetGenre, setTargetGenre] = useState('')
  const [lastMoved, setLastMoved] = useState(null)

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['genres', library],
    queryFn: () => fetchGenres(library),
    enabled: !!library,
  })

  const mutation = useMutation({
    mutationFn: reassignGenre,
    onSuccess: (result, variables) => {
      setLastMoved({ count: result.updated, to: variables.new_genre })
      setChecked(new Set())
      setTargetGenre('')
      // Plex needs a moment to index the change before we refetch
      setTimeout(() => queryClient.invalidateQueries({ queryKey: ['genres', library] }), 1200)
      if (result.errors?.length) {
        console.warn('Errores al reasignar:', result.errors)
      }
    },
  })

  if (isLoading) return <p className="text-plex-muted text-sm animate-pulse">Cargando géneros desde Plex...</p>
  if (error) return <p className="text-red-400 text-sm">{error.message}</p>

  const genres = data?.genres ?? []
  const noGenreCount = data?.noGenre ?? 0
  const selectedData = genres.find(g => g.name === selectedGenre)
  const artists = selectedData?.artists ?? []
  const allChecked = artists.length > 0 && checked.size === artists.length

  function selectGenre(name) {
    setSelectedGenre(name)
    setChecked(new Set())
    setTargetGenre('')
    setLastMoved(null)
  }

  function toggleArtist(rk) {
    setChecked(prev => {
      const next = new Set(prev)
      next.has(rk) ? next.delete(rk) : next.add(rk)
      return next
    })
  }

  function toggleAll() {
    setChecked(allChecked ? new Set() : new Set(artists.map(a => a.ratingKey)))
  }

  function handleReassign() {
    if (!targetGenre.trim() || checked.size === 0 || mutation.isPending) return
    setLastMoved(null)
    mutation.mutate({
      rating_keys: [...checked],
      old_genre: selectedGenre,
      new_genre: targetGenre.trim(),
    })
  }

  const totalArtists = genres.reduce((s, g) => s + g.count, 0)

  return (
    <div className="flex gap-6 h-full min-h-0" style={{ height: 'calc(100vh - 48px)' }}>

      {/* ── Genre list ──────────────────────────────────────────────────── */}
      <div className="w-64 flex-shrink-0 flex flex-col min-h-0">
        <div className="mb-3 flex items-start justify-between">
          <div>
            <h2 className="font-bold text-lg">Géneros</h2>
            <p className="text-xs text-plex-muted mt-0.5">
              {genres.length} géneros · {totalArtists} artistas
              {noGenreCount > 0 && <span className="text-amber-400"> · {noGenreCount} sin género</span>}
            </p>
          </div>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            title="Actualizar géneros desde Plex"
            className="text-xs text-plex-muted hover:text-white border border-plex-border rounded px-2 py-1 disabled:opacity-40 transition-colors flex-shrink-0 mt-0.5"
          >
            {isFetching ? '...' : '↻'}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-0.5 pr-1">
          {genres.map(g => {
            const isActive = selectedGenre === g.name
            const isSmall = g.count <= 3
            return (
              <button
                key={g.name}
                onClick={() => selectGenre(g.name)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded text-sm transition-colors text-left ${
                  isActive
                    ? 'bg-plex-orange text-plex-dark font-semibold'
                    : 'text-gray-300 hover:bg-plex-border'
                }`}
              >
                <span className="truncate">{g.name}</span>
                <span className={`ml-2 flex-shrink-0 text-xs font-mono px-1.5 py-0.5 rounded ${
                  isActive
                    ? 'bg-black/20 text-plex-dark'
                    : isSmall
                    ? 'bg-amber-900/40 text-amber-400'
                    : 'bg-plex-border text-plex-muted'
                }`}>
                  {g.count}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Artist panel ────────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 flex flex-col min-h-0">
        {!selectedGenre ? (
          <div className="flex items-center justify-center h-full text-plex-muted text-sm">
            Selecciona un género para ver sus artistas
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center gap-3 mb-3 flex-shrink-0">
              <h3 className="font-semibold text-lg">{selectedGenre}</h3>
              <span className="text-plex-muted text-sm">{artists.length} artistas</span>
              {checked.size > 0 && (
                <span className="text-plex-orange text-sm font-medium">{checked.size} seleccionados</span>
              )}
            </div>

            {/* Success message */}
            {lastMoved && (
              <div className="flex items-center gap-2 mb-3 p-2.5 rounded-lg border border-green-500/30 bg-green-500/10 flex-shrink-0">
                <span className="text-green-400 text-sm">
                  ✓ {lastMoved.count} artista{lastMoved.count !== 1 ? 's' : ''} movido{lastMoved.count !== 1 ? 's' : ''} a <strong>{lastMoved.to}</strong>
                </span>
                <span className="text-xs text-plex-muted ml-auto">Actualizando lista...</span>
              </div>
            )}

            {/* Reassign bar */}
            {checked.size > 0 && (
              <div className="flex items-center gap-2 mb-3 p-3 rounded-lg border border-plex-orange/40 bg-plex-orange/5 flex-shrink-0">
                <span className="text-sm text-plex-muted flex-shrink-0">Mover a:</span>
                <input
                  type="text"
                  list="genre-targets"
                  placeholder="Género destino..."
                  value={targetGenre}
                  onChange={e => setTargetGenre(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleReassign()}
                  className="flex-1 bg-plex-dark border border-plex-border rounded px-2 py-1.5 text-sm focus:outline-none focus:border-plex-orange"
                />
                <datalist id="genre-targets">
                  {genres.filter(g => g.name !== selectedGenre).map(g => (
                    <option key={g.name} value={g.name} />
                  ))}
                </datalist>
                <button
                  onClick={handleReassign}
                  disabled={!targetGenre.trim() || mutation.isPending}
                  className="px-4 py-1.5 bg-plex-orange text-plex-dark font-semibold text-sm rounded hover:opacity-90 disabled:opacity-50 flex-shrink-0"
                >
                  {mutation.isPending ? 'Moviendo...' : 'Mover'}
                </button>
              </div>
            )}

            {mutation.isError && (
              <p className="text-red-400 text-sm mb-2 flex-shrink-0">{mutation.error.message}</p>
            )}

            {/* Artist list */}
            <div className="flex-1 overflow-y-auto border border-plex-border rounded-lg">
              <div className="flex items-center gap-3 px-4 py-2.5 border-b border-plex-border bg-plex-card sticky top-0">
                <input
                  type="checkbox"
                  checked={allChecked}
                  onChange={toggleAll}
                  className="accent-plex-orange w-4 h-4"
                />
                <span className="text-xs text-plex-muted">Seleccionar todos</span>
              </div>
              {artists.map(a => (
                <label
                  key={a.ratingKey}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-plex-border cursor-pointer border-b border-plex-border/50 last:border-0"
                >
                  <input
                    type="checkbox"
                    checked={checked.has(a.ratingKey)}
                    onChange={() => toggleArtist(a.ratingKey)}
                    className="accent-plex-orange w-4 h-4 flex-shrink-0"
                  />
                  <span className="text-sm">{a.title}</span>
                </label>
              ))}
            </div>
          </>
        )}
      </div>

    </div>
  )
}
