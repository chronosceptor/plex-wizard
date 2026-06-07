import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import FixMatchModal from '../components/FixMatchModal'
import AlbumDiscogsModal from '../components/AlbumDiscogsModal'
import ArtistEnrichSections from '../components/ArtistEnrichSections'

function Dot({ ok, title, count }) {
  return (
    <div className="flex flex-col items-center gap-0.5" title={title}>
      <span className={`inline-block w-2.5 h-2.5 rounded-full ${ok ? 'bg-green-400' : 'bg-red-500'}`} />
      {count != null && (
        <span className={`text-[9px] font-mono leading-none ${ok ? 'text-green-400' : 'text-red-500/60'}`}>
          {count}
        </span>
      )}
    </div>
  )
}

export default function ArtistDetail() {
  const { ratingKey } = useParams()
  const navigate      = useNavigate()
  const queryClient   = useQueryClient()

  const [fixItem,     setFixItem]     = useState(null)
  const [discogsItem, setDiscogsItem] = useState(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['artist-albums', ratingKey],
    queryFn: async () => {
      const res = await fetch(`/api/artist/${ratingKey}/albums`)
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || 'Error') }
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

  const albums = data?.albums ?? []

  return (
    <div className="space-y-6 max-w-5xl">
      <button onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-sm text-plex-muted hover:text-white transition-colors">
        ← Volver
      </button>

      {isLoading && (
        <div className="flex items-center justify-center h-48">
          <p className="text-plex-muted animate-pulse">Cargando artista...</p>
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
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-plex-muted">
                  {[
                    { ok: data.isMatched, text: data.isMatched ? 'Matcheado' : 'Sin match' },
                    { ok: !!data.country, text: data.country || 'Sin país' },
                    { ok: data.genres?.length > 0, text: data.genres?.length > 0 ? `${data.genres.length} géneros` : 'Sin géneros' },
                    { ok: data.moods?.length > 0,  text: data.moods?.length  > 0 ? `${data.moods.length} moods`    : 'Sin moods' },
                    { ok: data.thumb,   text: data.thumb  ? 'Foto'   : 'Sin foto' },
                    { ok: data.hasBio,  text: data.hasBio ? 'Bio'    : 'Sin bio' },
                  ].map(({ ok, text }) => (
                    <span key={text} className="flex items-center gap-1.5">
                      <span className={`inline-block w-2 h-2 rounded-full ${ok ? 'bg-green-400' : 'bg-red-500'}`} />
                      {text}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Enrich sections — MusicBrainz / Last.fm / Discogs / Wikidata */}
          <ArtistEnrichSections artist={data} onApplied={handleEnrichApplied} />

          {/* Albums data table */}
          <div>
            <h2 className="font-semibold text-sm mb-3 text-plex-muted uppercase tracking-wide">
              Albums ({albums.length})
            </h2>

            {albums.length === 0 && <p className="text-plex-muted text-sm">No hay albums.</p>}

            {albums.length > 0 && (
              <div className="bg-plex-card border border-plex-border rounded-xl overflow-hidden">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-plex-border bg-plex-dark/40">
                      <th className="text-xs text-plex-muted font-normal text-right w-12 px-4 py-2">Año</th>
                      <th className="text-xs text-plex-muted font-normal text-left px-2 py-2">Album</th>
                      <th className="text-xs text-plex-muted font-normal text-center w-14 py-2" title="Matcheado con MusicBrainz">Match</th>
                      <th className="text-xs text-plex-muted font-normal text-center w-16 py-2" title="Artwork del album">Portada</th>
                      <th className="text-xs text-plex-muted font-normal text-center w-16 py-2" title="Géneros (cantidad)">Géneros</th>
                      <th className="text-xs text-plex-muted font-normal text-center w-14 py-2" title="Moods (cantidad)">Mood</th>
                      <th className="py-2 px-4 w-40"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {albums.map(album => (
                      <tr key={album.ratingKey} className="border-b border-plex-border/40 last:border-0 hover:bg-plex-dark/30 transition-colors">
                        <td className="text-right px-4 py-2.5 text-plex-muted font-mono text-xs w-12">
                          {album.year || '—'}
                        </td>
                        <td className="px-2 py-2.5">
                          <p className="text-sm font-medium">{album.title}</p>
                          {album.trackCount > 0 && (
                            <p className="text-xs text-plex-muted">{album.trackCount} tracks</p>
                          )}
                        </td>
                        <td className="text-center py-2.5">
                          <div className="flex justify-center">
                            <Dot ok={album.isMatched} title={album.isMatched ? 'Matcheado con MB' : 'Sin match'} />
                          </div>
                        </td>
                        <td className="text-center py-2.5">
                          <div className="flex justify-center">
                            <Dot ok={album.thumb} title={album.thumb ? 'Tiene portada' : 'Sin portada'} />
                          </div>
                        </td>
                        <td className="text-center py-2.5">
                          <div className="flex justify-center">
                            <Dot ok={album.genres?.length > 0}
                              title={album.genres?.join(', ') || 'Sin géneros'}
                              count={album.genres?.length || 0} />
                          </div>
                        </td>
                        <td className="text-center py-2.5">
                          <div className="flex justify-center">
                            <Dot ok={album.moods?.length > 0}
                              title={album.moods?.join(', ') || 'Sin moods'}
                              count={album.moods?.length || 0} />
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex gap-1.5 justify-end">
                            <button
                              onClick={() => setFixItem({ ...album, artist: data.title })}
                              className={`text-xs px-2.5 py-1 rounded border transition-colors font-medium ${
                                album.isMatched
                                  ? 'border-plex-border text-plex-muted hover:text-white hover:border-white'
                                  : 'bg-plex-orange/20 text-plex-orange border-plex-orange/40 hover:bg-plex-orange hover:text-plex-dark'
                              }`}
                            >
                              {album.isMatched ? 'Re-match' : 'Fix Match'}
                            </button>
                            <button
                              onClick={() => setDiscogsItem({ ...album, artist: data.title })}
                              className="text-xs px-2.5 py-1 rounded border border-plex-border text-plex-muted hover:text-white hover:border-white transition-colors"
                            >
                              Discogs
                            </button>
                            {album.mbid && (
                              <a href={`https://musicbrainz.org/release/${album.mbid}`}
                                target="_blank" rel="noopener noreferrer"
                                className="text-xs px-2.5 py-1 rounded border border-plex-border text-plex-orange hover:border-plex-orange transition-colors">
                                MB ↗
                              </a>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
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
    </div>
  )
}
