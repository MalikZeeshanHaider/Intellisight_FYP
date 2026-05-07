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

# Face recognition settings - DeepFace with ArcFace + YuNet detector
MODEL_NAME = "ArcFace"  # ArcFace model — 512-D embeddings, angular margin loss
                         # More accurate than FaceNet, especially under lighting/angle variation.

# Distance metric — ArcFace embeddings are L2-normalised to the unit sphere,
# so cosine distance is the correct metric.
DISTANCE_METRIC = 'cosine'

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

# ArcFace cosine distance threshold.
# Same person: typically 0.20–0.45 | Different person: typically 0.55–1.00
# DeepFace's own verified threshold for ArcFace cosine = 0.6717.
# Using 0.68 to match that boundary and reject borderline matches.
DISTANCE_THRESHOLD = 0.68  # ArcFace cosine distance (0 = identical, 1 = orthogonal)
MIN_FACE_SIZE = 40  # Minimum face crop size (pixels) for recognition — NOT for detection frame
CONSECUTIVE_MATCHES = 2  # Matches needed before confirming identity
FRAME_SKIP = 3  # Legacy — kept for import compatibility; AI sampling now queue-driven

# ── Confidence threshold ───────────────────────────────────────────────────────
# Minimum single-frame confidence to call _handle_recognition (and write to DB).
#
#   confidence = max(0.0, 1 - distance / DISTANCE_THRESHOLD)
#
# With DISTANCE_THRESHOLD = 0.68 (ArcFace cosine):
#   distance 0.34 →  confidence 0.50  (strong match)
#   distance 0.48 →  confidence 0.30  (passes gate)
#   distance 0.55 →  confidence 0.19  (below gate — rejected)
#   distance 0.68 →  confidence 0.00  (at search cutoff)
#
# 0.30 requires cosine distance ≤ 0.476 — solidly within same-person range.
RECOGNITION_CONFIDENCE_THRESHOLD = 0.30   # cosine distance ≤ 0.476 passes

# ── EMA smoothing factor ────────────────────────────────────────────────────────
# Used in camera_streaming_service.py _handle_recognition.
# Lower α = smoother (more frames needed to confirm), less reactive to jitter.
EMA_ALPHA = 0.35   # was hardcoded 0.6 — reduced for stabler per-person EMA

# Folder paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
IMAGES_FOLDER = os.path.join(BASE_DIR, "images")
EMBEDDINGS_FOLDER = os.path.join(BASE_DIR, "embeddings")
EMBEDDINGS_FILE = os.path.join(EMBEDDINGS_FOLDER, "representations_arcface.json")

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

print(f"[CONFIG] Loaded: DB={DB_CONFIG['database']}, Model={MODEL_NAME}, Metric={DISTANCE_METRIC}, Threshold={DISTANCE_THRESHOLD}")
