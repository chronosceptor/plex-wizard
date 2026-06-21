import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { LinkedChip, LinkBtn } from '../pages/Artists'

function Dot({ ok, title }) {
  return (
    <span
      title={title}
      className={`inline-block w-2.5 h-2.5 rounded-full ${ok ? 'bg-green-400' : 'bg-red-500'}`}
    />
  )
}

// Shared by the top-level Albums page and the per-artist Albums tab — same
// table everywhere, so improving one improves both. `showArtist` hides the
// artist subtitle when the table is already scoped to a single artist.
export default function AlbumsTable({ albums, showArtist = true, onFix, onDiscogs }) {
  const navigate = useNavigate()

  const { data: plexInfo } = useQuery({
    queryKey: ['plex-info'],
    queryFn: async () => {
      const res = await fetch('/api/plex-info')
      if (!res.ok) throw new Error('plex-info failed')
      return res.json()
    },
    staleTime: 30 * 60 * 1000,
    retry: 2,
  })

  function plexUrl(ratingKey) {
    if (!plexInfo?.machineIdentifier) return null
    const key = encodeURIComponent(`/library/metadata/${ratingKey}`)
    return `https://app.plex.tv/desktop/#!/server/${plexInfo.machineIdentifier}/details?key=${key}&context=source%3Acontent.library~0~0`
  }

  if (albums.length === 0) return <p className="text-plex-muted text-sm">No albums.</p>

  return (
    <div className="bg-plex-card border border-plex-border rounded-xl overflow-hidden">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-plex-border bg-plex-dark/40">
            <th className="text-xs text-plex-muted font-normal text-left px-4 py-2.5">Album</th>
            <th className="text-xs text-plex-muted font-normal text-right px-3 py-2.5 w-16">Year</th>
            <th className="text-xs text-plex-muted font-normal text-left px-3 py-2.5 w-48">MusicBrainz</th>
            <th className="text-xs text-plex-muted font-normal text-left px-3 py-2.5 w-36">Discogs</th>
            <th className="text-xs text-plex-muted font-normal text-center px-3 py-2.5 w-16" title="Album artwork">Artwork</th>
            <th className="text-xs text-plex-muted font-normal text-center py-2.5 w-20">Plex</th>
          </tr>
        </thead>
        <tbody>
          {albums.map(a => (
            <tr key={a.ratingKey} className="border-b border-plex-border/40 last:border-0 hover:bg-plex-dark/30 transition-colors">
              <td className="px-4 py-2.5">
                <button
                  onClick={() => navigate(`/albums/${a.ratingKey}`)}
                  className="text-sm font-medium truncate max-w-xs text-left hover:text-plex-orange hover:underline transition-colors"
                >
                  {a.title}
                </button>
                {showArtist && a.artist && <p className="text-xs text-plex-muted truncate max-w-xs">{a.artist}</p>}
                {a.trackCount > 0 && <p className="text-xs text-plex-muted">{a.trackCount} tracks</p>}
              </td>

              <td className="text-right px-3 py-2.5 text-plex-muted font-mono text-xs">
                {a.year || '—'}
              </td>

              <td className="px-3 py-2.5">
                {a.isMatched
                  ? <LinkedChip label="MusicBrainz" onClick={() => onFix(a)} />
                  : <LinkBtn label="Fix Match" onClick={() => onFix(a)} />}
              </td>

              <td className="px-3 py-2.5">
                {a.discogs_id
                  ? <LinkedChip label="Discogs" onClick={() => onDiscogs(a)} />
                  : <LinkBtn onClick={() => onDiscogs(a)} />}
              </td>

              <td className="text-center py-2.5">
                <div className="flex justify-center">
                  <Dot ok={a.thumb} title={a.thumb ? 'Has artwork' : 'No artwork'} />
                </div>
              </td>

              <td className="text-center py-2.5">
                {plexUrl(a.ratingKey) && (
                  <a
                    href={plexUrl(a.ratingKey)}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Open in Plex"
                    className="text-xs border border-plex-border text-plex-muted hover:text-plex-orange hover:border-plex-orange px-2 py-0.5 rounded transition-colors"
                  >
                    Plex ↗
                  </a>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
