import os
import re
import time
import requests

DISCOGS_API = "https://api.discogs.com"
_last_request = 0.0

_ID_RE = re.compile(r'^\d+$')


def _headers() -> dict:
    token = os.environ.get("DISCOGS_TOKEN", "")
    h = {"User-Agent": "PlexWizard/1.0"}
    if token:
        h["Authorization"] = f"Discogs token={token}"
    return h


def _get(endpoint: str, params: dict | None = None) -> dict:
    global _last_request
    elapsed = time.monotonic() - _last_request
    # 60 req/min with token → 1 req/sec; 25/min without → 2.5 sec
    min_gap = 1.1 if os.environ.get("DISCOGS_TOKEN") else 2.6
    if elapsed < min_gap:
        time.sleep(min_gap - elapsed)
    url = f"{DISCOGS_API}/{endpoint}"
    resp = requests.get(url, params=params, headers=_headers(), timeout=10)
    _last_request = time.monotonic()
    resp.raise_for_status()
    return resp.json()


def _safe_id(raw_id) -> str:
    """Validate Discogs numeric ID to prevent path traversal."""
    s = str(raw_id)
    if not _ID_RE.match(s):
        raise ValueError(f"Discogs ID inválido: {s!r}")
    return s


def search_artists(name: str, limit: int = 5) -> list[dict]:
    data = _get("database/search", {"q": name, "type": "artist", "per_page": limit})
    return [
        {
            "id":    r.get("id"),
            "name":  r.get("title"),
            "thumb": r.get("thumb"),
            "url":   r.get("uri"),
        }
        for r in data.get("results", [])
        if r.get("id") and r.get("title")
    ]


def get_artist(artist_id: int | str) -> dict:
    safe_id = _safe_id(artist_id)
    data = _get(f"artists/{safe_id}")
    # Profile (bio) — Discogs uses plain text with [a=Artist] markup, strip it
    profile = re.sub(r'\[.*?\]', '', data.get("profile", "") or "").strip()
    return {
        "id":      data.get("id"),
        "name":    data.get("name"),
        "profile": profile or None,
        "urls":    data.get("urls", []),
    }


def get_artist_releases(artist_id: int | str, limit: int = 100) -> list[dict]:
    safe_id = _safe_id(artist_id)
    data = _get(f"artists/{safe_id}/releases", {"per_page": limit, "sort": "year", "sort_order": "asc"})
    releases = []
    for r in data.get("releases", []):
        if r.get("role") in ("Main", None) and r.get("title"):
            releases.append({
                "title": r.get("title"),
                "year":  r.get("year"),
                "type":  r.get("type"),
                "id":    r.get("id"),
            })
    return releases


def get_release(release_id: int | str) -> dict:
    safe_id = _safe_id(release_id)
    data = _get(f"releases/{safe_id}")
    # Deduplicate labels (same label can appear multiple times for different catalogue #s)
    labels_raw = [l.get("name") for l in (data.get("labels") or []) if l.get("name")]
    labels = list(dict.fromkeys(labels_raw))
    # Strip Discogs markup from notes/review
    notes_raw = data.get("notes", "") or ""
    notes = re.sub(r'\[.*?\]', '', notes_raw).strip() or None
    return {
        "id":      data.get("id"),
        "title":   data.get("title"),
        "year":    data.get("year"),
        "genres":  data.get("genres", []),
        "styles":  data.get("styles", []),
        "country": data.get("country"),
        "labels":  labels,
        "notes":   notes,
    }


def search_releases(query: str, artist: str | None = None, limit: int = 10) -> list[dict]:
    params: dict = {"q": query, "type": "release", "per_page": limit}
    if artist:
        params["artist"] = artist
    data = _get("database/search", params)
    return [
        {
            "id":      r.get("id"),
            "title":   r.get("title"),
            "year":    r.get("year"),
            "genres":  r.get("genre", []),
            "styles":  r.get("style", []),
            "country": r.get("country"),
            "label":   r.get("label", []),
            "thumb":   r.get("thumb"),
        }
        for r in data.get("results", [])
        if r.get("id") and r.get("title")
    ]
