from plexapi.server import PlexServer


def albums_no_artwork(plex: PlexServer, library_name: str) -> list[dict]:
    section = plex.library.section(library_name)
    results = []
    for album in section.albums():
        if not album.thumb:
            results.append({
                "ratingKey": album.ratingKey,
                "title": album.title,
                "artist": album.parentTitle,
                "year": album.year,
                "trackCount": album.leafCount,
            })
    return results
