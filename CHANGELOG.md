# Changelog

Todos los cambios notables de este proyecto se documentan aquí.

## [Unreleased]

### Added
- **Compound Artists filter** (`Artists.jsx`): new "Compound" tab that auto-detects artist names containing separators (`&`, `/`, `feat.`, `+`, `vs.`, `And`, `x`, `×`, `,`). Shows each compound artist with parsed components; if a component exists in the library as a standalone artist, displays `→ Go to artist` link to their detail page; otherwise shows external MB/Discogs/Last.fm search links.
- **Tri-state compound logic** (`isEffectivelyCompound`): `is_single` overrides auto-detection for band names like "Tiger & Woods" (single artist with `&` in name); `is_compound` manually forces compound for names not caught by regex; auto-detection is the default.
- **SQLite columns `is_compound` / `is_single`** in `artist_links` table — migrated automatically at startup via `ALTER TABLE ADD COLUMN`.
- **`PUT /api/artist/{rk}/links/compound`** and **`PUT /api/artist/{rk}/links/single`**: save compound/single-artist flags per artist.
- **`PUT /api/artists/bulk-compound`**: flag multiple artists as compound in one request.
- **`PUT /api/artist/{rk}/fix-match-mbid?uuid=`**: apply a MusicBrainz match directly by UUID — searches Plex results by UUID first, then by artist name as fallback.
- **Manual ID/name entry in all three link modals**: DiscogsLinkModal accepts a raw Discogs artist ID; LastFMLinkModal accepts an exact Last.fm artist name; FixMatchModal accepts a MusicBrainz UUID — all bypass the search results list.
- **Search box in DiscogsLinkModal**: query is now editable (pre-filled with artist name), triggering a fresh search. Returns up to 10 candidates (was 5).
- **Current MBID status bar in FixMatchModal**: shows linked UUID with direct MB ↗ link when artist already has an MBID.
- **`db.set_compound()` / `db.set_single()` / `db.bulk_set_compound()`**: new db.py helpers.

### Changed
- **`GET /api/artist/{rk}/discogs-search`**: now accepts optional `?q=` param to search with a custom term instead of the Plex artist name.
- **`No Match` filter**: now also excludes artists that are effectively compound (auto-detected or manually flagged) — no manual action required to clean up collaboration entries.
- **`/api/artists` and `/api/artist/{rk}/status`**: now return `is_compound` and `is_single` fields.
- **FixMatchModal**: all text translated to English (was partially Spanish: "Buscar", "Aplicar", "Sin resultados", "O refrescar…").

### Fixed
- **SQLite persistence layer** (`backend/db.py`): stores per-artist service links — `discogs_id` (int) and `lastfm_name` (text) keyed by Plex `ratingKey`. File `artist_links.db` is gitignored. `db.init_db()` called at FastAPI startup.
- **DiscogsLinkModal**: new component that auto-searches Discogs when opened, shows candidates with thumbnail, and saves the selected `discogs_id` to SQLite. Includes "Remove" option for already-linked artists.
- **LastFMLinkModal**: new component with pre-filled search input (Plex artist name), searches Last.fm `artist.search` API, shows candidates with listener counts, and saves the canonical `lastfm_name` to SQLite.
- **`lastfm_client.search_artists()`**: new function using Last.fm `artist.search`, returns name/mbid/url/listeners.
- **`PUT /api/artist/{rk}/links/discogs`** and **`PUT /api/artist/{rk}/links/lastfm`**: save/clear service links independently in SQLite.
- **`GET /api/lastfm/search?q=X`**: search Last.fm artists by name.

### Changed
- **Artists page rewritten**: columns Artist | MusicBrainz | Discogs | Last.fm | Plex. Filters: All / No Match / No MusicBrainz / No Discogs / No Last.fm.
- **`GET /api/artists`**: now merges fresh SQLite links on every request on top of the Plex scan cache.
- **`GET /api/artist/{rk}/status`**: now returns `discogs_id` and `lastfm_name` from SQLite for the override-refresh pattern.
- **UI language**: all frontend text is now in English (labels, filters, buttons, navigation sidebar).
- **`.gitignore`**: added `*.db`.

### Added
- **Genre Manager** (`/genres`): nueva página para consolidar géneros de la librería. Panel izquierdo lista todos los géneros con conteo de artistas (géneros con ≤ 3 artistas se marcan en ámbar como candidatos a fusionar). Panel derecho muestra artistas del género seleccionado con checkboxes. Barra de reasignación con autocompletado de géneros existentes o escritura libre para crear uno nuevo. Permite mover artistas entre géneros o fusionar géneros pequeños en uno mayor.
- **Backend `GET /api/genres`**: endpoint que lee artistas de Plex, agrupa por género primario y devuelve lista ordenada por conteo con artistas incluidos.
- **Backend `POST /api/genres/reassign`**: endpoint para reasignar el género primario de una lista de artistas en Plex.
- **AlbumDiscogsModal**: nuevo componente para enriquecer albums desde Discogs. Flujo: buscar release → seleccionar → ver géneros/styles/labels/notes → aplicar por sección o todo. Accesible desde `ArtistDetail`.
- **ArtistDetail page** (`/artists/:ratingKey`): vista detalle del artista con tabla de todos sus albums, status dots (match, portada, géneros, moods) y acciones Fix Match + Discogs por album.
- **Wikidata tab en EnrichModal**: consulta país de origen vía SPARQL y permite aplicarlo a Plex.
- **MusicBrainz tab en EnrichModal**: muestra tipo de artista, año de fundación, país y géneros con votos desde MB API. Aplica país y/o géneros directamente.
- **Plex deep-link** en tabla de artistas: botón "Plex ↗" que abre el artista directamente en Plex Web (requiere `machineIdentifier` de `/api/plex-info`).
- Navegación a `ArtistDetail` al hacer click en el nombre de un artista en la tabla.
- Filtros adicionales en Artists: `no_styles`, `no_mood`, `no_photo`.

### Changed
- **MusicBrainz tab — géneros seleccionables**: los chips de géneros ahora son clicables para elegir cuál aplicar (en lugar de aplicar siempre el primero). El primero por votos queda seleccionado por defecto. Cada chip muestra su conteo de votos comunitarios.
- **Last.fm tab — "Aplicar todo"**: el botón ahora aplica styles + moods + bio + similares. Renombrado de "Aplicar todo (tags → Moods)".
- **EnrichModal** expandido de 2 tabs (Last.fm + Discogs) a 4 tabs (MusicBrainz · Last.fm · Discogs · Wikidata).
- **Artists.jsx**: patrón de actualización optimista con `overrides` local. Tras cerrar un modal, se hace fetch de `/api/artist/:id/status` y se mergea con los datos del servidor sin refetchar toda la lista.
- Discogs tab en EnrichModal ahora solo aplica bio (el perfil del artista en Discogs no tiene géneros/estilos — estos vienen de releases y se manejan por `AlbumDiscogsModal`).

### Changed
- **Genre Manager — indexación completa de géneros**: `/api/genres` ahora itera TODOS los géneros de cada artista (antes solo el primario). Un artista con ["Electronic","Psytrance"] aparece en ambos géneros. Resultado: de ~19 géneros visibles a la lista completa de la librería.
- **Genre Manager — reasignación correcta**: `POST /api/genres/reassign` ahora recibe `old_genre` + `new_genre`, lee la lista completa de géneros del artista, reemplaza el género específico y escribe toda la lista de vuelta. Antes solo pisaba `genre[0]` lo que corrompía artistas con múltiples géneros.
- **Artists page — estado en URL**: `search`, `filter` y `page` ahora viven en `useSearchParams`. El back button del browser restaura la posición exacta al volver de un ArtistDetail.
- **Artists page — búsqueda sin paginación**: cuando hay texto en el buscador se muestran TODOS los resultados filtrados sin paginar (los datos ya están en memoria); la paginación solo aparece con lista completa.

### Fixed
- Todos los links externos (`<a target="_blank">`) tienen `rel="noopener noreferrer"` en todos los componentes.
- Genre Manager: tras mover artistas, el `invalidateQueries` se retrasa 1.2s para dar tiempo a que Plex indexe el cambio antes del refetch.
