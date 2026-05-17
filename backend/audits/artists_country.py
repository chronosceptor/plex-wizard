from plexapi.server import PlexServer


def artists_no_country(plex: PlexServer, library_name: str) -> list[dict]:
    section = plex.library.section(library_name)
    results = []
    for artist in section.all():
        countries = [c.tag for c in (artist.countries or [])]
        guid = getattr(artist, "guid", "") or ""
        secondary = [g.id for g in getattr(artist, "guids", [])]
        has_mbid = guid.startswith("mbid://") or any(g.startswith("mbid://") for g in secondary)
        if not countries:
            results.append({
                "ratingKey": artist.ratingKey,
                "title": artist.title,
                "guid": guid,
                "hasMbid": has_mbid,
                "genres": [g.tag for g in (artist.genres or [])],
                "viewCount": getattr(artist, "viewCount", 0) or 0,
                "thumb": bool(artist.thumb),
            })
    return results
