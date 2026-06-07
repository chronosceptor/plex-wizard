import os
from plexapi.server import PlexServer

_DEV_LIMIT = int(os.getenv("DEV_ARTIST_LIMIT", "0"))


def all_artists(plex: PlexServer, library_name: str) -> list[dict]:
    """Collect full artist list with metadata status for the unified Artists view."""
    section = plex.library.section(library_name)
    artists = section.all()
    if _DEV_LIMIT > 0:
        artists = artists[:_DEV_LIMIT]
    result = []
    for a in artists:
        guid = getattr(a, "guid", "") or ""
        secondary = [g.id for g in getattr(a, "guids", [])]
        mbid = None
        if guid.startswith("mbid://"):
            mbid = guid.replace("mbid://", "")
        else:
            for g in secondary:
                if g.startswith("mbid://"):
                    mbid = g.replace("mbid://", "")
                    break
        genres   = [g.tag for g in (a.genres   or [])]
        styles   = [s.tag for s in (getattr(a, "styles", None) or [])]
        moods    = [m.tag for m in (a.moods    or [])]
        countries = [c.tag for c in (a.countries or [])]
        result.append({
            "ratingKey":  a.ratingKey,
            "title":      a.title,
            "thumb":      bool(a.thumb),
            "guid":       guid,
            "mbid":       mbid,
            "isMatched":  mbid is not None,
            "genres":     genres,
            "styles":     styles,
            "moods":      moods,
            "country":    countries[0] if countries else None,
            "hasBio":     bool((a.summary or "").strip()),
            "albumCount": getattr(a, "childCount", None) or getattr(a, "albumCount", 0) or 0,
            "viewCount":  getattr(a, "viewCount", 0) or 0,
        })
    result.sort(key=lambda x: x["title"].lower())
    return result
