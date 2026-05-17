import re
import time
import requests

MB_API = "https://musicbrainz.org/ws/2"
MB_HEADERS = {
    "User-Agent": "PlexWizard/1.0 (plex-wizard-tool)",
    "Accept": "application/json",
}
_last_request = 0.0
_MAX_RETRIES = 3

_UUID_RE = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', re.IGNORECASE)


def _validate_mbid(mbid: str) -> None:
    if not _UUID_RE.match(mbid):
        raise ValueError(f"MBID inválido: {mbid!r}")


def _get(endpoint: str, params: dict) -> dict:
    """Rate-limited GET against MusicBrainz API (max 1 req/sec) with retry on transient errors.
    endpoint must be a safe relative path like 'artist/{uuid}' or 'release'.
    """
    global _last_request
    url = f"{MB_API}/{endpoint}"
    last_exc: Exception | None = None

    for attempt in range(_MAX_RETRIES):
        elapsed = time.monotonic() - _last_request
        if elapsed < 1.1:
            time.sleep(1.1 - elapsed)

        try:
            resp = requests.get(url, params=params, headers=MB_HEADERS, timeout=10)
            _last_request = time.monotonic()

            if resp.status_code == 429:
                wait = int(resp.headers.get("Retry-After", 5))
                time.sleep(wait)
                continue

            if resp.status_code >= 500:
                last_exc = requests.exceptions.HTTPError(response=resp)
                time.sleep(2 ** attempt)
                continue

            resp.raise_for_status()
            return resp.json()

        except (requests.exceptions.Timeout, requests.exceptions.ConnectionError) as e:
            _last_request = time.monotonic()
            last_exc = e
            time.sleep(2 ** attempt)

    raise last_exc or requests.exceptions.RetryError(
        f"MusicBrainz no respondió tras {_MAX_RETRIES} intentos"
    )


def _safe_str(val) -> str | None:
    """Return string or None — guards against null JSON values."""
    return str(val) if val is not None else None


def get_artist(mbid: str) -> dict:
    _validate_mbid(mbid)
    data = _get(f"artist/{mbid}", {"fmt": "json", "inc": "genres+tags"})

    area       = data.get("area") or {}
    begin_area = data.get("begin-area") or {}
    lifespan   = data.get("life-span") or {}
    genres_raw = data.get("genres") or []

    # Some MB entries have null inside the genres list — filter those out
    genres = [
        {"name": g.get("name"), "count": g.get("count") or 0}
        for g in genres_raw
        if isinstance(g, dict) and g.get("name")
    ]
    genres.sort(key=lambda x: x["count"], reverse=True)

    founded_raw = lifespan.get("begin") or ""
    founded = founded_raw[:4] if founded_raw else None

    return {
        "mbid":        mbid,
        "name":        _safe_str(data.get("name")),
        "type":        _safe_str(data.get("type")),
        "country":     _safe_str(area.get("name")),
        "countryCode": _safe_str(data.get("country")),
        "foundedIn":   _safe_str(begin_area.get("name")),
        "founded":     founded or None,
        "genres":      genres,
    }


def get_artist_releases(mbid: str, limit: int = 100) -> list[str]:
    _validate_mbid(mbid)
    data = _get("release", {
        "fmt": "json",
        "artist": mbid,
        "limit": limit,
    })
    releases = data.get("releases") or []
    return [r["title"] for r in releases if isinstance(r, dict) and r.get("title")]


def search_artists(name: str, limit: int = 5) -> list[dict]:
    """Search MusicBrainz for artists matching a name.
    Tries exact match first, falls back to fuzzy if no results.
    """
    def _fetch(query):
        data = _get("artist", {"query": query, "fmt": "json", "limit": limit})
        return [
            {
                "mbid":    a.get("id"),
                "name":    a.get("name"),
                "type":    a.get("type"),
                "score":   a.get("score", 0),
                "country": a.get("area", {}).get("name") if a.get("area") else None,
                "founded": ((a.get("life-span") or {}).get("begin") or "")[:4] or None,
            }
            for a in data.get("artists", [])
        ]

    results = _fetch(f'artist:"{name}"')
    if not results:
        # Fuzzy fallback — no quotes, broader match
        results = _fetch(name)
    return results
