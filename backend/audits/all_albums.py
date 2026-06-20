import os
from plexapi.server import PlexServer

_DEV_LIMIT = int(os.getenv("DEV_ARTIST_LIMIT", "0"))


def all_albums(plex: PlexServer, library_name: str) -> list[dict]:
    """Collect full album list with metadata status for the unified Albums view."""
    section = plex.library.section(library_name)
    albums = section.albums()
    if _DEV_LIMIT > 0:
        albums = albums[:_DEV_LIMIT]
    result = []
    for al in albums:
        guid = getattr(al, "guid", "") or ""
        secondary = [g.id for g in getattr(al, "guids", [])]
        mbid = None
        if guid.startswith("mbid://"):
            mbid = guid.replace("mbid://", "")
        else:
            for g in secondary:
                if g.startswith("mbid://"):
                    mbid = g.replace("mbid://", "")
                    break
        genres = [g.tag for g in (al.genres or [])]
        styles = [s.tag for s in (getattr(al, "styles", None) or [])]
        moods  = [m.tag for m in (al.moods  or [])]
        result.append({
            "ratingKey":  al.ratingKey,
            "title":      al.title,
            "artist":     al.parentTitle,
            "year":       getattr(al, "year", None),
            "thumb":      bool(al.thumb),
            "guid":       guid,
            "mbid":       mbid,
            "isMatched":  mbid is not None,
            "genres":     genres,
            "styles":     styles,
            "moods":      moods,
            "trackCount": getattr(al, "leafCount", None) or 0,
        })
    result.sort(key=lambda x: (x["artist"].lower(), x["year"] or 0, x["title"].lower()))
    return result
