import threading
from datetime import datetime, timezone

from plex_client import get_plex
from audits.all_artists import all_artists
from audits.albums import albums_no_artwork
from audits.artists import artists_no_genre, artists_no_photo
from audits.artists_country import artists_no_country
from audits.tracks import tracks_incomplete
from audits.listening_stats import listening_stats
from audits.unmatched import artists_no_match, albums_no_match

STEPS = [
    ("all_artists",         "Vista de artistas",             all_artists),
    ("albums_no_artwork",   "Albums sin portada",            albums_no_artwork),
    ("artists_no_genre",    "Artistas sin género",           artists_no_genre),
    ("artists_no_photo",    "Artistas sin foto / bio",       artists_no_photo),
    ("artists_no_country",  "Artistas sin país",             artists_no_country),
    ("listening_stats",     "Stats de escucha",              listening_stats),
    ("artists_no_match",    "Artistas sin match",            artists_no_match),
    ("albums_no_match",     "Albums sin match",              albums_no_match),
    ("tracks_incomplete",   "Tracks con metadata incompleta", tracks_incomplete),
]

# { library_name -> scan state dict }
_cache: dict[str, dict] = {}
_lock = threading.Lock()


def get_status(library: str) -> dict:
    with _lock:
        return dict(_cache.get(library, {"status": "idle"}))


def get_results(library: str) -> dict | None:
    with _lock:
        entry = _cache.get(library)
        if entry and entry["status"] == "done":
            return entry["results"]
        return None


def get_step_result(library: str, key: str):
    """Returns a completed step's result even while other steps are still running."""
    with _lock:
        entry = _cache.get(library, {})
        steps = entry.get("steps", [])
        step = next((s for s in steps if s["key"] == key), None)
        if step and step["status"] == "done":
            return entry.get("results", {}).get(key)
        return None


def _make_steps() -> list[dict]:
    return [
        {"key": key, "label": label, "status": "pending", "duration": None}
        for key, label, _ in STEPS
    ]


def start_scan(library: str) -> bool:
    """Returns False if a scan is already running for this library."""
    with _lock:
        if _cache.get(library, {}).get("status") == "scanning":
            return False
        _cache[library] = {
            "status": "scanning",
            "totalSteps": len(STEPS),
            "steps": _make_steps(),
        }

    threading.Thread(target=_run, args=(library,), daemon=True).start()
    return True


def _run(library: str):
    import time
    try:
        plex = get_plex()
        results = {}

        for i, (key, label, fn) in enumerate(STEPS):
            with _lock:
                _cache[library]["steps"][i]["status"] = "running"

            t0 = time.monotonic()
            result = fn(plex, library)
            duration = round(time.monotonic() - t0)
            results[key] = result

            with _lock:
                _cache[library]["steps"][i]["status"] = "done"
                _cache[library]["steps"][i]["duration"] = duration
                # Guardamos el resultado inmediatamente para que el endpoint
                # individual funcione antes de que termine el scan completo
                if "results" not in _cache[library]:
                    _cache[library]["results"] = {}
                _cache[library]["results"][key] = result

        with _lock:
            _cache[library] = {
                "status": "done",
                "totalSteps": len(STEPS),
                "steps": _cache[library]["steps"],
                "results": results,
                "scannedAt": datetime.now(timezone.utc).isoformat(),
                "summary": {
                    "totalArtists":       len(results["all_artists"]),
                    "albumsNoArtwork":    len(results["albums_no_artwork"]),
                    "artistsNoGenre":     len(results["artists_no_genre"]),
                    "artistsNoPhoto":     len(results["artists_no_photo"]),
                    "artistsNoCountry":   len(results["artists_no_country"]),
                    "artistsNoMatch":     len(results["artists_no_match"]),
                    "albumsNoMatch":      len(results["albums_no_match"]),
                    "tracksIncomplete":   len(results["tracks_incomplete"]),
                    "artistsNeverPlayed": results["listening_stats"]["summary"]["neverPlayedCount"],
                },
            }
    except Exception as e:
        with _lock:
            _cache[library] = {"status": "error", "error": str(e)}
