# Changelog

Todos los cambios notables de este proyecto se documentan aquí.

## [Unreleased]

### Added
- **AlbumDiscogsModal**: nuevo componente para enriquecer albums desde Discogs. Flujo: buscar release → seleccionar → ver géneros/styles/labels/notes → aplicar por sección o todo. Accesible desde `ArtistDetail`.
- **ArtistDetail page** (`/artists/:ratingKey`): vista detalle del artista con tabla de todos sus albums, status dots (match, portada, géneros, moods) y acciones Fix Match + Discogs por album.
- **Wikidata tab en EnrichModal**: consulta país de origen vía SPARQL y permite aplicarlo a Plex.
- **MusicBrainz tab en EnrichModal**: muestra tipo de artista, año de fundación, país y géneros con votos desde MB API. Aplica país y/o géneros directamente.
- **Plex deep-link** en tabla de artistas: botón "Plex ↗" que abre el artista directamente en Plex Web (requiere `machineIdentifier` de `/api/plex-info`).
- Navegación a `ArtistDetail` al hacer click en el nombre de un artista en la tabla.
- Filtros adicionales en Artists: `no_styles`, `no_mood`, `no_photo`.

### Changed
- **EnrichModal** expandido de 2 tabs (Last.fm + Discogs) a 4 tabs (MusicBrainz · Last.fm · Discogs · Wikidata).
- **Artists.jsx**: patrón de actualización optimista con `overrides` local. Tras cerrar un modal, se hace fetch de `/api/artist/:id/status` y se mergea con los datos del servidor sin refetchar toda la lista.
- Discogs tab en EnrichModal ahora solo aplica bio (el perfil del artista en Discogs no tiene géneros/estilos — estos vienen de releases y se manejan por `AlbumDiscogsModal`).

### Fixed
- Todos los links externos (`<a target="_blank">`) tienen `rel="noopener noreferrer"` en todos los componentes.
