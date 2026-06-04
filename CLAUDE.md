# Plex Wizard — CLAUDE.md

## Proyecto
Webapp para auditar y enriquecer metadata de música en Plex. Backend FastAPI (Python 3.11+) + Frontend React 18/Vite/TailwindCSS/TanStack Query.

## UI Language

All UI text is in English. Frontend labels, button text, filter names, error messages — English only.

## Dev

```bash
# Backend
cd backend && ../venv/bin/uvicorn main:app --reload --port 8000

# Frontend
cd frontend && npm run dev
# Abre http://localhost:5173 (proxy /api → :8000)
```

Variables de entorno en `.env` en la raíz: `PLEX_URL`, `PLEX_TOKEN`, `LASTFM_API_KEY`, `DISCOGS_TOKEN`.

## Estructura clave

```
backend/
  main.py              # FastAPI — todos los endpoints
  db.py                # SQLite persistence — artist_links (discogs_id, lastfm_name)
  plex_client.py       # Conexión PlexServer
  scan_manager.py      # Scan en background con caché por paso
  mb_client.py         # MusicBrainz API
  lastfm_client.py     # Last.fm API
  discogs_client.py    # Discogs API
  wikidata_client.py   # Wikidata SPARQL
  audits/              # Módulos de auditoría por problema

frontend/src/
  context/ScanContext.jsx   # Estado global scan
  hooks/useAuditData.js     # Lee resultados del contexto
  components/
    Layout.jsx              # Sidebar + progreso del scan
    DiscogsLinkModal.jsx    # Search Discogs candidates → save artist's discogs_id to SQLite
    LastFMLinkModal.jsx     # Search Last.fm artists → save artist's lastfm_name to SQLite
    EnrichModal.jsx         # 4 tabs: MusicBrainz · Last.fm · Discogs · Wikidata
    AlbumDiscogsModal.jsx   # Enrich album desde Discogs (géneros/styles/labels/bio)
    AutoMatchModal.jsx      # Auto-match artista con MB (compara discografías)
    FixMatchModal.jsx        # Fix match manual (artistas y albums)
    MBDataModal.jsx         # Vista datos MB para artistas con MBID
  pages/
    Artists.jsx             # Tabla de artistas con filtros + acciones modales
    ArtistDetail.jsx        # Detalle artista + tabla de albums con status dots
    GenreManager.jsx        # Gestión de géneros: ver/reasignar artistas entre géneros
```

## Service Links (SQLite)

- `artist_links.db` stores `discogs_id` (int) and `lastfm_name` (text) per `ratingKey` — file is gitignored.
- MusicBrainz → stored in Plex guids (`mbid://uuid`). Discogs/Last.fm → stored in SQLite only.
- `set_discogs()` and `set_lastfm()` are independent — updating one never overwrites the other field.
- `/api/artists` always merges fresh SQLite links on top of Plex scan cache. Don't cache the merged result.
- `/api/artist/{rk}/status` returns `discogs_id` + `lastfm_name` so the `refreshArtist` override pattern picks them up immediately after modal close.
- `db.init_db()` called at FastAPI startup — creates table if not exists, safe to call every time.

## Artists page (current)

Filters: All / No Match / No MusicBrainz / No Discogs / No Last.fm
Columns: Artist | MusicBrainz | Discogs | Last.fm | Plex
"No Match" = none of the three services linked (`isMatched=false` AND no `discogs_id` AND no `lastfm_name`).

## Arquitectura de modales

### EnrichModal (artistas)
4 tabs independientes, cada uno gestiona su propio `useQuery`/`useMutation`:
- **MusicBrainz**: país + géneros con votos, requiere MBID
- **Last.fm**: tags (aplicables como géneros/styles/moods), bio, artistas similares
- **Discogs**: búsqueda de artista → bio del perfil. Géneros/estilos NO se aplican desde aquí (vienen de releases, no del artista en Discogs)
- **Wikidata**: país de origen vía SPARQL

### AlbumDiscogsModal (albums)
Flujo: buscar album → seleccionar release → ver géneros/styles/labels/notes → aplicar por sección o todo.
Accesible desde `ArtistDetail` (tabla de albums).

## Patrón de actualización optimista en Artists.jsx

Después de cerrar un modal, en lugar de invalidar el query cache completo (que refetcharía todos los artistas), se hace fetch individual al endpoint `/api/artist/:id/status` y se guarda en `overrides` local. Los overrides se mergean con los datos del servidor en `useMemo`.

```js
const refreshArtist = useCallback(async (ratingKey) => {
  const res = await fetch(`/api/artist/${ratingKey}/status`)
  if (res.ok) setOverrides(prev => ({ ...prev, [ratingKey]: await res.json() }))
}, [])
```

## Genre Manager

- `/api/genres` itera TODOS los géneros por artista — un artista con ["Electronic","Psytrance"] aparece en ambos.
- Para reasignar: leer lista completa → reemplazar `old_genre` → escribir todo con `{f"genre[{i}].tag.tag": g for i, g in enumerate(deduped)}`. No usar solo `genre[0].tag.tag` (pisa géneros incorrectos).
- Plex tarda ~1.2s en indexar después de `artist.edit()` — usar `setTimeout(1200)` antes de `invalidateQueries`.
- Cambios de Genre Manager NO se reflejan en `/api/artists` (usa scan cache) hasta nuevo scan.

## Distinción Discogs artista vs album

- **Artista en Discogs** → solo tiene `profile` (bio). Géneros/estilos NO disponibles.
- **Release en Discogs** → tiene `genres`, `styles`, `labels`, `notes`. Se aplican a nivel de album.

Esta distinción es importante: el tab Discogs de `EnrichModal` solo aplica bio; `AlbumDiscogsModal` aplica géneros/styles/labels.

## Links externos

Todos los `<a>` a URLs externas deben tener `target="_blank" rel="noopener noreferrer"`. Revisado y correcto en todos los componentes.

## Plex deep-links

Para construir la URL de un artista en Plex Web se necesita el `machineIdentifier` del servidor, obtenido de `/api/plex-info`. Patrón:

```js
function plexArtistUrl(ratingKey) {
  const key = encodeURIComponent(`/library/metadata/${ratingKey}`)
  return `https://app.plex.tv/desktop/#!/server/${machineIdentifier}/details?key=${key}&context=source%3Acontent.library~0~0`
}
```

## Convenciones frontend

- Componentes pequeños reutilizables (`TagChip`, `ApplyBtn`, `Dot`, `Section`) se definen en el mismo archivo que los usa si son específicos de ese modal.
- Estado de "aplicado" (`applied`) local en cada tab/modal — no persiste entre aperturas del modal. Se resetea al reabrir.
- Errores de API se muestran inline con `text-red-400 text-sm`.
- Loading states con `animate-pulse`.
- `useSearchParams` para estado de paginación/búsqueda/filtro — preserva URL al navegar; back button restaura posición.
- Cuando hay búsqueda activa, mostrar TODOS los resultados filtrados sin paginar — datos ya están en memoria.

## Seguridad

- Variables de entorno solo en `.env` vía `python-dotenv`, nunca hardcodeadas.
- `.env` en `.gitignore`.
- Inputs de ratingKey son IDs numéricos de Plex — el backend debe validarlos antes de usarlos en URLs externas.
- Scan completo: ~15-20 min para 1200+ artistas. El paso más lento es "Tracks".
