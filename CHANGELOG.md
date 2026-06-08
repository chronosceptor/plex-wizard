# Changelog

Todos los cambios notables de este proyecto se documentan aquí.

## [Unreleased]

### Added
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
- **`DiscogsSection` showed the search UI for already-linked artists**: `/api/artist/{rk}/albums` didn't expose `discogs_id`/`discogs_links` (only `/status` did), so the comparison section couldn't tell the artist was already matched. Now it checks `artist.discogs_id` first and loads the linked profile directly, with a "Buscar otro" / "Volver al vinculado" escape hatch for re-matching.
- **"Loading artists..." stuck indefinitely**: `/api/artists` had a fallback calling `section.all()` directly, ignoring `DEV_ARTIST_LIMIT` and racing the background scan. Removed the fallback (503 while no scan cache) and added an `allArtistsReady` guard to the frontend query.
- **Layout shift on load**: the "Scanning library..." message now renders inside `<tbody>` as a row so the table doesn't jump when it disappears.
- Semgrep SQL-injection warning in `db.py`'s `ALTER TABLE` migration loop — replaced the f-string loop with literal SQL statements.
- All external `<a target="_blank">` links carry `rel="noopener noreferrer"`.

### Removed
- Regex-based compound-artist auto-detection (`looksCompound`, `parseComponents`, `CompoundComponents`) and the manual `is_compound`/`is_single` flags, columns and toggle — superseded by status derived from `compound_component_links`.
- `PUT /api/artist/{rk}/links/discogs|lastfm|compound|single`, `PUT /api/artists/bulk-compound`, `AutoMatchModal`, `FixMatchModal` — superseded by `MusicBrainzLinkModal` + `CompoundLinksSection`.
- `EnrichModal` — was orphaned (never imported), its 4 tabs were migrated into `ArtistEnrichSections` as in-page stacked sections on `ArtistDetail`.

### Security
- `db.py` migrates legacy `artist_links.discogs_id`/`lastfm_name` rows into `compound_component_links` (component name `'Primary'`) on startup, skipping artists that already have component links — no data lost in the schema transition.
