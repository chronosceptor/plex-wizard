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
  db.py                # SQLite persistence — compound_component_links (source of truth for service links)
  plex_client.py       # Conexión PlexServer
  scan_manager.py      # Scan en background con caché por paso (recortado a all_artists en dev — ver nota abajo)
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
    CompoundLinksSection.jsx # Manager de component-links reutilizado por los 3 modales de servicio
    DiscogsLinkModal.jsx    # Link a Discogs (siempre vía CompoundLinksSection)
    LastFMLinkModal.jsx     # Link a Last.fm (siempre vía CompoundLinksSection)
    MusicBrainzLinkModal.jsx # Link a MusicBrainz — Plex agent (single) / MB direct search (compound, vía CompoundLinksSection)
    ArtistEnrichSections.jsx # Secciones apiladas de enrich (MB · Last.fm · Discogs · Wikidata) — comparativa Plex vs servicio
    AlbumDiscogsModal.jsx   # Enrich album desde Discogs (géneros/styles/labels/bio)
    MBDataModal.jsx         # Vista datos MB para artistas con MBID
  pages/
    Artists.jsx             # Tabla de artistas con filtros + acciones modales — nombre clicable → /artists/:id; exporta LinkedChip/LinkBtn
    ArtistDetail.jsx        # Página de artista (full-width, 5 tabs: Plex·MusicBrainz·Discogs·Last.fm·Wikidata) — ver sección dedicada abajo
    GenreManager.jsx        # Gestión de géneros: ver/reasignar artistas entre géneros
```

## Dev speed: scan recortado + DEV_ARTIST_LIMIT

Para iterar rápido en la pestaña Artists (sin esperar el scan completo de ~15-20 min):
- `scan_manager.py`: `STEPS` solo incluye `all_artists` — el resto de pasos están comentados. El summary devuelto por el scan se reduce a `{"totalArtists": N}`.
- `DEV_ARTIST_LIMIT` (env var, root `.env`): si > 0, `audits/all_artists.py` recorta `section.all()[:DEV_ARTIST_LIMIT]` antes de procesar. **Restaurar a 0 (o quitar la var) y descomentar los pasos del scan antes de producción/release.**
- `/api/artists` ya NO tiene fallback a `section.all()` directo — devuelve 503 si el scan cache no está listo. El frontend espera con `allArtistsReady` (gate sobre el step `all_artists`).

## Service Links (SQLite) — `compound_component_links` es la fuente de verdad

- Tabla `compound_component_links`: `id, rating_key, component, service, service_id, updated_at`, `UNIQUE(rating_key, component, service)`. `service ∈ {discogs, lastfm, musicbrainz}`.
- **Todo artista — single o compound — se linkea igual**: una fila por componente. Un artista "single" simplemente tiene 1 componente (su propio nombre); uno "compound" tiene 2+.
- MusicBrainz para artistas single sigue almacenándose en el guid de Plex (`mbid://uuid`, vía `artist.matches()` + `fix-match`); para componentes de artistas compuestos se guarda en `compound_component_links` (no se puede aplicar a Plex porque el artista compuesto no existe como entidad en MB).
- `db.get_all_component_links_grouped()`: `{rating_key: {discogs: [...], lastfm: [...], musicbrainz: [...]}}`, usado por `/api/artists`.
- `db.get_compound_components(rk)` / `set_compound_component()` / `delete_compound_component()`: CRUD por artista.
- `db.init_db()` migra automáticamente al startup: filas legacy con `artist_links.discogs_id`/`lastfm_name` se copian a `compound_component_links` con `component='Primary'` (solo si el artista no tiene ya component links — evita duplicar).
- `/api/artists` y `/api/artist/{rk}/status` devuelven `discogs_links`/`lastfm_links`/`mb_links` (arrays de `{component, service_id}`) + `is_compound` derivado + `discogs_id`/`lastfm_name` planos (primer componente, para chips simples).
- `/api/artists` siempre mergea fresh links sobre el scan cache de Plex — no cachear el merge.
- Endpoints: `GET/PUT/DELETE /api/artist/{rk}/compound-components`, `GET /api/mb-search?q=`.

## Artists page (current)

Filters: All / No Match / No MusicBrainz / No Discogs / No Last.fm / **Compound**
Columns: Artist | MusicBrainz | Discogs | Last.fm | Plex
"No Match" = `!isMatched && discogs_links.length === 0 && lastfm_links.length === 0 && !is_compound`.

## Compound Artists — derivado, no almacenado

**No existe flag manual ni toggle.** `is_compound` se deriva en el backend:
```python
all_components = {lnk["component"] for lnk in discogs_links + lastfm_links + mb_links}
is_compound = len(all_components) > 1
```
Es decir: un artista es compound si tiene **2+ nombres de componente distintos** linkeados (en cualquier servicio). Si solo has linkeado 1 componente (o ninguno), es single. Esto elimina por completo el regex de auto-detección (`looksCompound`/`parseComponents`/`CompoundComponents`) y los flags `is_compound`/`is_single` — toda esa lógica fue removida.

**Flujo de uso**: el usuario abre cualquier modal de servicio → ve la lista de componentes ya linkeados → agrega componentes con "+ Add" (nombre libre) → busca/linkea cada uno por separado. Linkear 1 componente = single; 2+ = compound automáticamente.

## Arquitectura de modales — unificados

`DiscogsLinkModal`, `LastFMLinkModal` y `MusicBrainzLinkModal` (para artistas compuestos) **siempre** renderizan `CompoundLinksSection` — ya no hay distinción single/compound en la UI del modal:

1. Lista de componentes ya linkeados (chip verde, ID/nombre clicable → external link, botón "Remove" en verde neutro)
2. Form "+ Add component artist name..." (pre-rellenado con `artist.title` vía prop `defaultComponent`)
3. Al activar un componente, se abre el panel de búsqueda específico del servicio (`renderSearch` render-prop)

**Excepción — MusicBrainz para artistas single**: usa `PlexSearchPanel` (busca via `/api/artist/{rk}/matches`, agente de Plex) y aplica con `fix-match`/`fix-match-mbid` — esto SÍ escribe el guid en Plex. Solo cuando `artist.is_compound` es true se usa `MBDirectSearchPanel` + `CompoundLinksSection` (búsqueda directa a MB API, guarda solo en SQLite, sin tocar Plex).

**Tabla — chip unificado `LinkedChip`**: un solo chip verde por servicio, click abre el modal (ya no hay link externo directo + botón "⋯" separado). Si hay 2+ componentes linkeados muestra `"N <Service>"` (p.ej. "2 Discogs"); si hay 1, solo el nombre del servicio. La navegación externa vive dentro del modal (`CompoundLinksSection` linkea el `service_id` a la página externa correspondiente vía `serviceUrl(service, id)`).

El search de Discogs acepta query param `?q=` para búsquedas personalizadas.

## ArtistDetail — página por tabs (Plex · MusicBrainz · Discogs · Last.fm · Wikidata)

`ArtistDetail.jsx` es **full-width** (sin `max-w-*`) y usa `useSearchParams` para persistir el tab activo
(`?tab=`). El header (nombre + thumb) reutiliza directamente `LinkedChip`/`LinkBtn` y los tres modales de
servicio **exportados desde `Artists.jsx`** — mismo patrón visual y de interacción que la tabla de artistas,
con estado propio (`mbLinkItem`/`discogsLinkItem`/`lastfmLinkItem`, nombres distintos del `discogsItem`
existente que es para `AlbumDiscogsModal` a nivel álbum) y `onClose` que invalida `['artist-albums', rk]`.
**No hay status dots en el header** (se quitaron — la info vive en cada tab + en los chips de match).

### Tab Plex — metadata editable in-place
A diferencia del resto (que son comparativas read-only + aplicar), el tab Plex permite **editar
directamente la metadata de Plex**: cada campo multi-valor (géneros/styles/moods/países/colecciones/
labels/similar) se renderiza como `EditableTagGroup` — chips removibles con "×" + input "+ Add" — y la
bio es un `<textarea>`. Patrón de estado: `baseline` (valores cargados) vs `form` (edición local);
`isDirty = JSON.stringify(form) !== JSON.stringify(baseline)`. Una barra inferior *sticky* con
"Guardar cambios"/"Descartar cambios" llama `PUT /api/artist/{rk}/edit-metadata` (payload = listas
completas deseadas) vía `useMutation`; en éxito actualiza `baseline = form` e invalida
`['artist-albums', rk]`. El backend (`artist_edit_metadata`) **diffea** cada lista deseada contra los
tags actuales de Plex y llama `artist.add<Campo>()`/`artist.remove<Campo>()` (mixins de PlexAPI:
`addGenre`/`removeGenre`, `addStyle`/`removeStyle`, etc.) + `artist.editSummary()` para la bio — nunca
arma `genre[i].tag.tag` a mano. Verificado en vivo: agregar/quitar un género de prueba se persiste y
revierte correctamente en el servidor Plex real.

### Tabs de servicios (comparativa Plex vs sugerido)
`ArtistEnrichSections.jsx` exporta 4 secciones independientes (`MusicBrainzSection`, `LastFMSection`,
`DiscogsSection`, `WikidataSection`, una por tab — ya NO se renderizan apiladas; `EnrichModal` fue
eliminado por huérfano). Cada una gestiona su propio `useQuery`/`useMutation` y comparte helpers
`TagChip`/`ApplyBtn`/`SourceSection` + los nuevos de comparación `CompareHeader`/`CompareRow`/
`PlexChips`/`PlexText` — **Plex (actual) a la izquierda, sugerido del servicio a la derecha**, con botón
de aplicar solo cuando difieren:
- **MusicBrainz**: país + géneros con votos, requiere MBID
- **Last.fm**: tags (aplicables como géneros/styles/moods), bio, artistas similares
- **Discogs**: si `artist.discogs_id` ya existe, carga el perfil vinculado directamente (sin mostrar
  buscador) — ver nota de bug abajo. Solo expone bio; géneros/estilos vienen de releases, no del artista.
- **Wikidata**: país de origen vía SPARQL

`onApplied` invalida `['artist-albums', ratingKey]` para refrescar la página tras aplicar cualquier cambio.

**Bug resuelto — Discogs mostraba buscador en artistas ya matcheados**: `/api/artist/{rk}/albums` no
exponía `discogs_id`/`discogs_links` (solo `/status` los tenía). Se replicó la derivación de
`db.get_compound_components()` en el endpoint de albums; `DiscogsSection` ahora chequea
`artist.discogs_id` primero y solo muestra el buscador con un toggle explícito "Buscar otro" /
"Volver al vinculado".

## Sugerencias automáticas MusicBrainz → Discogs/Last.fm (`url-rels`)

MusicBrainz expone relaciones de URL salientes (`inc=url-rels`) curadas por la comunidad — links directos
del artista en MB hacia su página en Discogs/Last.fm/Wikidata/sitio oficial. Esto permite **pre-rellenar
candidatos de alta confianza** sin que el usuario tenga que buscar manualmente:

- `mb_client.get_artist_url_relations(mbid)` + `_parse_url_relations()`: parsean las relaciones tipo
  `discogs`/`last.fm`, extraen `discogs_id` (regex `^/artist/(\d+)`) y `lastfm_name` (path decodeado de
  `/music/<name>`). Devuelven `{"discogs_id": str|None, "lastfm_name": str|None}`.
- Endpoint `GET /api/artist/{rk}/mb-suggested-links`: usa `_extract_mbid` (mismo helper que `mb-data`,
  revisa `guid` y `guids` secundarios) — si no hay MBID devuelve `{discogs_id: null, lastfm_name: null}`.
- Frontend: componente `MBSuggestion` (duplicado en `DiscogsLinkModal`/`LastFMLinkModal`, mismo patrón)
  renderiza una card naranja "Suggested by MusicBrainz" con link externo + botón "Use this" que llama
  directamente a `onLink(...)` — el mismo flujo de `CompoundLinksSection.addLink`, persiste en
  `compound_component_links`. Se oculta si no hay sugerencia (`data?.discogs_id`/`data?.lastfm_name` null).
- Validado con datos reales: para "1200 Micrograms" MB sugirió `discogs_id: "28118"` — coincide
  exactamente con el candidato top de la búsqueda manual de Discogs, confirmando alta confianza.

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

Esta distinción es importante: la sección Discogs de `ArtistEnrichSections` solo aplica bio; `AlbumDiscogsModal` aplica géneros/styles/labels.

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
