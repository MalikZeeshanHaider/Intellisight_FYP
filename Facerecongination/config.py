"""
IntelliSight - Configuration for DeepFace-based Face Recognition
Uses FaceNet model via DeepFace library

*** CPU-OPTIMIZED SETTINGS ***
"""

import os
from dotenv import load_dotenv

# Load .env file from parent directory
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

# ── Startup validation ────────────────────────────────────────────────────────
_REQUIRED = ['DB_PASSWORD']
_missing = [k for k in _REQUIRED if not os.getenv(k)]
if _missing:
    raise RuntimeError(
        f"[FATAL] Missing required environment variables: {', '.join(_missing)}\n"
        "Create a .env file based on .env.example and set all required values."
    )
# ─────────────────────────────────────────────────────────────────────────────

# Database configuration
DB_CONFIG = {
    'host': os.getenv('DB_HOST', 'localhost'),
    'port': int(os.getenv('DB_PORT', 5000)),
    'database': os.getenv('DB_NAME', 'FYP_Intellisight'),
    'user': os.getenv('DB_USER', 'postgres'),
    'password': os.getenv('DB_PASSWORD')
}

# Face recognition settings - DeepFace with FaceNet + YuNet detector
MODEL_NAME = "Facenet"  # FaceNet model for embeddings (128-dimensional)

# Detector backend — controls which model locates faces in the frame.
#
#  "yunet"      Fast OpenCV DNN detector (~5-15 ms/frame on CPU). Model is
#               auto-downloaded by DeepFace on first use (~400 KB).
#               Best balance of speed + accuracy for live streaming on CPU.
#
#  "opencv"     Haar cascade (~3-5 ms/frame). Always available, no download,
#               but lower accuracy (more false positives, misses angled faces).
#               Used automatically as fallback if yunet fails.
#
#  "retinaface" Previous default. Excellent accuracy but ~100-200 ms/frame —
#               too slow for live streaming on CPU.
#
DETECTOR_BACKEND = "yunet"

# FaceNet euclidean distance threshold: lower = stricter matching
# NOTE: FaceNet512 uses larger distances (5-15 typical range)
# For Facenet (128D): typical range is 5-12 for unnormalized embeddings
DISTANCE_THRESHOLD = 8.0  # Stricter threshold for better accuracy
MIN_FACE_SIZE = 40  # Minimum face crop size (pixels) for recognition — NOT for detection frame
CONSECUTIVE_MATCHES = 2  # Matches needed before confirming identity
FRAME_SKIP = 3  # Legacy — kept for import compatibility; AI sampling now queue-driven

# ── Confidence threshold ───────────────────────────────────────────────────────
# Minimum recognition confidence [0.0 – 1.0] for a single-frame identification
# to be accepted and written to the database.
#
# Derivation:  confidence = max(0.0,  1 - distance / DISTANCE_THRESHOLD)
#   distance = 0.0       →  confidence = 1.00  (perfect match)
#   distance = 2.0 (25%) →  confidence = 0.75
#   distance = 4.0 (50%) →  confidence = 0.50
#   distance = 8.0 (100%)→  confidence = 0.00  (at threshold boundary)
#
# 0.75 means we only accept matches where distance ≤ 2.0  (top 25 % of the
# allowed range). This replaces the old consecutive-frame requirement:
# a single high-confidence hit is sufficient for immediate confirmation.
# Raise toward 0.90 for stricter environments; lower toward 0.65 if false
# negatives become a problem (e.g. poor lighting / side-on faces).
RECOGNITION_CONFIDENCE_THRESHOLD = 0.60   # distance ≤ 3.2 passes (was 0.75 → ≤ 2.0)

# Folder paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
IMAGES_FOLDER = os.path.join(BASE_DIR, "images")
EMBEDDINGS_FOLDER = os.path.join(BASE_DIR, "embeddings")
EMBEDDINGS_FILE = os.path.join(EMBEDDINGS_FOLDER, "representations_facenet.json")

# Unidentified face settings
UNIDENTIFIED_CONSECUTIVE = 5
UNIDENTIFIED_COOLDOWN = 60  # Seconds before re-detecting same unknown face
UNIDENTIFIED_SAVE_PATH = os.path.join(BASE_DIR, "unidentified_images")

# Cache settings
KNOWN_FACES_CACHE = os.path.join(BASE_DIR, "known_faces_cache.pkl")

# ── MediaMTX (video-only media server) ─────────────────────────────────────────
# MediaMTX is a separate process that owns the RTSP → WebRTC/HLS bridge. This
# service registers each active camera as a MediaMTX path via the HTTP API.
# The browser then pulls video from MediaMTX directly — Python is never in
# the video path.
MEDIAMTX_API_URL    = os.getenv('MEDIAMTX_API_URL',    'http://localhost:9997')
MEDIAMTX_WEBRTC_URL = os.getenv('MEDIAMTX_WEBRTC_URL', 'http://localhost:8889')

# Create necessary directories
for directory in [IMAGES_FOLDER, EMBEDDINGS_FOLDER, UNIDENTIFIED_SAVE_PATH]:
    if not os.path.exists(directory):
        os.makedirs(directory)
        print(f"[CONFIG] Created directory: {directory}")

print(f"[CONFIG] Loaded: DB={DB_CONFIG['database']}, Model={MODEL_NAME}, Threshold={DISTANCE_THRESHOLD}")
