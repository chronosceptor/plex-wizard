from plexapi.server import PlexServer


def tracks_incomplete(plex: PlexServer, library_name: str) -> list[dict]:
    section = plex.library.section(library_name)
    results = []
    for track in section.searchTracks():
        issues = []

        # Year lives at album level in Plex Music.
        # plexapi exposes track.year (track-level, almost always None for music).
        # The album year is in the raw XML as parentYear — access it directly.
        parent_year = track._data.get('parentYear')
        year = int(parent_year) if parent_year else getattr(track, 'year', None)
        if not year:
            issues.append("missing_year")

        # Album and artist titles should always exist; flag only if truly absent
        if not track.parentTitle:
            issues.append("missing_album")
        if not track.grandparentTitle:
            issues.append("missing_artist")

        # Note: genres in Plex Music are stored at artist level, not track level,
        # so we intentionally skip track.genres here to avoid false positives.

        if not issues:
            continue

        bitrate = None
        if track.media:
            bitrate = track.media[0].bitrate

        results.append({
            "ratingKey":  track.ratingKey,
            "title":      track.title,
            "artist":     track.grandparentTitle,
            "album":      track.parentTitle,
            "year":       year,   # album year (parentYear)
            "duration":   track.duration,
            "bitrate":    bitrate,
            "issues":     issues,
        })
    return results
