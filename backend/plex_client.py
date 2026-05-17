import os
from dotenv import load_dotenv
from plexapi.server import PlexServer

load_dotenv()

_server = None

def get_plex() -> PlexServer:
    global _server
    if _server is not None:
        try:
            _server.library.sections()
            return _server
        except Exception:
            _server = None

    url = os.environ.get("PLEX_URL", "")
    token = os.environ.get("PLEX_TOKEN", "")
    if not url or not token:
        raise ValueError("PLEX_URL and PLEX_TOKEN must be set in .env")

    _server = PlexServer(url, token, timeout=120)
    return _server
