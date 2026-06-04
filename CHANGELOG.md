# Changelog

Todos los cambios notables de este proyecto se documentan aquí.

## [Unreleased]

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
