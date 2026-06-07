# MusicBrainz API — qué información tenemos y qué más podríamos usar

Exploración de la [MusicBrainz API](https://musicbrainz.org/doc/MusicBrainz_API) enfocada en qué
datos de **artista** podemos usar para enrichment, partiendo de lo que `mb_client.py` ya extrae.

## 1. Lo que ya usamos (`mb_client.py`)

`get_artist(mbid)` hace `GET /artist/{mbid}?inc=genres+tags` y devuelve:
- `name`, `type` (Person/Group), `country`, `countryCode`
- `foundedIn` (begin-area), `founded` (año de `life-span.begin`)
- `genres` — lista `{name, count}` ordenada por votos

`get_artist_releases(mbid)` — solo títulos de releases (no se usa en `EnrichModal`/`ArtistEnrichSections`
actualmente, parece quedar para otro flujo).

`search_artists(name)` — búsqueda con fallback exacto→fuzzy, devuelve `mbid/name/type/score/country/founded`.

**Todo esto ya se aplica** vía `MusicBrainzSection` → `apply-mb` (país + 1 género seleccionable).

## 2. Lo que el `inc=` parameter puede traer y no estamos pidiendo

El lookup de artista soporta combinar varios `inc` en una sola llamada (`inc=genres+tags+aliases+url-rels+...`).
Hoy solo pedimos `genres+tags`. Lo más relevante que falta:

### `aliases` — nombres alternativos
Lista de variantes de nombre (`{name, locale, type, primary}`) — útil para detectar **artistas compuestos**
o para pre-rellenar el campo "+ Add component" en `CompoundLinksSection` con candidatos reales en vez de
nombre libre.

### `url-rels` — relaciones a URLs externas ⭐ muy relevante para este proyecto
MusicBrainz guarda links salientes tipados: **Discogs, Wikidata, sitio oficial, Bandcamp, redes sociales,
Wikipedia, last.fm**, etc. (`{type: "discogs"/"wikidata"/"official homepage"/..., url}`).

**Esto es directamente accionable**: si un artista ya está linkeado a MB, podríamos **auto-completar el
Discogs ID y/o el nombre de Last.fm leyendo `url-rels`** en lugar de obligar al usuario a buscar manualmente
en `DiscogsLinkModal`/`LastFMLinkModal`. Encaja perfecto con el flujo de "Service Links" descrito en
CLAUDE.md — sería una fuente adicional de auto-match con alta confianza (viene de MB, ya validado por
la comunidad).

### `artist-rels` — relaciones artista↔artista
Tipos como *member of band*, *collaboration*, *founder*, *composed by*... Para un Group, devuelve los
miembros (con fechas de inicio/fin); para un Person, las bandas en las que participa.

**Relevante para "compound artists"**: hoy `is_compound` se deriva manualmente del linkeo de componentes.
`artist-rels` de tipo *member of band* podría usarse como **sugerencia automática de componentes** cuando
se detecta que un artista de Plex en realidad agrupa a varios proyectos/colaboraciones.

### `ratings` / `tags` (vs `genres`)
- `tags` — folksonomía libre (lo que ya pedimos, pero no lo extraemos del JSON — solo `genres`, que es la
  versión "oficial"/curada de MB). Vale la pena revisar si `tags` trae algo que `genres` no.
- `ratings` — rating numérico de la comunidad MB (0-5). Mapearía directo a `audienceRating`/`rating` de Plex
  (ver doc de PlexAPI — `RatingMixin`/`AudienceRatingMixin`).

### `annotation`
Texto libre tipo wiki con contexto adicional sobre el artista — alternativa/complemento a la bio de
Last.fm/Discogs cuando esas no tienen datos.

## 3. Release Groups — más allá del artista

`get_artist_releases` hoy solo trae títulos. La entidad **Release Group** (agrupa todas las ediciones
de un álbum) expone:
- `first-release-date` — fecha real de primer lanzamiento (más confiable que el `year` de Plex/Discogs
  para un release específico)
- `primary-type`/`secondary-types` — Album / Single / EP / Compilation / Live / Soundtrack...
- Cover Art Archive (`https://coverartarchive.org/release-group/{mbid}`) — **artwork de alta calidad
  vinculado por MBID**, fuente potencial para rellenar `thumb`/`art` cuando Plex no tiene portada

Esto es más relevante para `ArtistDetail` → tabla de albums / `AlbumDiscogsModal` que para el artista en sí.

## 4. Resumen — oportunidades concretas

| Idea | Campo/endpoint MB | Dónde encajaría |
|---|---|---|
| Auto-completar Discogs ID / Last.fm name desde MB | `inc=url-rels` → `{type: "discogs"/"last.fm", url}` | `DiscogsLinkModal`/`LastFMLinkModal` — pre-rellenar candidato de alta confianza |
| Sugerir componentes de artistas compuestos | `inc=artist-rels` (member of band) | `CompoundLinksSection` — candidatos auto-sugeridos en vez de solo nombre libre |
| Nombres alternativos / variantes | `inc=aliases` | Mismo uso — pre-rellenar "+ Add component" |
| Rating de la comunidad MB | `inc=ratings` | `ArtistEnrichSections` — aplicar a `audienceRating`/`rating` vía `RatingMixin` |
| Fecha real de primer release + tipo (Album/EP/Live) | Release Group `first-release-date`/`primary-type` | `AlbumDiscogsModal` / tabla de albums — más preciso que `year` |
| Artwork de alta calidad | Cover Art Archive (vía release-group MBID) | Albums sin portada |
| Bio/contexto alternativo | `inc=annotation` | `MusicBrainzSection` cuando no hay bio de Last.fm/Discogs |

## Notas de implementación

- Todo esto se obtiene **en una sola llamada adicional** combinando `inc` params — no implica más requests
  al rate limit de 1 req/seg que ya respeta `mb_client._get`.
- `url-rels` es probablemente la mejora de mayor impacto/menor esfuerzo: convierte el "Service Links" de
  un proceso 100% manual a uno asistido por una fuente externa ya verificada.
