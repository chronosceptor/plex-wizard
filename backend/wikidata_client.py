import re
import time
import requests

SPARQL_ENDPOINT = "https://query.wikidata.org/sparql"
WIKIDATA_HEADERS = {
    "User-Agent": "PlexWizard/1.0 (plex-wizard-tool)",
    "Accept": "application/sparql-results+json",
}
_last_request = 0.0

_MBID_RE = re.compile(
    r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
    re.IGNORECASE,
)


def _sparql(query: str) -> list[dict]:
    global _last_request
    elapsed = time.monotonic() - _last_request
    if elapsed < 1.1:
        time.sleep(1.1 - elapsed)
    resp = requests.get(
        SPARQL_ENDPOINT,
        params={"query": query, "format": "json"},
        headers=WIKIDATA_HEADERS,
        timeout=15,
    )
    _last_request = time.monotonic()
    resp.raise_for_status()
    return resp.json().get("results", {}).get("bindings", [])


def get_artist_by_mbid(mbid: str) -> dict | None:
    """Return country and links for a MusicBrainz artist UUID via Wikidata SPARQL.
    MBID is validated against UUID regex before embedding in the query — no user-supplied
    strings reach the SPARQL endpoint.
    """
    if not _MBID_RE.match(mbid):
        raise ValueError(f"MBID inválido: {mbid!r}")

    query = f"""
SELECT ?item ?itemLabel ?countryLabel ?countryCode ?citizenshipLabel ?citizenshipCode ?wpUrl WHERE {{
  ?item wdt:P434 "{mbid}".
  OPTIONAL {{
    ?item wdt:P495 ?country.
    OPTIONAL {{ ?country wdt:P297 ?countryCode. }}
  }}
  OPTIONAL {{
    ?item wdt:P27 ?citizenship.
    OPTIONAL {{ ?citizenship wdt:P297 ?citizenshipCode. }}
  }}
  OPTIONAL {{
    ?wpUrl schema:about ?item.
    ?wpUrl schema:inLanguage "en".
    FILTER(STRSTARTS(STR(?wpUrl), "https://en.wikipedia.org/"))
  }}
  SERVICE wikibase:label {{ bd:serviceParam wikibase:language "en". }}
}} LIMIT 1
"""
    rows = _sparql(query)
    if not rows:
        return None

    row = rows[0]
    wikidata_url = row.get("item", {}).get("value", "")
    qid = wikidata_url.rsplit("/", 1)[-1] if wikidata_url else None

    country = row.get("countryLabel", {}).get("value")
    country_code = row.get("countryCode", {}).get("value")

    # Fallback to country of citizenship (P27) when country of origin (P495) is absent
    if not country:
        country = row.get("citizenshipLabel", {}).get("value")
        country_code = row.get("citizenshipCode", {}).get("value")

    # Discard Wikidata internal labels used when no human-readable label exists (e.g. "Q12345")
    if country and re.match(r'^Q\d+$', country):
        country = None
        country_code = None

    return {
        "wikidataId":   qid,
        "wikidataUrl":  wikidata_url or None,
        "wikipediaUrl": row.get("wpUrl", {}).get("value"),
        "name":         row.get("itemLabel", {}).get("value"),
        "country":      country,
        "countryCode":  country_code,
    }
