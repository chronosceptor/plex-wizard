import re
from plexapi.server import PlexServer

# Patterns that indicate a multi-artist collaboration name
_COLLAB_RE = re.compile(
    r'(\s+(&|and|x|×|vs\.?|with|presents?|feat\.?|ft\.?)\s+|'
    r'\s*/\s*|'           # Stan Getz / João Gilberto
    r',\s+[A-Z])',        # Smallx, Saib  (comma + capital = likely multi-artist)
    re.IGNORECASE,
)


def is_collaboration(name: str) -> bool:
    return bool(_COLLAB_RE.search(name))


def artists_no_match(plex: PlexServer, library_name: str) -> list[dict]:
    section = plex.library.section(library_name)
    results = []
    for artist in section.all():
        guid = getattr(artist, 'guid', '') or ''
        if guid.startswith('local://'):
            results.append({
                "ratingKey":     artist.ratingKey,
                "title":         artist.title,
                "guid":          guid,
                "viewCount":     getattr(artist, 'viewCount', 0) or 0,
                "thumb":         bool(artist.thumb),
                "isCollaboration": is_collaboration(artist.title),
            })
    return results


def albums_no_match(plex: PlexServer, library_name: str) -> list[dict]:
    section = plex.library.section(library_name)
    results = []
    for album in section.albums():
        guid = getattr(album, 'guid', '') or ''
        if guid.startswith('local://'):
            results.append({
                "ratingKey":  album.ratingKey,
                "title":      album.title,
                "artist":     album.parentTitle,
                "year":       album.year,
                "guid":       guid,
                "trackCount": album.leafCount,
                "thumb":      bool(album.thumb),
            })
    return results
