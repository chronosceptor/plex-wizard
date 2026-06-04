from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import os
import re
import random
import requests as _requests
from requests.exceptions import RequestException, Timeout as RequestTimeout
from plex_client import get_plex
from scan_manager import start_scan, get_status, get_results, get_step_result
from mb_client import get_artist as mb_get_artist, search_artists as mb_search_artists, get_artist_releases as mb_get_releases
from lastfm_client import get_artist as lfm_get_artist, search_artists as lfm_search_artists
import db as db
from discogs_client import (
    search_artists as dg_search_artists,
    get_artist as dg_get_artist,
    get_artist_releases as dg_get_releases,
    get_release as dg_get_release,
    search_releases as dg_search_releases,
)
from wikidata_client import get_artist_by_mbid as wd_get_artist

_UUID_RE = re.compile(
    r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
    re.IGNORECASE,
)

def _raise_for_external(e: Exception) -> None:
    """Convert external API network errors to 502/504 instead of 400."""
    if isinstance(e, RequestTimeout):
        raise HTTPException(status_code=504, detail=f"Timeout en API externa: {e}")
    if isinstance(e, RequestException):
        raise HTTPException(status_code=502, detail=f"Error en API externa: {e}")
    raise HTTPException(status_code=400, detail=str(e))


def _merge_tags(existing: list[str], new: list[str], limit: int = 12) -> list[str]:
    """Merge two tag lists, deduplicating case-insensitively and preserving order.
    Existing tags come first so prior enrichment is not discarded."""
    seen: dict[str, str] = {}
    for tag in existing + new:
        key = tag.lower()
        if key not in seen:
            seen[key] = tag
    return list(seen.values())[:limit]


def _safe_mbid(raw: str) -> str:
    """Validate and return the UUID portion of an mbid:// string.
    Raises HTTPException 400 if the format is invalid, preventing SSRF."""
    mbid = raw.replace("mbid://", "")
    if not _UUID_RE.match(mbid):
        raise HTTPException(status_code=400, detail="MBID inválido")
    return mbid

db.init_db()

app = FastAPI(title="Plex Wizard")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Libraries
# ---------------------------------------------------------------------------

@app.get("/api/artists")
def list_all_artists(library: str = Query(...)):
    """Return all artists merged with SQLite service links.
    Uses the scan cache for Plex data when available; SQLite links are always fresh.
    """
    cached = get_step_result(library, "all_artists")
    if cached is not None:
        plex_artists = cached
    else:
        plex = get_plex()
        try:
            section = plex.library.section(library)
            plex_artists = []
            for a in section.all():
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
                genres    = [g.tag for g in (a.genres  or [])]
                styles    = [s.tag for s in (getattr(a, "styles", None) or [])]
                moods     = [m.tag for m in (a.moods   or [])]
                countries = [c.tag for c in (a.countries or [])]
                plex_artists.append({
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
            plex_artists.sort(key=lambda x: x["title"].lower())
        except Exception as e:
            raise HTTPException(status_code=400, detail=str(e))

    all_links = db.get_all_links()
    return [
        {
            **a,
            "discogs_id":  all_links.get(a["ratingKey"], {}).get("discogs_id"),
            "lastfm_name": all_links.get(a["ratingKey"], {}).get("lastfm_name"),
        }
        for a in plex_artists
    ]


@app.get("/api/plex-info")
def plex_info():
    """Return Plex server base URL and machine identifier for constructing deep links."""
    plex = get_plex()
    return {
        "baseUrl":           os.environ.get("PLEX_URL", ""),
        "machineIdentifier": plex.machineIdentifier,
    }


@app.get("/api/artist/{rating_key}/status")
def artist_status(rating_key: int):
    """Return fresh metadata status for a single artist — called after modal actions to reflect changes instantly."""
    plex = get_plex()
    try:
        a = plex.fetchItem(rating_key)
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
        links = db.get_links(rating_key)
        return {
            "ratingKey":   a.ratingKey,
            "thumb":       bool(a.thumb),
            "guid":        guid,
            "mbid":        mbid,
            "isMatched":   mbid is not None,
            "genres":      [g.tag for g in (a.genres or [])],
            "styles":      [s.tag for s in (getattr(a, "styles", None) or [])],
            "moods":       [m.tag for m in (a.moods or [])],
            "country":     ([c.tag for c in (a.countries or [])] + [None])[0],
            "hasBio":      bool((a.summary or "").strip()),
            "discogs_id":  links["discogs_id"],
            "lastfm_name": links["lastfm_name"],
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/artist/{rating_key}/albums")
def artist_albums(rating_key: int):
    """Return artist detail + all their albums with metadata status."""
    plex = get_plex()
    try:
        artist = plex.fetchItem(rating_key)
        guid = getattr(artist, "guid", "") or ""
        secondary_a = [g.id for g in getattr(artist, "guids", [])]
        mbid_a = None
        if guid.startswith("mbid://"):
            mbid_a = guid.replace("mbid://", "")
        else:
            for g in secondary_a:
                if g.startswith("mbid://"):
                    mbid_a = g.replace("mbid://", "")
                    break

        albums = []
        for album in artist.albums():
            ag = getattr(album, "guid", "") or ""
            ag_sec = [g.id for g in getattr(album, "guids", [])]
            al_mbid = None
            if ag.startswith("mbid://"):
                al_mbid = ag.replace("mbid://", "")
            else:
                for g in ag_sec:
                    if g.startswith("mbid://"):
                        al_mbid = g.replace("mbid://", "")
                        break
            albums.append({
                "ratingKey":  album.ratingKey,
                "title":      album.title,
                "year":       getattr(album, "year", None),
                "thumb":      bool(album.thumb),
                "guid":       ag,
                "mbid":       al_mbid,
                "isMatched":  al_mbid is not None,
                "genres":     [g.tag for g in (album.genres or [])],
                "moods":      [m.tag for m in (album.moods or [])],
                "trackCount": getattr(album, "leafCount", None) or 0,
            })

        return {
            "ratingKey": artist.ratingKey,
            "title":     artist.title,
            "thumb":     bool(artist.thumb),
            "guid":      guid,
            "mbid":      mbid_a,
            "isMatched": mbid_a is not None,
            "genres":    [g.tag for g in (artist.genres or [])],
            "country":   ([c.tag for c in (artist.countries or [])] + [None])[0],
            "hasBio":    bool((artist.summary or "").strip()),
            "albums":    albums,
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/libraries")
def list_libraries():
    plex = get_plex()
    return [
        {"name": s.title, "type": s.type, "totalSize": s.totalSize}
        for s in plex.library.sections()
        if s.type == "artist"
    ]


# ---------------------------------------------------------------------------
# Service link endpoints (SQLite)
# ---------------------------------------------------------------------------

class DiscogsLinkPayload(BaseModel):
    discogs_id: int | None


class LastFMLinkPayload(BaseModel):
    lastfm_name: str | None


@app.put("/api/artist/{rating_key}/links/discogs")
def set_discogs_link(rating_key: int, payload: DiscogsLinkPayload):
    db.set_discogs(rating_key, payload.discogs_id)
    return {"success": True, "discogs_id": payload.discogs_id}


@app.put("/api/artist/{rating_key}/links/lastfm")
def set_lastfm_link(rating_key: int, payload: LastFMLinkPayload):
    name = payload.lastfm_name.strip() if payload.lastfm_name else None
    db.set_lastfm(rating_key, name)
    return {"success": True, "lastfm_name": name}


@app.get("/api/lastfm/search")
def lastfm_search(q: str = Query(...)):
    try:
        results = lfm_search_artists(q)
        return {"results": results}
    except Exception as e:
        _raise_for_external(e)


# ---------------------------------------------------------------------------
# Scan lifecycle
# ---------------------------------------------------------------------------

@app.post("/api/scan/start")
def scan_start(library: str = Query(...)):
    already_running = not start_scan(library)
    return {"started": not already_running, "alreadyRunning": already_running}


@app.get("/api/scan/status")
def scan_status(library: str = Query(...)):
    return get_status(library)


@app.get("/api/scan/results")
def scan_results(library: str = Query(...)):
    results = get_results(library)
    if results is None:
        raise HTTPException(status_code=404, detail="No scan results available. Run a scan first.")
    return results


# ---------------------------------------------------------------------------
# Individual audit endpoints (read from cache when available)
# ---------------------------------------------------------------------------

def _cached_or_error(library: str, key: str):
    result = get_step_result(library, key)
    if result is not None:
        return result
    status = get_status(library)
    if status.get("status") == "idle":
        raise HTTPException(status_code=404, detail="No hay scan en curso.")
    raise HTTPException(status_code=202, detail="Este paso aún no ha terminado.")


@app.get("/api/audit/summary")
def audit_summary(library: str = Query(...)):
    status = get_status(library)
    if status.get("status") != "done":
        raise HTTPException(status_code=404, detail="Scan no completado aún.")
    return status.get("summary", {})


@app.get("/api/audit/albums-no-artwork")
def audit_albums_no_artwork(library: str = Query(...)):
    return _cached_or_error(library, "albums_no_artwork")


@app.get("/api/audit/artists-no-genre")
def audit_artists_no_genre(library: str = Query(...)):
    return _cached_or_error(library, "artists_no_genre")


@app.get("/api/audit/artists-no-photo")
def audit_artists_no_photo(library: str = Query(...)):
    return _cached_or_error(library, "artists_no_photo")


@app.get("/api/audit/artists-no-country")
def audit_artists_no_country(library: str = Query(...)):
    return _cached_or_error(library, "artists_no_country")


@app.get("/api/audit/tracks-incomplete")
def audit_tracks_incomplete(library: str = Query(...)):
    return _cached_or_error(library, "tracks_incomplete")


@app.get("/api/audit/listening-stats")
def audit_listening_stats(library: str = Query(...)):
    return _cached_or_error(library, "listening_stats")


@app.get("/api/audit/artists-no-match")
def audit_artists_no_match(library: str = Query(...)):
    return _cached_or_error(library, "artists_no_match")


@app.get("/api/audit/albums-no-match")
def audit_albums_no_match(library: str = Query(...)):
    return _cached_or_error(library, "albums_no_match")


# ---------------------------------------------------------------------------
# Artist fix / metadata endpoints
# ---------------------------------------------------------------------------

@app.get("/api/artist/{rating_key}/matches")
def artist_matches(rating_key: int, query: str = Query(...)):
    plex = get_plex()
    try:
        artist = plex.fetchItem(rating_key)
        results = artist.matches(title=query)
        return [
            {
                "guid": r.guid,
                "name": r.name,
                "year": getattr(r, "year", None),
                "score": getattr(r, "score", None),
            }
            for r in results
        ]
    except HTTPException:
        raise
    except Exception as e:
        _raise_for_external(e)


class FixMatchPayload(BaseModel):
    guid: str
    name: str


@app.put("/api/artist/{rating_key}/fix-match")
def artist_fix_match(rating_key: int, payload: FixMatchPayload):
    plex = get_plex()
    try:
        artist = plex.fetchItem(rating_key)
        results = artist.matches(title=payload.name)
        target = next((r for r in results if r.guid == payload.guid), None)
        if not target:
            target = next((r for r in results if r.name == payload.name), None)
        if not target:
            raise HTTPException(status_code=404, detail="Match no encontrado")
        artist.fixMatch(searchResult=target)
        return {"success": True, "applied": payload.name, "guid": payload.guid}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


def _extract_mbid(artist) -> str | None:
    """Extract MusicBrainz UUID from artist GUIDs (primary or secondary)."""
    # Check primary guid first
    primary = getattr(artist, "guid", "") or ""
    if primary.startswith("mbid://"):
        return primary.replace("mbid://", "")
    # Newer Plex agent stores mbid in .guids list
    for g in getattr(artist, "guids", []):
        gid = getattr(g, "id", "") or ""
        if gid.startswith("mbid://"):
            return gid.replace("mbid://", "")
    return None


@app.get("/api/artist/{rating_key}/mb-data")
def artist_mb_data(rating_key: int):
    """Fetch artist data from MusicBrainz using the MBID stored in Plex."""
    plex = get_plex()
    try:
        artist = plex.fetchItem(rating_key)
        mbid = _extract_mbid(artist)
        if not mbid:
            raise HTTPException(status_code=400, detail="Este artista no tiene MBID. Usa Fix Match primero.")
        return mb_get_artist(mbid)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


class ApplyMBPayload(BaseModel):
    country: str | None = None
    genres: list[str] | None = None


@app.put("/api/artist/{rating_key}/apply-mb")
def artist_apply_mb(rating_key: int, payload: ApplyMBPayload):
    """Write country and/or genres from MusicBrainz directly into Plex.
    Uses artist.edit() so the URL is derived from the Plex object, not from user input.
    """
    plex = get_plex()
    try:
        artist = plex.fetchItem(rating_key)
        kwargs: dict = {}

        if payload.country:
            kwargs["country[0].tag.tag"] = payload.country
            kwargs["country[0].tag.locked"] = "1"

        if payload.genres:
            kwargs["genre[0].tag.tag"] = payload.genres[0]

        if not kwargs:
            raise HTTPException(status_code=400, detail="Nada que aplicar")

        artist.edit(**kwargs)
        return {"success": True, "applied": {"country": payload.country, "genres": payload.genres}}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


def _normalize_title(title: str) -> str:
    """Lowercase, remove punctuation and common suffixes for comparison."""
    t = title.lower()
    # Remove edition suffixes
    t = re.sub(r'\s*[\(\[](deluxe|remaster|remastered|edition|expanded|anniversary|bonus)[^\)\]]*[\)\]]', '', t)
    t = re.sub(r'[^\w\s]', ' ', t)
    return ' '.join(t.split())


def _confidence(plex_albums: list[str], mb_releases: list[str]) -> tuple[float, list[str]]:
    """Returns (score 0-1, list of matched Plex album titles)."""
    if not plex_albums:
        return 0.0, []
    plex_norm = {_normalize_title(a): a for a in plex_albums}
    mb_norm   = {_normalize_title(r) for r in mb_releases}
    matched_originals = [orig for norm, orig in plex_norm.items() if norm in mb_norm]
    score = len(matched_originals) / len(plex_albums)
    return round(score, 3), matched_originals


@app.get("/api/artist/{rating_key}/auto-match")
def artist_auto_match(rating_key: int):
    """Search MusicBrainz for this artist, compare album lists, return ranked candidates."""
    plex = get_plex()
    try:
        artist = plex.fetchItem(rating_key)
        plex_albums = [a.title for a in artist.albums()]

        candidates_raw = mb_search_artists(artist.title, limit=5)
        candidates = []

        for c in candidates_raw:
            mbid = c["mbid"]
            if not _UUID_RE.match(mbid):
                continue
            releases = mb_get_releases(mbid, limit=100)
            score, matched = _confidence(plex_albums, releases)
            candidates.append({
                **c,
                "confidence": score,
                "matchedAlbums": matched,
                "mbReleaseCount": len(releases),
            })

        candidates.sort(key=lambda x: x["confidence"], reverse=True)
        return {
            "artistTitle": artist.title,
            "plexAlbums": plex_albums,
            "candidates": candidates,
        }
    except HTTPException:
        raise
    except Exception as e:
        _raise_for_external(e)


@app.get("/api/artist/{rating_key}/guid")
def artist_guid(rating_key: int):
    """Return the artist's current GUID so the frontend can poll for match completion."""
    plex = get_plex()
    try:
        artist = plex.fetchItem(rating_key)
        mbid = _extract_mbid(artist)
        return {
            "guid": artist.guid,
            "isMatched": mbid is not None,
            "mbid": mbid,
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.put("/api/artist/{rating_key}/refresh")
def artist_refresh(rating_key: int):
    plex = get_plex()
    try:
        artist = plex.fetchItem(rating_key)
        artist.refresh()
        return {"success": True, "title": artist.title}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ---------------------------------------------------------------------------
# Last.fm endpoints
# ---------------------------------------------------------------------------

@app.get("/api/artist/{rating_key}/lastfm-data")
def artist_lastfm_data(rating_key: int):
    plex = get_plex()
    try:
        artist = plex.fetchItem(rating_key)
        mbid = _extract_mbid(artist)
        return lfm_get_artist(artist.title, mbid=mbid)
    except HTTPException:
        raise
    except Exception as e:
        _raise_for_external(e)


class ApplyLastFMPayload(BaseModel):
    styles:  list[str] | None = None   # applied as styles (merged)
    moods:   list[str] | None = None   # applied as moods (merged)
    similar: list[str] | None = None   # applied as similar artists (merged)
    bio:     str | None = None         # replaces summary


@app.put("/api/artist/{rating_key}/apply-lastfm")
def artist_apply_lastfm(rating_key: int, payload: ApplyLastFMPayload):
    plex = get_plex()
    try:
        artist = plex.fetchItem(rating_key)
        kwargs: dict = {}

        if payload.styles:
            existing = [s.tag for s in getattr(artist, "styles", []) or []]
            for i, style in enumerate(_merge_tags(existing, payload.styles)):
                kwargs[f"style[{i}].tag.tag"] = style

        if payload.moods:
            existing = [m.tag for m in (artist.moods or [])]
            for i, mood in enumerate(_merge_tags(existing, payload.moods)):
                kwargs[f"mood[{i}].tag.tag"] = mood

        if payload.similar:
            existing = [s.tag for s in getattr(artist, "similar", []) or []]
            for i, sim in enumerate(_merge_tags(existing, payload.similar, limit=10)):
                kwargs[f"similar[{i}].tag.tag"] = sim

        if payload.bio:
            kwargs["summary.value"] = payload.bio
            kwargs["summary.locked"] = "1"

        if not kwargs:
            raise HTTPException(status_code=400, detail="Nada que aplicar")
        artist.edit(**kwargs)
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        _raise_for_external(e)


# ---------------------------------------------------------------------------
# Wikidata endpoints
# ---------------------------------------------------------------------------

@app.get("/api/artist/{rating_key}/wikidata-data")
def artist_wikidata_data(rating_key: int):
    """Fetch artist country and links from Wikidata using the MBID stored in Plex."""
    plex = get_plex()
    try:
        artist = plex.fetchItem(rating_key)
        mbid = _extract_mbid(artist)
        if not mbid:
            raise HTTPException(status_code=400, detail="Este artista no tiene MBID. Usa Fix Match primero.")
        data = wd_get_artist(mbid)
        if data is None:
            raise HTTPException(status_code=404, detail="Artista no encontrado en Wikidata")
        return data
    except HTTPException:
        raise
    except Exception as e:
        _raise_for_external(e)


# ---------------------------------------------------------------------------
# Discogs endpoints
# ---------------------------------------------------------------------------

@app.get("/api/artist/{rating_key}/discogs-search")
def artist_discogs_search(rating_key: int):
    """Search Discogs for this artist and return candidates."""
    plex = get_plex()
    try:
        artist = plex.fetchItem(rating_key)
        candidates = dg_search_artists(artist.title, limit=5)
        return {"artistTitle": artist.title, "candidates": candidates}
    except HTTPException:
        raise
    except Exception as e:
        _raise_for_external(e)


@app.get("/api/discogs/artist/{discogs_id}")
def discogs_artist_detail(discogs_id: int):
    try:
        return dg_get_artist(discogs_id)
    except HTTPException:
        raise
    except Exception as e:
        _raise_for_external(e)


@app.get("/api/artist/{rating_key}/discogs-auto-match")
def artist_discogs_auto_match(rating_key: int):
    """Auto-match via Discogs: compare Plex albums with Discogs releases."""
    plex = get_plex()
    try:
        artist = plex.fetchItem(rating_key)
        plex_albums = [a.title for a in artist.albums()]
        candidates_raw = dg_search_artists(artist.title, limit=5)
        candidates = []
        for c in candidates_raw:
            dg_id = c["id"]
            releases_raw = dg_get_releases(dg_id, limit=100)
            release_titles = [r["title"] for r in releases_raw if r.get("title")]
            score, matched = _confidence(plex_albums, release_titles)
            candidates.append({
                **c,
                "confidence": score,
                "matchedAlbums": matched,
                "releaseCount": len(release_titles),
            })
        candidates.sort(key=lambda x: x["confidence"], reverse=True)
        return {"artistTitle": artist.title, "plexAlbums": plex_albums, "candidates": candidates}
    except HTTPException:
        raise
    except Exception as e:
        _raise_for_external(e)


@app.get("/api/album/{rating_key}/discogs-search")
def album_discogs_search(rating_key: int):
    """Search Discogs for an album to get genres/styles."""
    plex = get_plex()
    try:
        album = plex.fetchItem(rating_key)
        results = dg_search_releases(album.title, artist=album.parentTitle, limit=8)
        return {"albumTitle": album.title, "artist": album.parentTitle, "results": results}
    except HTTPException:
        raise
    except Exception as e:
        _raise_for_external(e)


class ApplyDiscogsPayload(BaseModel):
    genres: list[str] | None = None
    styles: list[str] | None = None
    labels: list[str] | None = None
    bio:    str | None = None


@app.get("/api/album/{rating_key}/discogs-detail")
def album_discogs_detail(rating_key: int, discogs_id: int = Query(...)):
    """Fetch full Discogs release detail (genres, styles, labels, notes) for a selected search result."""
    try:
        return dg_get_release(discogs_id)
    except HTTPException:
        raise
    except Exception as e:
        _raise_for_external(e)


@app.put("/api/album/{rating_key}/apply-discogs")
def album_apply_discogs(rating_key: int, payload: ApplyDiscogsPayload):
    """Apply Discogs metadata to a Plex album — genres, styles, labels, and review (all merged)."""
    plex = get_plex()
    try:
        album = plex.fetchItem(rating_key)
        kwargs: dict = {}
        if payload.genres:
            kwargs["genre[0].tag.tag"] = payload.genres[0]
        if payload.styles:
            existing = [s.tag for s in getattr(album, "styles", []) or []]
            for i, style in enumerate(_merge_tags(existing, payload.styles)):
                kwargs[f"style[{i}].tag.tag"] = style
        if payload.labels:
            existing = [l.tag for l in getattr(album, "labels", []) or []]
            for i, label in enumerate(_merge_tags(existing, payload.labels)):
                kwargs[f"label[{i}].tag.tag"] = label
        if payload.bio:
            kwargs["summary.value"] = payload.bio
            kwargs["summary.locked"] = "1"
        if not kwargs:
            raise HTTPException(status_code=400, detail="Nada que aplicar")
        album.edit(**kwargs)
        return {"success": True, "applied": (payload.genres or []) + (payload.styles or []) + (payload.labels or [])}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.put("/api/artist/{rating_key}/apply-discogs")
def artist_apply_discogs(rating_key: int, payload: ApplyDiscogsPayload):
    """Apply Discogs genres/styles/bio to a Plex artist.
    Discogs genres → Plex genre field (merged). Discogs styles → Plex style field (merged).
    """
    plex = get_plex()
    try:
        artist = plex.fetchItem(rating_key)
        kwargs: dict = {}
        if payload.genres:
            kwargs["genre[0].tag.tag"] = payload.genres[0]
        if payload.styles:
            existing = [s.tag for s in getattr(artist, "styles", []) or []]
            for i, style in enumerate(_merge_tags(existing, payload.styles)):
                kwargs[f"style[{i}].tag.tag"] = style
        if payload.bio:
            kwargs["summary.value"] = payload.bio
            kwargs["summary.locked"] = "1"
        if not kwargs:
            raise HTTPException(status_code=400, detail="Nada que aplicar")
        artist.edit(**kwargs)
        return {"success": True, "applied": (payload.genres or []) + (payload.styles or []), "bioApplied": bool(payload.bio)}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ---------------------------------------------------------------------------
# Album fix / metadata endpoints
# ---------------------------------------------------------------------------

@app.get("/api/album/{rating_key}/matches")
def album_matches(rating_key: int, query: str = Query(...)):
    plex = get_plex()
    try:
        album = plex.fetchItem(rating_key)
        results = album.matches(title=query)
        return [
            {
                "guid": r.guid,
                "name": r.name,
                "year": getattr(r, "year", None),
                "score": getattr(r, "score", None),
            }
            for r in results
        ]
    except HTTPException:
        raise
    except Exception as e:
        _raise_for_external(e)


@app.put("/api/album/{rating_key}/fix-match")
def album_fix_match(rating_key: int, payload: FixMatchPayload):
    plex = get_plex()
    try:
        album = plex.fetchItem(rating_key)
        results = album.matches(title=payload.name)
        target = next((r for r in results if r.guid == payload.guid), None)
        if not target:
            target = next((r for r in results if r.name == payload.name), None)
        if not target:
            raise HTTPException(status_code=404, detail="Match no encontrado")
        album.fixMatch(searchResult=target)
        return {"success": True, "applied": payload.name, "guid": payload.guid}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.put("/api/album/{rating_key}/refresh")
def album_refresh(rating_key: int):
    plex = get_plex()
    try:
        album = plex.fetchItem(rating_key)
        album.refresh()
        return {"success": True, "title": album.title}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ---------------------------------------------------------------------------
# Genre manager
# ---------------------------------------------------------------------------

@app.get("/api/genres")
def list_genres(library: str = Query(...)):
    """Return all genres with artist counts and artist lists, sorted by count desc."""
    plex = get_plex()
    try:
        section = plex.library.section(library)
        genre_map: dict[str, list[dict]] = {}
        no_genre_count = 0

        for a in section.searchArtists():
            genres = [g.tag for g in (a.genres or [])]
            entry = {"ratingKey": a.ratingKey, "title": a.title}
            if genres:
                for genre in genres:
                    genre_map.setdefault(genre, []).append(entry)
            else:
                no_genre_count += 1

        result = [
            {
                "name": name,
                "count": len(artists),
                "artists": sorted(artists, key=lambda x: x["title"].lower()),
            }
            for name, artists in genre_map.items()
        ]
        result.sort(key=lambda x: x["count"], reverse=True)
        return {"genres": result, "noGenre": no_genre_count}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


class ReassignGenrePayload(BaseModel):
    rating_keys: list[int]
    old_genre: str
    new_genre: str


@app.post("/api/genres/reassign")
def reassign_genre(payload: ReassignGenrePayload):
    """Replace old_genre with new_genre in the full genre list of selected artists."""
    new_genre = payload.new_genre.strip()
    old_genre = payload.old_genre.strip()
    if not new_genre:
        raise HTTPException(status_code=400, detail="El género no puede estar vacío")
    plex = get_plex()
    updated = 0
    errors = []

    for rk in payload.rating_keys:
        try:
            artist = plex.fetchItem(rk)
            current = [g.tag for g in (artist.genres or [])]
            if old_genre in current:
                updated_genres = [new_genre if g == old_genre else g for g in current]
            else:
                updated_genres = current + [new_genre]
            # Deduplicate while preserving order
            seen: set[str] = set()
            deduped = [g for g in updated_genres if not (g in seen or seen.add(g))]
            kwargs = {f"genre[{i}].tag.tag": g for i, g in enumerate(deduped)}
            artist.edit(**kwargs)
            updated += 1
        except Exception as e:
            errors.append({"ratingKey": rk, "error": str(e)})

    return {"updated": updated, "errors": errors}


# ---------------------------------------------------------------------------
# Playlist generator
# ---------------------------------------------------------------------------

@app.get("/api/playlist/tags")
def playlist_tags(library: str = Query(...), tag: str = Query("genre")):
    """Return available filter values (genres or countries) for the playlist builder."""
    plex = get_plex()
    try:
        section = plex.library.section(library)
        choices = section.listFilterChoices(tag)
        return sorted(
            [{"title": c.title} for c in choices if c.title],
            key=lambda x: x["title"].lower(),
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


class PlaylistFilters(BaseModel):
    genres:     list[str] | None = None
    yearFrom:   int | None = None
    yearTo:     int | None = None
    playedOnly: bool = False
    maxTracks:  int = 50
    shuffle:    bool = True


def _filter_tracks(section, filters: PlaylistFilters) -> list:
    """Return tracks matching the given filters."""
    genres = filters.genres or []

    if not genres:
        tracks_map: dict[int, object] = {}
        for track in section.searchTracks():
            tracks_map[track.ratingKey] = track
    else:
        tracks_map = {}
        for genre in genres:
            for track in section.searchTracks(genre=genre):
                tracks_map[track.ratingKey] = track

    tracks = list(tracks_map.values())

    if filters.yearFrom:
        tracks = [t for t in tracks if (getattr(t, 'parentYear', None) or 0) >= filters.yearFrom]
    if filters.yearTo:
        tracks = [t for t in tracks if (getattr(t, 'parentYear', None) or 9999) <= filters.yearTo]
    if filters.playedOnly:
        tracks = [t for t in tracks if (getattr(t, 'viewCount', None) or 0) > 0]

    if filters.shuffle:
        random.shuffle(tracks)
    else:
        tracks.sort(key=lambda t: (t.grandparentTitle or '', t.parentTitle or '', t.index or 0))

    return tracks[:filters.maxTracks]


@app.post("/api/playlist/preview")
def playlist_preview(library: str = Query(...), filters: PlaylistFilters = None):
    """Preview tracks that match the given filters without creating a playlist."""
    if filters is None:
        filters = PlaylistFilters()
    plex = get_plex()
    try:
        section = plex.library.section(library)
        tracks = _filter_tracks(section, filters)
        return {
            "total": len(tracks),
            "sample": [
                {
                    "title":       t.title,
                    "artist":      t.grandparentTitle,
                    "album":       t.parentTitle,
                    "year":        getattr(t, 'parentYear', None),
                    "viewCount":   getattr(t, 'viewCount', 0) or 0,
                }
                for t in tracks[:15]
            ],
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


class CreatePlaylistPayload(BaseModel):
    name:    str
    filters: PlaylistFilters


@app.post("/api/playlist/create")
def playlist_create(library: str = Query(...), payload: CreatePlaylistPayload = None):
    """Create a Plex playlist from the given filters."""
    if not payload or not payload.name.strip():
        raise HTTPException(status_code=400, detail="El nombre de la playlist no puede estar vacío")
    plex = get_plex()
    try:
        section = plex.library.section(library)
        tracks = _filter_tracks(section, payload.filters)
        if not tracks:
            raise HTTPException(status_code=400, detail="No hay tracks que coincidan con los filtros")
        playlist = plex.createPlaylist(payload.name.strip(), section=section, items=tracks)
        return {"success": True, "name": playlist.title, "trackCount": len(tracks)}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
