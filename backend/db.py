import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "artist_links.db")


def _connect():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    with _connect() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS artist_links (
                rating_key  INTEGER PRIMARY KEY,
                discogs_id  INTEGER,
                lastfm_name TEXT,
                updated_at  TEXT DEFAULT (datetime('now'))
            )
        """)


def get_all_links() -> dict:
    with _connect() as conn:
        rows = conn.execute(
            "SELECT rating_key, discogs_id, lastfm_name FROM artist_links"
        ).fetchall()
    return {
        row["rating_key"]: {
            "discogs_id":  row["discogs_id"],
            "lastfm_name": row["lastfm_name"],
        }
        for row in rows
    }


def get_links(rating_key: int) -> dict:
    with _connect() as conn:
        row = conn.execute(
            "SELECT discogs_id, lastfm_name FROM artist_links WHERE rating_key = ?",
            (rating_key,)
        ).fetchone()
    if row:
        return {"discogs_id": row["discogs_id"], "lastfm_name": row["lastfm_name"]}
    return {"discogs_id": None, "lastfm_name": None}


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
