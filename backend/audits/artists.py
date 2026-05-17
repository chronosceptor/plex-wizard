from plexapi.server import PlexServer


def artists_no_genre(plex: PlexServer, library_name: str) -> list[dict]:
    section = plex.library.section(library_name)
    results = []
    for artist in section.all():
        genres = [g.tag for g in (artist.genres or [])]
        if not genres:
            results.append({
                "ratingKey": artist.ratingKey,
                "title": artist.title,
                "genres": genres,
                "albumCount": artist.albumCount if hasattr(artist, "albumCount") else None,
            })
    return results


def artists_no_photo(plex: PlexServer, library_name: str) -> list[dict]:
    section = plex.library.section(library_name)
    results = []
    for artist in section.all():
        missing_thumb = not artist.thumb
        missing_bio = not (artist.summary or "").strip()
        if missing_thumb or missing_bio:
            results.append({
                "ratingKey": artist.ratingKey,
                "title": artist.title,
                "missingPhoto": missing_thumb,
                "missingBio": missing_bio,
                "albumCount": artist.albumCount if hasattr(artist, "albumCount") else None,
            })
    return results
