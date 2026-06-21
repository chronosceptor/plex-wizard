import os
import re
import requests

LASTFM_API = "https://ws.audioscrobbler.com/2.0/"


def _key() -> str:
    k = os.environ.get("LASTFM_API_KEY", "")
    if not k:
        raise ValueError("LASTFM_API_KEY no configurado en .env")
    return k


def _get(params: dict) -> dict:
    params = {**params, "api_key": _key(), "format": "json"}
    resp = requests.get(LASTFM_API, params=params, timeout=10)
    resp.raise_for_status()
    data = resp.json()
    if "error" in data:
        raise ValueError(f"Last.fm error {data['error']}: {data.get('message', '')}")
    return data


def _dict_field(data: dict, key: str) -> dict:
    """Last.fm returns "" instead of {} for absent nested fields (e.g. tags/wiki with no data)."""
    value = data.get(key)
    return value if isinstance(value, dict) else {}


def _clean_bio(raw: str) -> str:
    """Strip HTML tags and the 'Read more on Last.fm' trailer."""
    text = re.sub(r'<a\s[^>]*>.*?</a>', '', raw, flags=re.IGNORECASE | re.DOTALL)
    text = re.sub(r'<[^>]+>', '', text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text


def search_artists(name: str, limit: int = 8) -> list[dict]:
    data = _get({"method": "artist.search", "artist": name, "limit": limit})
    matches = data.get("results", {}).get("artistmatches", {}).get("artist", [])
    if isinstance(matches, dict):
        matches = [matches]
    return [
        {
            "name":      m.get("name"),
            "mbid":      m.get("mbid") or None,
            "url":       m.get("url"),
            "listeners": int(m.get("listeners") or 0),
        }
        for m in matches
        if m.get("name")
    ]


def get_artist(name: str, mbid: str | None = None) -> dict:
    params: dict = {"method": "artist.getInfo"}
    if mbid:
        params["mbid"] = mbid
    else:
        params["artist"] = name

    data = _get(params).get("artist", {})

    # Tags — can come as list or single dict
    tags_raw = _dict_field(data, "tags").get("tag", [])
    if isinstance(tags_raw, dict):
        tags_raw = [tags_raw]
    tags = [t["name"] for t in tags_raw if isinstance(t, dict) and t.get("name")]

    # Similar artists
    similar_raw = _dict_field(data, "similar").get("artist", [])
    similar = [s["name"] for s in similar_raw if isinstance(s, dict) and s.get("name")]

    bio_raw = _dict_field(data, "bio").get("summary", "") or ""
    bio = _clean_bio(bio_raw)

    stats = data.get("stats", {}) or {}
    return {
        "name":      data.get("name"),
        "mbid":      data.get("mbid") or None,
        "url":       data.get("url"),
        "tags":      tags,
        "similar":   similar[:10],
        "bio":       bio or None,
        "listeners": int(stats.get("listeners") or 0),
        "playcount": int(stats.get("playcount") or 0),
    }


