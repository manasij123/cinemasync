"""Emergent Object Storage wrapper for CinemaSync.

Uploads files to Emergent Object Storage, returns a storage path which is
served back through our authenticated /api/files/{path} endpoint so we never
expose the storage key to the client.
"""
import os
import logging
import requests

logger = logging.getLogger(__name__)

STORAGE_URL = "https://integrations.emergentagent.com/objstore/api/v1/storage"
APP_NAME = "cinemasync"

_storage_key = None


def _key() -> str | None:
    return os.environ.get("EMERGENT_LLM_KEY")


def init_storage() -> str | None:
    """Initialise once at startup. Returns the storage_key (or None on failure)."""
    global _storage_key
    if _storage_key:
        return _storage_key
    emergent_key = _key()
    if not emergent_key:
        logger.warning("EMERGENT_LLM_KEY missing — object storage disabled")
        return None
    try:
        resp = requests.post(
            f"{STORAGE_URL}/init",
            json={"emergent_key": emergent_key},
            timeout=30,
        )
        resp.raise_for_status()
        _storage_key = resp.json()["storage_key"]
        logger.info("Object storage initialised")
        return _storage_key
    except Exception as e:
        logger.error(f"Storage init failed: {e}")
        return None


def put_object(path: str, data: bytes, content_type: str) -> dict:
    """Upload file. Returns {'path', 'size', 'etag'}."""
    key = init_storage()
    if not key:
        raise RuntimeError("Object storage unavailable")
    resp = requests.put(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key, "Content-Type": content_type},
        data=data,
        timeout=120,
    )
    resp.raise_for_status()
    return resp.json()


def get_object(path: str) -> tuple[bytes, str]:
    """Download file. Returns (bytes, content-type)."""
    key = init_storage()
    if not key:
        raise RuntimeError("Object storage unavailable")
    resp = requests.get(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key},
        timeout=60,
    )
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")
