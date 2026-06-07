# PlexAPI / PMS Library API — exploración enfocada en música

Exploración de `python-plexapi` 4.15.16 (la lib que ya usa el proyecto vía `plex_client.py`) y de la
[PMS Library API](https://developer.plex.tv/pms/#tag/Library), enfocada en qué se puede leer/escribir
sobre `Artist`, `Album` y `Track` para el caso de uso de Plex Wizard (auditar y enriquecer metadata).

## 1. Atributos disponibles por tipo

### `Audio` (base común a Artist/Album/Track)
`addedAt`, `art`, `artBlurHash`, `fields`, `guid` (Plex GUID, `plex://artist/...`), `index`, `key`,
`lastRatedAt`, `lastViewedAt`, `moods`, `musicAnalysisVersion`, `ratingKey`, `summary`, `thumb`,
`thumbBlurHash`, `title`, `viewCount`...

Ya usados en el proyecto: `ratingKey`, `title`, `summary`, `thumb`, `genres`, `moods`.

### `Artist`
Atributos relevantes para enrichment que **el proyecto aún no usa**:
- `audienceRating` / `rating` — ratings numéricos
- `collections` — lista de `Collection`
- `countries` — ya se lee (`artists_country.py`), pero no se escribe
- `guids` — **lista de `Guid` externos** (`mbid://...`, etc. — ver §3, muy relevante)
- `labels` — lista de `Label`
- `similar` — lista de `Similar` (artistas similares ya guardados en Plex)
- `styles` — lista de `Style`
- `albumSort`, `theme`, `ultraBlurColors` — metadata "cosmética"
- `locations` — paths en disco

### `Album`
Además de lo ya usado (`ratingKey`, `title`, `parentTitle`, `year`, `leafCount`, `thumb`, `genres`, `moods`):
- `studio` — sello discográfico (¡Discogs `labels` podría mapear aquí!)
- `originallyAvailableAt` — fecha de release real (vs `year`)
- `styles`, `collections`, `labels`, `formats`, `subformats`
- `parentGuid`/`parentRatingKey`/`parentThumb`/`parentTheme` — referencias al artista padre
- `rating`/`audienceRating`

### `Track`
Además de lo ya usado:
- `originalTitle` — "el artista para el track" (útil para compilations / collabs)
- `chapters`, `media` (ya usado), `grandparent*` (ya usado)
- `guids`, `labels`, `collections`

## 2. Lo que ya usa el proyecto vs. lo que no

**Ya usado** (`grep` sobre `backend/`):
- Lectura: `genres`, `moods`, `countries`, `summary`, `thumb`, `title`, `ratingKey`, `albumCount`, `guid`
- Escritura: `artist.edit(...)` (genre/mood/país vía campos `genre[i].tag.tag` etc.), `artist.matches()` / `fixMatch()` (matching del agente Plex), `artist.refresh()`

**No usado todavía** y potencialmente útil para enrichment:
- `addGenre`/`removeGenre`, `addStyle`/`removeStyle`, `addMood`/`removeMood`, `addCountry`/`removeCountry`,
  `addLabel`/`removeLabel`, `addCollection`/`removeCollection`, `addSimilarArtist`/`removeSimilarArtist` —
  **mixins de alto nivel que reemplazarían el patching manual de `genre[i].tag.tag`** descrito en CLAUDE.md
  (Genre Manager). Internamente llaman a `_edit_tags`/`editTags` con `locked=True/False` y manejan el
  array completo — exactamente el problema que describe la sección "Genre Manager" del CLAUDE.md
  ("no usar solo `genre[0].tag.tag`, pisa géneros incorrectos").
- `editSummary`, `editTitle`, `editSortTitle`, `editStudio` (álbumes — sello/label de Discogs),
  `editOriginallyAvailable` (fecha de release de Discogs)
- `artist.guids` — ver §3
- `artist.similar` / `addSimilarArtist` — ver §4
- `hubs()` (de `HubsMixin`) — `GET /library/metadata/{id}/related`, devuelve `Hub` con contenido relacionado

## 3. `Guid` — IDs externos ya embebidos por el agente de Plex

`Artist.guids` / `Album.guids` / `Track.guids` devuelven objetos `Guid` con un único campo `id`,
formato `<source>://<external_id>` (ej. `mbid://...`, `tmdb://...`). Esto es justo lo que el proyecto
ya extrae manualmente del `guid` del artista (`mbid://uuid`, `db.py` / CLAUDE.md sección "Service Links").

**Posible mejora**: cuando el agente de Plex matchea un artista y aporta más de un Guid externo
(p. ej. si en el futuro Plex soporta agentes que devuelven Discogs/Last.fm IDs), `artist.guids` daría
acceso directo sin parsear el `guid` principal. Hoy por hoy, para música, Plex normalmente solo
expone el MBID en el guid principal — pero vale la pena verificar `artist.guids` al hacer scan,
por si algún artista ya trae IDs adicionales vía agente.

## 4. Similar / Related — alternativa o complemento a Last.fm "similar artists"

- `Artist.similar` (atributo, lista de `Similar` MediaTag) — similares que Plex ya tiene guardados
  (vienen del agente de metadata)
- `addSimilarArtist(artists, locked=True)` / `removeSimilarArtist(...)` — **se puede escribir la lista
  de artistas similares directamente en Plex**, igual que se hace con genres/styles/moods. Esto es
  relevante para el tab "Last.fm" de `EnrichModal` (que ya muestra "artistas similares" — hoy probablemente
  solo a modo informativo). Podría aplicarse como acción "Apply similar artists to Plex".
- `hubs()` — `/library/metadata/{id}/related`, devuelve recomendaciones tipo "More like this" generadas
  por Plex (combinación de agente + análisis sónico)

## 5. Análisis sónico (sonic analysis) — feature nativa de Plex, no usada

`Audio` expone:
- `hasSonicAnalysis()` — bool, si Plex ya analizó el audio
- `sonicallySimilar(...)` — tracks/álbumes sónicamente similares según el análisis de Plex (espectral,
  no metadata)
- `Track.sonicAdventure(...)`, `MusicSection.sonicAdventure(...)` — genera "viajes" entre dos tracks
  basados en similitud sónica
- `Artist.station()` / `MusicSection.stations()` — estaciones de radio generadas por Plex

No es enrichment de metadata per se, pero es información que Plex ya calcula sobre la colección musical
y que hoy el proyecto no expone. Podría ser interesante como fuente adicional de "similar artists"
basada en audio real en lugar de solo en tags externos (Last.fm/Discogs/MB).

## 6. `MusicSection` — métodos específicos de biblioteca de música

`section.all()` ya se usa (recortado por `DEV_ARTIST_LIMIT`). Otros métodos de `MusicSection` no usados:
- `searchArtists(**kwargs)`, `searchAlbums(**kwargs)`, `searchTracks(**kwargs)` — búsquedas tipadas
  (vs. `section.search()` genérico)
- `recentlyAddedArtists()`, `recentlyAddedAlbums()`, `recentlyAddedTracks()`
- `albums()` — todos los álbumes de la sección de una sola vez (podría ser más eficiente que iterar
  `artist.albums()` por artista en ciertos audits)
- `stations()`, `sync()`

## 7. Matching — lo que ya se usa y lo que falta

`UnmatchMatchMixin` (`matches`, `fixMatch`, `unmatch`) ya está integrado (`main.py`). Notas del código fuente:
- `matches(agent=None, title=None, year=None, language=None)` — sin argumentos replica el comportamiento
  de "Match" en Plex Web; con `title`/`year` permite búsquedas manuales — esto es lo que probablemente
  alimenta el flujo de "fix match" para artistas single
- `fixMatch(searchResult=None, auto=True/False, agent=None)` — `auto=True` aplica el primer resultado
  automáticamente (no se está usando, pero podría ser una opción de "auto-fix" en bulk)
- `unmatch()` — **no usado**, podría ser útil para limpiar matches incorrectos antes de re-matchear

## 8. Edición — mixins de alto nivel vs. patching manual de campos

CLAUDE.md documenta el patrón actual para Genre Manager como un patching manual de
`{f"genre[{i}].tag.tag": g for i, g in enumerate(deduped)}`. La librería expone una capa más alta
(`GenreMixin.addGenre`/`removeGenre`, y lo mismo para `Style`/`Mood`/`Country`/`Label`/`Collection`/
`SimilarArtist`) que internamente arma ese mismo array de forma segura vía `EditTagsMixin._edit_tags`
respetando lo existente. **Vale la pena evaluar migrar el Genre Manager (y futuros managers de
style/mood/country) a estos mixins** en lugar de mantener el patching manual — reduciría código y
el riesgo de "pisar" tags existentes que ya menciona el CLAUDE.md como gotcha conocido.

Otros mixins de edición de campo simple (`editStudio`, `editOriginallyAvailable`, `editSummary`,
`editTitle`, `editSortTitle`, ratings) cubren casos que hoy se hacen ad-hoc con `.edit(**kwargs)`.

## 9. Resumen — oportunidades concretas para Plex Wizard

| Idea | API | Dónde encajaría |
|---|---|---|
| Aplicar "similar artists" de Last.fm a Plex | `addSimilarArtist`/`removeSimilarArtist` | Tab Last.fm de `EnrichModal` |
| Aplicar `studio` (sello) y `originallyAvailableAt` desde Discogs | `editStudio`, `editOriginallyAvailable` | `AlbumDiscogsModal` |
| Migrar Genre/Style/Mood/Country managers a mixins de alto nivel | `GenreMixin`/`StyleMixin`/`MoodMixin`/`CountryMixin` | Reemplaza patching manual en `db.py`/`main.py`, simplifica Genre Manager |
| Exponer `artist.guids` durante el scan (IDs externos ya embebidos) | `Artist.guids` | `audits/all_artists.py` — posible fuente extra de IDs para auto-link |
| Auto-fix en bulk con `fixMatch(auto=True)` | `UnmatchMatchMixin.fixMatch` | Posible acción masiva en Artists page |
| "Similar artists" basados en análisis sónico real (no solo tags externos) | `sonicallySimilar`, `hubs()` | Fuente adicional/alternativa para EnrichModal |
| Búsquedas tipadas más eficientes | `MusicSection.searchArtists/Albums/Tracks`, `.albums()` | Posibles optimizaciones en audits |

## Limitaciones observadas

- La doc de PMS API generalista lista soporte de "metadata providers" avanzado, pero nota que
  **las bibliotecas de música actualmente no soportan algunas de esas features avanzadas** (los
  agentes de música de Plex son más limitados que los de video — esto explica por qué el proyecto
  recurre a MusicBrainz/Discogs/Last.fm/Wikidata externos en vez de depender solo del agente de Plex).
- `Guid` solo expone un campo `id` (string `source://value>`) — no hay metadata adicional embebida,
  hay que resolver contra la fuente externa igualmente.
