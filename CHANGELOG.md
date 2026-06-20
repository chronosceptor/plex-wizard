# Changelog

Todos los cambios notables de este proyecto se documentan aquí.

## [Unreleased]

### Added
- **Albums page** (`/albums`, `pages/Albums.jsx`): flat, library-wide album browsing and enrichment mirroring the Artists page — filters All/No Match/No MusicBrainz/No Discogs/No Artwork, MusicBrainz/Discogs/Last.fm columns with per-row quick actions, Plex deep-link.
- **`AlbumLastFMModal`**: enrich an album from Last.fm via a direct, deterministic artist+album lookup (no search/candidates step) — tags assignable exclusively to Style or Mood, plus bio.
- **`album_discogs_links` SQLite table** (`rating_key` unique) + `db.get_album_discogs_link`/`get_all_album_discogs_links`/`get_album_discogs_links_for_artist`: persists which Discogs release an album was matched to, since albums (unlike MusicBrainz) have no Plex-native field for it.
- **`all_albums` scan step** (`audits/all_albums.py`) and `GET /api/albums`/`GET /api/album/{rk}/status` — same caching/dev-limit pattern as artists; `DEV_ARTIST_LIMIT` now also caps album collection during local dev.
- **Shared `AlbumsTable.jsx`** component: the single album table implementation used by both the top-level Albums page and `ArtistDetail`'s Albums tab (`showArtist` prop toggles the artist subtitle).
- **`AlbumDetail.jsx` page** (`/albums/:ratingKey`): mirrors `ArtistDetail`'s tabbed architecture — Plex (editable, 5 tag groups since Album only supports `addGenre/addStyle/addMood/addCollection/addLabel`, no similar-artists/countries), MusicBrainz (inline match UI, no modal), Discogs and Last.fm (render the same Panels used by the table's quick-action modals). Breadcrumb links back to the parent artist.
- **`GET /api/album/{rk}/detail`** and **`PUT /api/album/{rk}/edit-metadata`**: single-album fetch and Plex metadata diff-and-apply endpoint, scoped to the 5 mixins Album actually supports.
- **Exclusive tag assignment UX** (`useTagAssignment`/`TagAssignChips`, in new shared `components/tagAssignment.jsx`): a Last.fm tag can be assigned to Style or Mood but never both, cycling unassigned → style → mood → unassigned on click; overlapping tags already present in Plex are highlighted. Used by both `ArtistEnrichSections`'s Last.fm tab and `AlbumLastFMModal`/`AlbumDetail`.
- **`ExpandableText`** (also in `tagAssignment.jsx`): collapsible long-text display for bios/reviews before applying them.
- **Editable Plex tab on `ArtistDetail`** (`?tab=plex`): genres/styles/moods/countries/collections/labels/similar-artists are now removable/addable chips and the bio is a textarea, with a sticky "Guardar cambios" / "Descartar cambios" bar that diffs against the loaded values and only submits what changed. New `PUT /api/artist/{rk}/edit-metadata` endpoint diffs each list against Plex's current tags and issues `add<Field>`/`remove<Field>` via PlexAPI's tag mixins (`addGenre`/`removeGenre`, etc.) plus `editSummary` for the bio — writes straight to Plex.
- **Side-by-side enrichment comparison** in `ArtistEnrichSections` (MusicBrainz/Last.fm/Discogs/Wikidata): every applicable field now shows Plex's current value on the left and the service's suggested value on the right (`CompareHeader`/`CompareRow`/`PlexChips`/`PlexText` helpers), so the user can see exactly what would change before applying.
- **`/api/artist/{rk}/albums` now returns full link/compound data** (`discogs_links`/`lastfm_links`/`mb_links`/`is_compound`/`discogs_id`/`lastfm_name`) — needed so `DiscogsSection` can detect an existing match and load it directly instead of showing the search UI.
- **Multi-artist linking for compound artists** (`compound_component_links` SQLite table, `UNIQUE(rating_key, component, service)`): an artist entry that's actually two or more artists (e.g. "Burial + Four Tet") can now be linked component-by-component to Discogs/Last.fm/MusicBrainz, any number of components.
- **`CompoundLinksSection`**: reusable component-link manager (load/add/remove links via a render-prop search panel), shared by all three service modals.
- **`GET/PUT/DELETE /api/artist/{rk}/compound-components`**: CRUD for component links.
- **`GET /api/mb-search?q=`**: direct MusicBrainz artist search, used for compound component linking independently of Plex's match agent.
- **`DEV_ARTIST_LIMIT` env var**: caps how many artists the scan loads, for faster local development.
- **Genre Manager** (`/genres`): consolidate genres across the library — view artists per genre, reassign/merge with autocomplete; `GET /api/genres`, `POST /api/genres/reassign`.
- **AlbumDiscogsModal**: enrich albums from Discogs releases (genres/styles/labels/notes), accessible from `ArtistDetail`.
- **ArtistDetail page** (`/artists/:ratingKey`): album table with status dots and per-album Fix Match / Discogs actions.
- **Wikidata + MusicBrainz tabs in EnrichModal**: country of origin via SPARQL; artist type/founding year/country/genres with community votes.
- **Plex deep-link**: "Plex ↗" button in the artists table, built from `machineIdentifier` (`/api/plex-info`).
- **`ArtistEnrichSections`**: artist enrichment now lives in-page on `ArtistDetail` as stacked sections (MusicBrainz · Last.fm · Discogs · Wikidata) instead of a modal — migrated from the now-removed `EnrichModal`.
- **Clickable artist names**: clicking an artist's name in the Artists table now navigates to `/artists/:ratingKey`.
- **MusicBrainz → Discogs/Last.fm auto-suggestion**: `mb_client.get_artist_url_relations()` parses MusicBrainz's outbound `url-rels` (`inc=url-rels`) to extract a high-confidence Discogs ID / Last.fm artist name from the community-curated cross-links. New `GET /api/artist/{rk}/mb-suggested-links` endpoint; `DiscogsLinkModal`/`LastFMLinkModal` show an orange "Suggested by MusicBrainz" card with a one-click "Use this" button when a candidate is found.
- **PlexAPI/MusicBrainz/Discogs/Last.fm enrichment exploration docs** (`docs/`): research notes on what each API can provide for enrichment, used to scope the artist-page rework and the MB auto-suggestion feature.

### Changed
- **`AlbumDiscogsModal`/`AlbumLastFMModal` split into a logic `Panel` (named export) + a thin modal shell (default export)**: `AlbumDiscogsPanel`/`AlbumLastFMPanel` hold all querying/comparison/apply logic and render identically whether wrapped in modal chrome (table quick-actions) or inline (`AlbumDetail` tabs) — one implementation, two presentations.
- **`AlbumDiscogsPanel` skips the search step when the album already has a linked `discogs_id`**, loading the release directly with a "Search another" / "Back to linked" toggle — same fix already applied to the artist-level Discogs section.
- **`ArtistEnrichSections` UI fully translated to English**, with bio text made expandable before applying and apply buttons consistently placed below the content they affect (previously inconsistent, some beside it).
- **`/api/artist/{rk}/albums` now also returns each album's `discogs_id`**, merged from `album_discogs_links`, so `AlbumsTable`/`AlbumDetail` don't need a separate request per album.
- **Compound status is now derived, not stored**: `is_compound` = artist has 2+ unique component names across its `compound_component_links` (any service). The manual single/compound toggle is gone — the system infers it purely from how many component artists you've actually linked.
- **`ArtistDetail` page is now full-width** and reuses `LinkedChip`/`LinkBtn` (exported from `Artists.jsx`) plus the three link modals directly in its header — clicking a service chip opens the same modal used from the Artists table, instead of duplicating match UI. The old per-artist status-dot row (match/country/genres/moods/photo/bio indicators) was removed from the header in favor of these actionable chips.
- **All three link modals unified**: `DiscogsLinkModal`, `LastFMLinkModal` and `MusicBrainzLinkModal` always render `CompoundLinksSection` — identical UX for single and compound artists; a single artist is simply one component.
- **Artists table chips unified** (`LinkedChip`): one green chip per service that opens its modal on click (replaces the old mixed external-link + "⋯" edit-button pattern); shows `"N <Service>"` when an artist links to multiple components.
- **`/api/artists` / `/api/artist/{rk}/status`**: now return `discogs_links` / `lastfm_links` / `mb_links` arrays of `{component, service_id}` plus derived `is_compound`; `discogs_id`/`lastfm_name` are kept as flat convenience fields (first linked component) for simple chip rendering.
- **`scan_manager.py`**: trimmed to a single `all_artists` step for local development speed (other steps commented out, summary stripped to `totalArtists`).
- **Genre Manager indexing**: `/api/genres` now iterates ALL genres per artist (not just primary); reassignment reads the full genre list, replaces the target genre and writes the whole list back — avoids corrupting multi-genre artists.
- **Artists page state**: `search`, `filter`, `page` live in `useSearchParams` — browser back restores the exact position; an active search shows all matching results unpaginated.
- **Artists page optimistic updates**: after closing a link modal, `/api/artist/:id/status` is fetched and merged into a local `overrides` map instead of refetching the whole artist list.
- UI strings translated to English across Layout sidebar and ScanGate messages.

### Fixed
- **`lastfm_client.py` crashed on artists/albums with no tag/similar/bio data**: Last.fm's API returns an empty string (`""`) instead of `{}` for absent nested fields, causing `'str' object has no attribute 'get'`. Added a `_dict_field()` guard applied wherever those fields are read.
- **`DiscogsSection` showed the search UI for already-linked artists**: `/api/artist/{rk}/albums` didn't expose `discogs_id`/`discogs_links` (only `/status` did), so the comparison section couldn't tell the artist was already matched. Now it checks `artist.discogs_id` first and loads the linked profile directly, with a "Buscar otro" / "Volver al vinculado" escape hatch for re-matching.
- **"Loading artists..." stuck indefinitely**: `/api/artists` had a fallback calling `section.all()` directly, ignoring `DEV_ARTIST_LIMIT` and racing the background scan. Removed the fallback (503 while no scan cache) and added an `allArtistsReady` guard to the frontend query.
- **Layout shift on load**: the "Scanning library..." message now renders inside `<tbody>` as a row so the table doesn't jump when it disappears.
- Semgrep SQL-injection warning in `db.py`'s `ALTER TABLE` migration loop — replaced the f-string loop with literal SQL statements.
- All external `<a target="_blank">` links carry `rel="noopener noreferrer"`.

### Removed
- `AlbumAudit.jsx`/`AlbumNoMatch.jsx` pages — superseded by the unified Albums page; their backend audit modules stay alive for the Dashboard.
- Regex-based compound-artist auto-detection (`looksCompound`, `parseComponents`, `CompoundComponents`) and the manual `is_compound`/`is_single` flags, columns and toggle — superseded by status derived from `compound_component_links`.
- `PUT /api/artist/{rk}/links/discogs|lastfm|compound|single`, `PUT /api/artists/bulk-compound`, `AutoMatchModal`, `FixMatchModal` — superseded by `MusicBrainzLinkModal` + `CompoundLinksSection`.
- `EnrichModal` — was orphaned (never imported), its 4 tabs were migrated into `ArtistEnrichSections` as in-page stacked sections on `ArtistDetail`.

### Security
- `db.py` migrates legacy `artist_links.discogs_id`/`lastfm_name` rows into `compound_component_links` (component name `'Primary'`) on startup, skipping artists that already have component links — no data lost in the schema transition.
