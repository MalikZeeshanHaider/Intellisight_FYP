"""
IntelliSight — MediaMTX HTTP API client.

MediaMTX owns the video path (RTSP → WebRTC/HLS). The Python AI service uses
this thin client to register each active camera as a MediaMTX path at start
time and unregister it on stop. All video delivery to browsers happens
directly from MediaMTX — Python is never in the video path.

API reference: https://bluenviron.github.io/mediamtx/
"""

import os
import requests
from typing import Optional

MEDIAMTX_API_URL = os.getenv('MEDIAMTX_API_URL', 'http://localhost:9997')
_TIMEOUT = 3.0  # seconds — API calls are local, keep short


def _path_name(camera_id: int) -> str:
    """Canonical MediaMTX path name for a camera."""
    return f"cam{camera_id}"


def _is_webcam(source: str) -> bool:
    """A numeric 'URL' or the literal 'webcam' means a local device, not RTSP.
    MediaMTX can't ingest a local V4L/DirectShow webcam without ffmpeg glue —
    so we skip registration for these and let the Python AI service keep
    reading them directly (no browser preview for webcams)."""
    if not source:
        return True
    s = source.strip().lower()
    return s.isdigit() or s == 'webcam'


def register_path(camera_id: int, rtsp_url: str) -> bool:
    """Register a camera as a MediaMTX path.

    Returns True on success (or if the path already exists), False otherwise.
    Never raises — callers treat video availability as best-effort; the AI
    pipeline keeps working even if MediaMTX is unreachable.
    """
    if _is_webcam(rtsp_url):
        print(f"[MediaMTX] Skipping webcam source for camera {camera_id} "
              f"(local device, not RTSP)")
        return False

    name = _path_name(camera_id)
    url = f"{MEDIAMTX_API_URL}/v3/config/paths/add/{name}"
    payload = {
        "source": rtsp_url,
        "sourceOnDemand": True,
        "rtspTransport": "tcp",
    }
    try:
        r = requests.post(url, json=payload, timeout=_TIMEOUT)
        if r.status_code in (200, 201):
            print(f"[MediaMTX] ✓ Registered path '{name}'")
            return True
        if r.status_code == 400 and 'already exists' in r.text.lower():
            # Path exists from a prior run — patch it to match the current URL
            return _patch_path(name, payload)
        print(f"[MediaMTX] ✗ Register failed for '{name}': "
              f"{r.status_code} {r.text[:200]}")
        return False
    except requests.RequestException as e:
        print(f"[MediaMTX] ✗ API unreachable at {MEDIAMTX_API_URL}: {e}")
        return False


def _patch_path(name: str, payload: dict) -> bool:
    url = f"{MEDIAMTX_API_URL}/v3/config/paths/patch/{name}"
    try:
        r = requests.patch(url, json=payload, timeout=_TIMEOUT)
        if r.status_code in (200, 201):
            print(f"[MediaMTX] ✓ Patched existing path '{name}'")
            return True
        print(f"[MediaMTX] ✗ Patch failed for '{name}': "
              f"{r.status_code} {r.text[:200]}")
        return False
    except requests.RequestException as e:
        print(f"[MediaMTX] ✗ Patch error: {e}")
        return False


def unregister_path(camera_id: int) -> bool:
    """Remove a camera's MediaMTX path. Idempotent."""
    name = _path_name(camera_id)
    url = f"{MEDIAMTX_API_URL}/v3/config/paths/delete/{name}"
    try:
        r = requests.delete(url, timeout=_TIMEOUT)
        if r.status_code in (200, 204, 404):
            return True
        print(f"[MediaMTX] ✗ Delete failed for '{name}': "
              f"{r.status_code} {r.text[:200]}")
        return False
    except requests.RequestException as e:
        print(f"[MediaMTX] ✗ Delete error: {e}")
        return False


def get_path_state(camera_id: int) -> Optional[dict]:
    """Return MediaMTX's runtime view of a path, or None if not found."""
    name = _path_name(camera_id)
    url = f"{MEDIAMTX_API_URL}/v3/paths/get/{name}"
    try:
        r = requests.get(url, timeout=_TIMEOUT)
        if r.status_code == 200:
            return r.json()
        return None
    except requests.RequestException:
        return None


def is_alive() -> bool:
    """Quick health probe used at service startup and /health endpoint."""
    try:
        r = requests.get(f"{MEDIAMTX_API_URL}/v3/paths/list",
                         timeout=_TIMEOUT)
        return r.status_code == 200
    except requests.RequestException:
        return False
