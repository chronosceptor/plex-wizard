import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "artist_links.db")


def _connect():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


def _migrate_legacy_links(conn):
    """One-time migration: move artist_links.discogs_id/lastfm_name → compound_component_links."""
    rows = conn.execute(
        "SELECT rating_key, discogs_id, lastfm_name FROM artist_links "
        "WHERE discogs_id IS NOT NULL OR lastfm_name IS NOT NULL"
    ).fetchall()
    for row in rows:
        rk = row["rating_key"]
        existing = conn.execute(
            "SELECT COUNT(*) as cnt FROM compound_component_links WHERE rating_key = ?", (rk,)
        ).fetchone()["cnt"]
        if existing > 0:
            continue
        if row["discogs_id"] is not None:
            conn.execute("""
                INSERT OR IGNORE INTO compound_component_links (rating_key, component, service, service_id)
                VALUES (?, 'Primary', 'discogs', ?)
            """, (rk, str(row["discogs_id"])))
        if row["lastfm_name"] is not None:
            conn.execute("""
                INSERT OR IGNORE INTO compound_component_links (rating_key, component, service, service_id)
                VALUES (?, 'Primary', 'lastfm', ?)
            """, (rk, row["lastfm_name"]))


def init_db():
    with _connect() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS artist_links (
                rating_key   INTEGER PRIMARY KEY,
                discogs_id   INTEGER,
                lastfm_name  TEXT,
                is_compound  INTEGER DEFAULT 0,
                updated_at   TEXT DEFAULT (datetime('now'))
            )
        """)
        for stmt in (
            "ALTER TABLE artist_links ADD COLUMN discogs_id INTEGER",
            "ALTER TABLE artist_links ADD COLUMN lastfm_name TEXT",
            "ALTER TABLE artist_links ADD COLUMN is_compound INTEGER DEFAULT 0",
        ):
            try:
                conn.execute(stmt)
            except Exception:
                pass

        conn.execute("""
            CREATE TABLE IF NOT EXISTS compound_component_links (
                id           INTEGER PRIMARY KEY AUTOINCREMENT,
                rating_key   INTEGER NOT NULL,
                component    TEXT NOT NULL,
                service      TEXT NOT NULL,
                service_id   TEXT NOT NULL,
                updated_at   TEXT DEFAULT (datetime('now')),
                UNIQUE(rating_key, component, service)
            )
        """)

        _migrate_legacy_links(conn)


def get_all_component_links_grouped() -> dict:
    """Returns {rating_key: {"discogs": [...], "lastfm": [...], "musicbrainz": []}}."""
    with _connect() as conn:
        rows = conn.execute(
            "SELECT rating_key, component, service, service_id "
            "FROM compound_component_links ORDER BY rating_key, component, service"
        ).fetchall()
    result: dict = {}
    for row in rows:
        rk = row["rating_key"]
        if rk not in result:
            result[rk] = {"discogs": [], "lastfm": [], "musicbrainz": []}
        svc = row["service"]
        if svc in result[rk]:
            result[rk][svc].append({"component": row["component"], "service_id": row["service_id"]})
    return result


def get_all_links() -> dict:
    with _connect() as conn:
        rows = conn.execute(
            "SELECT rating_key, discogs_id, lastfm_name, is_compound FROM artist_links"
        ).fetchall()
    return {
        row["rating_key"]: {
            "discogs_id":  row["discogs_id"],
            "lastfm_name": row["lastfm_name"],
            "is_compound": bool(row["is_compound"]),
        }
        for row in rows
    }


def get_links(rating_key: int) -> dict:
    with _connect() as conn:
        row = conn.execute(
            "SELECT discogs_id, lastfm_name, is_compound FROM artist_links WHERE rating_key = ?",
            (rating_key,)
        ).fetchone()
    if row:
        return {
            "discogs_id":  row["discogs_id"],
            "lastfm_name": row["lastfm_name"],
            "is_compound": bool(row["is_compound"]),
        }
    return {"discogs_id": None, "lastfm_name": None, "is_compound": False}


def set_discogs(rating_key: int, discogs_id):
    with _connect() as conn:
        conn.execute("""
            INSERT INTO artist_links (rating_key, discogs_id, updated_at)
            VALUES (?, ?, datetime('now'))
            ON CONFLICT(rating_key) DO UPDATE SET
                discogs_id = excluded.discogs_id,
                updated_at = datetime('now')
        """, (rating_key, discogs_id))


def set_lastfm(rating_key: int, lastfm_name):
    with _connect() as conn:
        conn.execute("""
            INSERT INTO artist_links (rating_key, lastfm_name, updated_at)
            VALUES (?, ?, datetime('now'))
            ON CONFLICT(rating_key) DO UPDATE SET
                lastfm_name = excluded.lastfm_name,
                updated_at = datetime('now')
        """, (rating_key, lastfm_name))


def set_compound(rating_key: int, is_compound: bool):
    with _connect() as conn:
        conn.execute("""
            INSERT INTO artist_links (rating_key, is_compound, updated_at)
            VALUES (?, ?, datetime('now'))
            ON CONFLICT(rating_key) DO UPDATE SET
                is_compound = excluded.is_compound,
                updated_at = datetime('now')
        """, (rating_key, int(is_compound)))


def bulk_set_compound(rating_keys: list, is_compound: bool = True):
    with _connect() as conn:
        conn.executemany("""
            INSERT INTO artist_links (rating_key, is_compound, updated_at)
            VALUES (?, ?, datetime('now'))
            ON CONFLICT(rating_key) DO UPDATE SET
                is_compound = excluded.is_compound,
                updated_at = datetime('now')
        """, [(rk, int(is_compound)) for rk in rating_keys])


# ── Compound component links ──────────────────────────────────────────────────

def get_compound_components(rating_key: int) -> list:
    with _connect() as conn:
        rows = conn.execute(
            "SELECT component, service, service_id FROM compound_component_links WHERE rating_key = ? ORDER BY component, service",
            (rating_key,)
        ).fetchall()
    return [{"component": r["component"], "service": r["service"], "service_id": r["service_id"]} for r in rows]


def set_compound_component(rating_key: int, component: str, service: str, service_id: str):
    with _connect() as conn:
        conn.execute("""
            INSERT INTO compound_component_links (rating_key, component, service, service_id, updated_at)
            VALUES (?, ?, ?, ?, datetime('now'))
            ON CONFLICT(rating_key, component, service) DO UPDATE SET
                service_id = excluded.service_id,
                updated_at = datetime('now')
        """, (rating_key, component.strip(), service, service_id.strip()))


def delete_compound_component(rating_key: int, component: str, service: str):
    with _connect() as conn:
        conn.execute(
            "DELETE FROM compound_component_links WHERE rating_key = ? AND component = ? AND service = ?",
            (rating_key, component, service)
        )
