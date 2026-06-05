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

- `artist_links.db` stores `discogs_id`, `lastfm_name`, `is_compound`, `is_single` per `ratingKey` — file is gitignored.
- MusicBrainz → stored in Plex guids (`mbid://uuid`). Discogs/Last.fm → stored in SQLite only.
- `set_discogs()`, `set_lastfm()`, `set_compound()`, `set_single()` are all independent — updating one never overwrites other fields.
- `/api/artists` always merges fresh SQLite links on top of Plex scan cache. Don't cache the merged result.
- `/api/artist/{rk}/status` returns all SQLite fields so the `refreshArtist` override pattern picks them up immediately after modal close.
- `db.init_db()` called at FastAPI startup — creates table + runs `ALTER TABLE ADD COLUMN` migrations for new columns, safe to call every time.
- New endpoints: `PUT /api/artist/{rk}/links/compound`, `PUT /api/artist/{rk}/links/single`, `PUT /api/artists/bulk-compound`, `PUT /api/artist/{rk}/fix-match-mbid`.

## Artists page (current)

Filters: All / No Match / No MusicBrainz / No Discogs / No Last.fm / **Compound**
Columns: Artist | MusicBrainz | Discogs | Last.fm | Plex
"No Match" = none of the three services linked AND not effectively compound (`!isEffectivelyCompound(a)`).

## Compound Artists

Compound = artist entry in Plex that is actually two or more artists (e.g. "Burial + Four Tet", "Tom Misch & Yussef Dayes").

### Detection
`looksCompound(title)` splits by: ` And `, ` & `, ` / `, ` x `, ` × `, ` feat. `, ` featuring `, ` + `, ` vs. `, ` , `

### Tri-state logic (`isEffectivelyCompound`)
```js
function isEffectivelyCompound(a) {
  if (a.is_single)   return false   // user override: "this IS a single artist despite the name"
  if (a.is_compound) return true    // user manually flagged as compound
  return looksCompound(a.title)     // auto-detected by regex
}
```
- `is_single = true` → use case: "Tiger & Woods" is a duo/band name, not two separate artists
- `is_compound = true` → use case: manually flag an artist not caught by regex
- Auto-detected artists: `no_match` filter excludes them automatically, no manual action needed

### Component breakdown (Compound filter only)
`CompoundComponents` parses each component and checks if it exists in the artists array (case-insensitive title match):
- **Found in library** → shows `→ Go to artist` (Link to `/artists/{ratingKey}`) so user can map services on the individual artist's page
- **Not found** → shows external search links (MB ↗ / Discogs ↗ / Last.fm ↗)

### Badges in Artist column
- `⋱ auto` (amber) — auto-detected; clicking marks `is_single = true`
- `✓ single` (blue) — `is_single` override active; clicking removes it
- `⋱` (grey) — not detected; clicking sets `is_compound = true`
- `⋱ manual` (amber) — manually flagged; clicking removes flag

## Arquitectura de modales

### Patrón homologado: DiscogsLinkModal / LastFMLinkModal / FixMatchModal
Los tres modales de linking siguen la misma estructura:
1. **Current link status bar** (verde) con botón Remove — si ya hay un link activo
2. **Search box** con botón Search — pre-relleno con el nombre del artista
3. **Manual entry field** — Discogs: número de ID; Last.fm: nombre exacto; MusicBrainz: UUID
4. **Results list** — candidatos clicables

El search de Discogs acepta query param `?q=` para búsquedas personalizadas.  
El fix-match-mbid endpoint busca el UUID en resultados de Plex (primero por UUID como query, luego por nombre del artista).

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
