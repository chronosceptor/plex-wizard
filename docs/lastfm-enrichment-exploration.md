# Last.fm API — qué información tenemos y qué más podríamos usar

Exploración de la [Last.fm API](https://www.last.fm/api) enfocada en qué datos de **artista** podemos
usar para enrichment, partiendo de lo que `lastfm_client.py` ya extrae.

## 1. Lo que ya usamos (`lastfm_client.py`)

`get_artist(name, mbid)` llama a `artist.getInfo` y devuelve:
- `name`, `mbid`, `url`
- `tags` — folksonomía (aplicable como styles/moods en `LastFMSection`)
- `similar` — top 10 artistas similares (nombres únicamente)
- `bio` — **summary** limpiado de HTML y del trailer "Read more on Last.fm"
- `listeners`, `playcount`

`search_artists(name)` — búsqueda simple `name/mbid/url/listeners`.

**Todo esto ya se aplica** vía `LastFMSection` → `apply-lastfm` (styles, moods, similar, bio).

## 2. Lo que `artist.getInfo` trae y no extraemos

La respuesta de `artist.getInfo` incluye más de lo que `get_artist()` mapea:

### Bio completa (`bio.content`) vs. resumen (`bio.summary`)
Hoy usamos `bio.summary` (texto corto, truncado con "Read more..."). El campo `bio.content` trae
**el texto completo** de la biografía. Podría ofrecerse como alternativa — p. ej. un toggle
"bio corta / bio completa" antes de aplicar a `summary` de Plex.

### `bio.published`
Fecha de publicación/última edición de la bio en Last.fm — informativo, poco accionable directamente.

### `ontour`
Flag booleano "¿está de gira actualmente?" — dato efímero, no parece encajar con el modelo de
metadata estática del proyecto (se desactualizaría rápido).

### `image` (array de URLs por tamaño)
**Importante matiz**: Last.fm decommissionó las imágenes de artista hace años — el array `image` casi
siempre viene vacío o con placeholders genéricos en `artist.getInfo`. No es una fuente confiable de
`thumb`/`art` (a diferencia de Discogs, que sí tiene imágenes reales).

## 3. Otros métodos de la API que podrían sumar

### `artist.getCorrection`
"Transforma nombres de artista mal escritos en el nombre correcto." Podría usarse como **paso previo
al matching** — si Plex tiene "Acid Pauli" mal tipeado, Last.fm podría sugerir la corrección antes
de buscar en MB/Discogs. Relevante para el flujo de "Fix Match" / búsqueda manual.

### `artist.getTopTags`
Tags más frecuentes para el artista — más completo que el array `tags` truncado de `getInfo`
(que viene limitado). Si `LastFMSection` necesita más variedad de styles/moods que aplicar, esta
llamada da una lista más rica con conteos de votos (similar a como se muestran los géneros de MB
en `MusicBrainzSection` con `g.count`).

### `artist.getSimilar`
Versión dedicada de "similares" — devuelve **score de similitud** (0-1) además del nombre, y permite
pedir más de 10. La lista que ya trae `getInfo.similar` está hardcodeada a los primeros 10 sin score;
`getSimilar` con `limit` mayor y el score visible podría mejorar la UI de "Artistas similares" en
`LastFMSection` (p. ej. mostrar el % de afinidad junto a cada chip).

### `artist.getTopAlbums` / `artist.getTopTracks`
Discografía y tracks más populares según scrobbles de la comunidad. Más relevante para
`ArtistDetail` → tabla de albums (podría destacar qué álbumes son los más escuchados/conocidos)
que para el artista en sí — o para una futura feature de "popularidad" en Albums/Tracks.

## 4. Resumen — oportunidades concretas

| Idea | Método/campo Last.fm | Dónde encajaría |
|---|---|---|
| Ofrecer bio completa además del resumen | `bio.content` (vs. `bio.summary` actual) | `LastFMSection` — toggle "bio corta/completa" antes de aplicar |
| Tags más ricos con conteo de votos | `artist.getTopTags` | `LastFMSection` — selector de tags como en `MusicBrainzSection` (géneros con `count`) |
| Similares con score de afinidad | `artist.getSimilar` (con `limit` y `match` score) | `LastFMSection` — mostrar % de similitud, pedir más de 10 |
| Sugerir corrección de nombre antes de buscar | `artist.getCorrection` | Flujo de Fix Match / búsqueda manual — pre-validación |
| Discografía/tracks populares | `artist.getTopAlbums`/`getTopTracks` | Posible feature futura en `ArtistDetail` (popularidad de albums) |

## Limitaciones a tener en cuenta

- **No usar Last.fm como fuente de imágenes** (`image` array) — el servicio dejó de proveer artwork
  de artista; los campos vienen vacíos o con placeholders. Discogs sigue siendo la fuente confiable
  de imágenes para este proyecto.
- `ontour` es un dato efímero — no aporta al modelo de metadata estática que persiste el proyecto.
- La API de Last.fm tiene rate limits informales (no documentados estrictamente) — `lastfm_client.py`
  no implementa throttling explícito hoy; si se agregan más llamadas (`getTopTags`, `getSimilar`,
  `getCorrection`) conviene revisar si hace falta espaciar requests como ya se hace con MB/Discogs.
