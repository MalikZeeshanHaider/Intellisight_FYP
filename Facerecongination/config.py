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
DISTANCE_THRESHOLD = 0.69  # ArcFace cosine distance (0 = identical, 1 = orthogonal)
MIN_FACE_SIZE = 20  # Minimum face crop size (pixels) for recognition — NOT for detection frame
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
RECOGNITION_CONFIDENCE_THRESHOLD = 0.25   # cosine distance ≤ 0.476 passes

# ── EMA smoothing factor ────────────────────────────────────────────────────────
# Used in camera_streaming_service.py _handle_recognition.
# Lower α = smoother (more frames needed to confirm), less reactive to jitter.
EMA_ALPHA = 0.35   # was hardcoded 0.6 — reduced for stabler per-person EMA

# ── Per-track embedding EMA alpha ─────────────────────────────────────────────
# Applied to the raw ArcFace embedding *before* nearest-neighbour search.
# Smoothing happens in unnormalized space; the blended vector is L2-normalized
# before searching so cosine similarity is unaffected.
#
#  α = 0.70 : 70 % old smooth + 30 % new frame (robust to motion blur)
#  α = 0.50 : equal weight   (faster to adapt, less jitter filtering)
#  α = 0.85 : very smooth    (slow walkers; still trails on sharp turns)
#
# Recommended range for a classroom corridor at ~3–5 FPS AI rate: 0.65–0.75.
EMBEDDING_EMA_ALPHA = 0.70

# ── Face crop sharpness gate ───────────────────────────────────────────────────
# Laplacian variance is computed on a 64×64 grayscale thumbnail of the face crop
# (cost ~0.2 ms, fixed regardless of original crop size).
# Crops below this value are motion-blurred or out-of-focus and produce
# inconsistent ArcFace embeddings that hurt recognition accuracy.
#
# Calibration guide (64×64 thumbnail Laplacian variance):
#   Stationary person   : 150 – 800+
#   Slow walk (~1 m/s)  :  60 – 200
#   Fast walk (~2 m/s)  :  20 –  80   ← threshold sits just below this range
#   Running / heavy blur :   5 –  25
#   Out of focus         :   2 –  15
#   Blank wall FP        :   0.5–  8
#
# 15.0 rejects only extremely blurry crops (running, severe camera shake).
# Raise to 25–40 if you want to reject walking-speed motion blur too.
SHARPNESS_THRESHOLD = 15.0

# ── Top-K voting recognition ───────────────────────────────────────────────────
# search_with_vote() finds the K nearest stored embeddings, tallies per-person
# votes, and applies a margin gate before accepting a match.
#
# KNN_K        — pool size.  With 5 enrolled images/person, K=5 lets a single
#                person fill the entire pool and get 5 votes.  K=3 is faster
#                and sufficient if persons have ≥ 2 enrolled images.
#
# KNN_VOTE_MIN — minimum votes required.  1 = same as search() but with margin
#                gate.  2 = requires at least 2 enrolled images to agree.
#                Use 2 only if every person has ≥ 3 enrolled images.
#
# KNN_MARGIN   — minimum cosine-distance gap between the best and second-best
#                person (person-level best, not raw embedding level).
#                0.08 catches cases where the query is between two identities.
#                Raise to 0.12 for stricter anti-confusion, lower to 0.05 to
#                allow matches where enrolled images cluster tightly together.
KNN_K        = 5     # top-K nearest embeddings for voting pool
KNN_VOTE_MIN = 2     # minimum votes to accept (raise to 2 with ≥3 images each)
KNN_MARGIN   = 0.08  # min cosine-distance gap between 1st and 2nd best person

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
