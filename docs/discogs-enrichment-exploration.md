# Discogs API — qué información tenemos y qué más podríamos usar

Exploración de la [Discogs API](https://www.discogs.com/developers) enfocada en qué datos podemos
usar para enrichment, partiendo de lo que `discogs_client.py` ya extrae.

> Nota: la página de developers de Discogs devolvió 403 al intentar leerla directamente (probablemente
> bloquea bots) — este análisis se basa en el código existente del cliente y en la estructura conocida
> de la API pública de Discogs (`database/search`, `artists/{id}`, `releases/{id}`, `masters/{id}`).
> Vale la pena verificar contra la doc oficial al implementar.

## 1. Lo que ya usamos (`discogs_client.py`)

`search_artists(name)` — `database/search?type=artist`: `id/name/thumb/url`.

`get_artist(id)` — `GET /artists/{id}`: `id/name/profile (bio limpia de markup)/urls`.
**Aplicado** vía `DiscogsSection` → `apply-discogs` (solo bio, como documenta CLAUDE.md: "artista en
Discogs solo tiene profile").

`get_artist_releases(id)` — lista de releases del artista (título/año/tipo/id), filtrando por `role`.
No parece consumirse desde `ArtistEnrichSections` directamente — probablemente alimenta el flujo de
`AlbumDiscogsModal`/búsqueda de releases.

`get_release(id)` — `GET /releases/{id}`: `genres/styles/country/labels (deduplicados)/notes`.
**Aplicado a nivel álbum** vía `AlbumDiscogsModal` (genres/styles/labels/notes), tal como documenta
CLAUDE.md sobre la distinción artista vs. release.

`search_releases(query, artist)` — búsqueda de releases con `genres/styles/country/label/thumb`.

## 2. Campos del Artist endpoint que no extraemos

`get_artist()` solo mapea `id/name/profile/urls`. La respuesta de `GET /artists/{id}` típicamente
incluye más:

### `namevariations`
Variantes de escritura del nombre (ej. "The Beatles" / "Beatles, The"). Igual que los `aliases` de
MusicBrainz — candidato útil para pre-rellenar componentes en `CompoundLinksSection`.

### `aliases` — otros nombres/proyectos de la misma entidad
A diferencia de `namevariations` (mismo nombre, distinta grafía), `aliases` en Discogs conecta
**entidades de artista distintas que son la misma persona/proyecto** bajo otro nombre
(`{id, name, resource_url}`). Esto es **directamente relevante para "compound artists"**: si Discogs
ya sabe que "Sven Väth" tiene un alias "Cyrus", esa relación podría sugerir componentes automáticamente.

### `members` (para grupos) / `groups` (para artistas individuales)
- Un grupo expone su lista de `members` (`{id, name, active: true/false, resource_url}`)
- Un artista individual expone los `groups` de los que forma parte

Igual que `artist-rels` de MusicBrainz (ver doc MB) — fuente de **sugerencias automáticas de
componentes** para artistas compuestos, con la ventaja de que Discogs suele tener esta data muy
completa para escenas electrónicas/under (un fuerte del catálogo de Discogs).

### `images`
Array de imágenes del artista (`{type: "primary"/"secondary", uri, width, height, uri150}`).
**A diferencia de Last.fm** (que decommissionó imágenes de artista), Discogs sí tiene fotos reales
y de buena calidad. Esto es una fuente potencial para `thumb`/`art` cuando el artista no tiene
portada en Plex — encaja con el dot "Sin foto" que ya muestra `ArtistDetail`.

### `data_quality`
Indicador de qué tan completa/curada está la entrada (`"Correct"`, `"Needs Vote"`, `"Entirely
Incorrect"`...). Útil como **señal de confianza** — al mostrar candidatos de búsqueda, podríamos
des-priorizar entradas con baja calidad de datos.

## 3. Master Release — la pieza que falta entre Artist y Release

`get_release(id)` opera sobre una **edición específica** (un pressing/formato/país concreto).
Discogs separa esto del concepto de **Master Release** (`masters/{id}`), que agrupa todas las
ediciones de un álbum y expone:

- `year` — año del **primer lanzamiento** (más confiable que el `year` de una edición específica,
  que puede ser un repress de décadas después)
- `main_release` — id de la edición "canónica" recomendada
- `genres`/`styles`/`tracklist`/`images` — a nivel de álbum, no de pressing
- `versions_url` — todas las ediciones/pressings disponibles

Cada `release` trae `master_id`/`master_url` cuando pertenece a un master. **Esto podría mejorar
`AlbumDiscogsModal`**: en vez de aplicar `genres/styles/year` de la primera edición que aparece en
la búsqueda, resolver primero el master y aplicar datos del lanzamiento original — más preciso y
consistente con lo que MusicBrainz llama "release group" / `first-release-date` (ver doc de MB).

## 4. Otros campos de Release que no extraemos

`get_release()` mapea `genres/styles/country/labels/notes`, pero la respuesta también trae:

- **`tracklist`** — posición/título/duración de cada track. Podría usarse para detectar discrepancias
  con los tracks de Plex (conteo, orden, nombres) — relevante para `audits/tracks.py`/`audits/albums.py`.
- **`formats`** — soporte físico/digital (`Vinyl`, `CD`, `File`...), cantidad, descripciones
  (`12"`, `Album`, `Reissue`...). Señal de qué tipo de edición es.
- **`images`** — portadas en alta resolución (igual que para artistas, fuente confiable de `thumb`/`art`)
- **`community`** — `{rating: {average, count}, have, want}` — popularidad/rating de la comunidad,
  mapeable a `audienceRating`/`rating` de Plex (ver `RatingMixin` en doc de PlexAPI)
- **`videos`** — links a videos relacionados (YouTube, etc.)

## 5. Resumen — oportunidades concretas

| Idea | Campo/endpoint Discogs | Dónde encajaría |
|---|---|---|
| Sugerir componentes de artistas compuestos | `aliases`, `members`/`groups` del artista | `CompoundLinksSection` — candidatos auto-sugeridos (fuerte del catálogo Discogs en escenas under/electrónica) |
| Foto de artista cuando Plex no tiene | `images` del artist endpoint | `ArtistEnrichSections`/`ArtistDetail` — resolver el dot "Sin foto" |
| Año/datos del lanzamiento original, no de un repress | `masters/{id}` — `year`, `main_release` | `AlbumDiscogsModal` — resolver master antes de aplicar genres/styles/year |
| Rating/popularidad de la comunidad | `community.rating` (release) | Mapear a `audienceRating` vía `RatingMixin` |
| Detectar discrepancias de tracklist | `tracklist` del release | `audits/tracks.py`/`audits/albums.py` — comparación con Plex |
| Variantes de nombre para matching | `namevariations` | Búsqueda/matching — mejorar candidatos en `DiscogsLinkModal` |
| Des-priorizar candidatos de baja calidad | `data_quality` | Lista de candidatos en `DiscogsSection`/`DiscogsLinkModal` — orden/badge de confianza |

## Notas de implementación

- Los endpoints de `artists/{id}` y `releases/{id}` ya devuelven estos campos en la respuesta actual
  (no requieren parámetros `inc` adicionales como MusicBrainz) — es cuestión de extender el mapeo en
  `get_artist()`/`get_release()`, no de pedir más datos a la API.
- Respetar el rate limit ya implementado en `_get()` (1 req/seg con token, 2.6 seg sin token) —
  cualquier llamada nueva (p. ej. resolver `masters/{id}`) se suma al mismo límite.
- `images` en Discogs puede no estar disponible para artistas/releases con poca documentación —
  siempre verificar antes de asumir que existe.
