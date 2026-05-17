from datetime import datetime, timezone
from plexapi.server import PlexServer


def listening_stats(plex: PlexServer, library_name: str) -> dict:
    section = plex.library.section(library_name)
    artists = section.all()

    never_played = []
    played = []
    now = datetime.now(timezone.utc)

    for artist in artists:
        plays = getattr(artist, "viewCount", 0) or 0
        last_viewed = getattr(artist, "lastViewedAt", None)
        added_at = getattr(artist, "addedAt", None)

        days_since_play = None
        if last_viewed:
            lv = last_viewed if last_viewed.tzinfo else last_viewed.replace(tzinfo=timezone.utc)
            days_since_play = (now - lv).days

        days_in_library = None
        if added_at:
            aa = added_at if added_at.tzinfo else added_at.replace(tzinfo=timezone.utc)
            days_in_library = (now - aa).days

        entry = {
            "ratingKey": artist.ratingKey,
            "title": artist.title,
            "viewCount": plays,
            "lastViewedAt": last_viewed.isoformat() if last_viewed else None,
            "daysSincePlay": days_since_play,
            "daysInLibrary": days_in_library,
            "thumb": bool(artist.thumb),
        }

        if plays == 0:
            never_played.append(entry)
        else:
            played.append(entry)

    top_played = sorted(played, key=lambda x: x["viewCount"], reverse=True)[:20]
    stale = [a for a in played if a["daysSincePlay"] is not None and a["daysSincePlay"] > 180]
    stale.sort(key=lambda x: x["daysSincePlay"], reverse=True)

    return {
        "totalArtists": len(artists),
        "neverPlayed": never_played,
        "topPlayed": top_played,
        "stalePlayed": stale[:50],
        "summary": {
            "neverPlayedCount": len(never_played),
            "stalePlayed180dCount": len(stale),
            "totalPlays": sum(a["viewCount"] for a in played),
        },
    }
