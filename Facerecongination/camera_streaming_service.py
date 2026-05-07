"""
IntelliSight - Face Recognition AI Service (metadata only)

Responsibility: detect + recognise faces from RTSP camera streams and broadcast
the results as JSON events over WebSocket. This service does NOT serve video
to browsers — that is MediaMTX's job (RTSP → WebRTC/HLS). Python is not in
the video path.

Architecture:
  RTSP camera  ─┬─▶ MediaMTX ─────────▶ browser <video> (WebRTC/WHEP)
                │
                └─▶ This service (AI) ─▶ /ws/events ─▶ browser canvas overlay
"""

import os
import sys
import cv2
import numpy as np
import json
import time
import threading
import gc
import queue
import signal
import atexit
import traceback
from flask import Flask, Response, jsonify, request, stream_with_context
from flask_cors import CORS
from flask_sock import Sock
from datetime import datetime
from deepface import DeepFace

# Fix Windows console encoding so Unicode characters (✓, ✅, ⚠, etc.) don't crash
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

# ── Exit diagnostics ──────────────────────────────────────────────────────────
# Silent process exit (prompt returns to shell with no traceback) is hard to
# debug. These hooks log the cause so the next termination tells us *why*.
def _log_exit():
    print(f"[EXIT] Camera service shutting down at {datetime.now().isoformat()}",
          flush=True)

def _log_signal(signum, _frame):
    name = signal.Signals(signum).name if hasattr(signal, 'Signals') else str(signum)
    print(f"[SIGNAL] Received {name} ({signum}) — exiting", flush=True)
    sys.exit(0)

def _log_uncaught(exc_type, exc_value, exc_tb):
    print("[FATAL] Uncaught exception in main thread:", flush=True)
    traceback.print_exception(exc_type, exc_value, exc_tb)

atexit.register(_log_exit)
sys.excepthook = _log_uncaught
for _sig in ('SIGINT', 'SIGTERM', 'SIGBREAK'):
    if hasattr(signal, _sig):
        try:
            signal.signal(getattr(signal, _sig), _log_signal)
        except (ValueError, OSError):
            pass   # not all signals are settable on all platforms

import psycopg2
from psycopg2.extras import RealDictCursor

from config import (
    DB_CONFIG, MODEL_NAME, DISTANCE_THRESHOLD, DISTANCE_METRIC, MIN_FACE_SIZE,
    RECOGNITION_CONFIDENCE_THRESHOLD, EMA_ALPHA, DETECTOR_BACKEND, FRAME_SKIP,
    MEDIAMTX_WEBRTC_URL,
)
from utils import load_embeddings_from_json, FPSCounter, preprocess_face_crop, EmbeddingIndex
from database_handler import DatabaseHandler
from event_bus import bus
import mediamtx_client

app = Flask(__name__)
CORS(app)
sock = Sock(app)

# Global variables
active_cameras  = {}    # {camera_id: CameraStream}
embeddings_data = []    # raw list — kept for len() / reload responses
embedding_index = None  # EmbeddingIndex — built once at startup
db_handler      = None

# Lock strategy
# ─────────────────────────────────────────────────────────────────────────────
# _tf_inference_lock — serialises ALL calls to DeepFace.represent() across
#   every camera thread.  TensorFlow's Keras model is NOT thread-safe for
#   concurrent inference in eager mode: two threads calling model(x) at the
#   same time can corrupt internal allocator state and trigger a C-level abort
#   that kills the process instantly (no Python traceback, no atexit).  One
#   lock call costs ~0-1ms overhead — far cheaper than a process crash.
#
# _reload_lock — protects the reload code path only.  Recognition threads
#   take a local snapshot of embedding_index before the DeepFace call so a
#   concurrent /embeddings/reload cannot swap the index mid-search.
# ─────────────────────────────────────────────────────────────────────────────
_tf_inference_lock = threading.Lock()   # ONE TF call at a time across all cameras
_reload_lock       = threading.Lock()

# Video frames are no longer pushed over WebSocket — MediaMTX owns video.
# Metadata events fan out via event_bus.bus (see /ws/events below).


# ============================================================================
# DETECTION SETTINGS
# ============================================================================
# DETECTOR_BACKEND, MIN_FACE_SIZE, RECOGNITION_CONFIDENCE_THRESHOLD imported from config
# ============================================================================
RECOGNITION_COOLDOWN   = 3.0    # Seconds between confirmed detections of the same person
MAX_CACHE_SIZE         = 100
FRAME_PROCESS_INTERVAL = FRAME_SKIP  # From config — process every Nth frame
RECONNECT_BASE_DELAY   = 2      # Starting backoff delay (seconds)
RECONNECT_MAX_DELAY    = 60     # Maximum backoff delay (seconds)
MAX_FRAME_QUEUE        = 1      # Drop stale frames immediately

# PERFORMANCE SETTINGS - Optimized for 720p @ 15fps input
TARGET_WIDTH  = 1280   # Display / stream width  (720p)
TARGET_HEIGHT = 720    # Display / stream height

# Detection frame — the small frame fed to the face detector.
# Smaller = faster detection with less CPU.  We scale coordinates back to
# TARGET resolution after detection, so stream quality is unaffected.
# 320×180 (16:9) gives ~5-10 ms/frame with YuNet vs ~100-200 ms with RetinaFace.
PROCESS_WIDTH  = 320   # was 480 — 56 % fewer pixels to scan
PROCESS_HEIGHT = 180   # was 270 — maintains 16:9 aspect ratio

# Minimum face size in the DETECTION frame (PROCESS_WIDTH × PROCESS_HEIGHT).
# Kept separate from config.MIN_FACE_SIZE which governs the full-resolution
# face crop used for embedding.  At 320×180, a 20 px face is already quite
# small (~11 % of frame height), so anything smaller is likely noise.
DETECT_MIN_PX = 20

FACE_SIZE = 160   # FaceNet input size — do not change

# ── Motion-detection pre-filter constants ─────────────────────────────────────
# Mean pixel change (0-255) in the 320×180 grayscale frame between consecutive
# AI frames.  Static empty corridor: ~1-3.  Person walking: ~10-50.
MOTION_THRESHOLD   = 5.0   # below this → scene is static, skip detector
STATIC_SKIP_AFTER  = 15    # only engage gate after N consecutive empty frames

# ── Detector quality gates ────────────────────────────────────────────────────
# YuNet returns a per-detection confidence in [0.0, 1.0]. Real human faces
# usually score > 0.85; texture / corner / shadow false positives sit in
# 0.50–0.80. A 0.85 threshold near-eliminates ceiling-and-wall false hits
# without rejecting real (even side-on) faces.
FACE_DETECT_CONFIDENCE = 0.85

# Crops that are nearly black (IR night frame with no subject) or nearly
# uniform (blank wall) cannot be real faces. Use mean-brightness and
# standard-deviation gates on the cropped grayscale to discard them before
# they ever reach the embedding model or the unknown-faces table.
CROP_MIN_MEAN_BRIGHTNESS = 25   # 0–255 — full-black IR frames sit below ~15
CROP_MIN_STD_DEV         = 18   # uniform regions (walls/ceilings) sit below ~10

# ── Low-latency RTSP / FFMPEG options ────────────────────────────────────────
# Applied via OPENCV_FFMPEG_CAPTURE_OPTIONS (key;value|key;value format).
#
#  fflags;nobuffer        Disable FFMPEG's internal receive buffer.  Frames
#                         are handed to OpenCV as soon as they are decoded,
#                         not held until the buffer fills.
#  flags;low_delay        Enable H.264 low-delay decoding mode — skips the
#                         B-frame reorder buffer (common source of 1–2 s lag).
#  stimeout;5000000       5 s network timeout in microseconds (was 10 s).
#  max_delay;500000       Cap internal queuing delay at 0.5 s (microseconds).
#  analyzeduration;100000 Spend only 0.1 s analyzing stream format on connect
#                         (was 2 s — large contributor to initial delay).
#  probesize;32768        Read only 32 KB while probing codec info (was 500 KB).
# ─────────────────────────────────────────────────────────────────────────────
_RTSP_FFMPEG_OPTS = (
    'rtsp_transport;tcp|'
    'rtsp_flags;prefer_tcp|'
    'fflags;nobuffer|'
    'flags;low_delay|'
    'stimeout;5000000|'
    'max_delay;500000|'
    'analyzeduration;100000|'
    'probesize;32768'
)


class CameraStream:
    """Handles individual camera RTSP stream with face recognition - CPU OPTIMIZED"""
    
    def __init__(self, camera_id, camera_url, camera_type, zone_id):
        self.camera_id = camera_id
        self.camera_url = camera_url.strip() if camera_url else ""
        self.camera_type = camera_type
        self.zone_id = zone_id
        self.cap = None
        self.is_running = False
        self.fps_counter = FPSCounter()
        self.last_recognition_time = {}
        self.recognized_persons = []
        self.frame_count = 0

        # Cache for most recent detection result (used by /cameras/status for diagnostics)
        self.cached_faces = []
        self.last_detection_frame = 0

        # Resolution AI is operating in — published with each detection event so
        # the browser can scale bbox coordinates to its <video> element size.
        self._ai_frame_w = TARGET_WIDTH
        self._ai_frame_h = TARGET_HEIGHT

        # Latest decoded frame — used by the MJPEG /stream/<id> fallback endpoint.
        # Written by the RTSP reader thread, read by Flask request threads.
        self._latest_frame = None
        self._frame_lock   = threading.Lock()

        # ── Confidence EMA cache ───────────────────────────────────────────────
        # Short-term exponential moving average of recognition confidence per
        # person.  Smooths single-frame jitter without adding blocking delays:
        #   ema_new = α × confidence_new + (1 − α) × ema_old  (α = 0.6)
        # A borderline first reading decays slightly; a consistent high reading
        # stays high.  Keyed by person_key; cleared in stop().
        self._conf_ema = {}   # {person_key: float}

        # ── Motion-detection pre-filter ────────────────────────────────────────
        # Comparing consecutive detection frames (320×180 grayscale) lets us skip
        # the yunet detector entirely on truly static scenes — empty corridors,
        # parked cameras pointing at walls, etc.  Only engaged after
        # STATIC_SKIP_AFTER consecutive frames with no face to avoid suppressing
        # detection of someone who just walked in and stopped.
        self._prev_gray      = None   # previous grayscale detection frame
        self._no_face_streak = 0      # consecutive AI frames with zero faces

        # ── Recognition summary timer ──────────────────────────────────────────
        self._last_summary_t = time.time()
        self._summary_matches = 0     # confirmed DB writes since last summary

        # ── AI worker queue (RTSP reader → AI thread) ─────────────────────────
        # Producer : _rtsp_reader_loop calls _enqueue_for_ai() after each decoded frame.
        # Consumer : _ai_loop        blocks on ai_queue.get(timeout=…) and calls _run_ai().
        #
        # maxsize=1 enforces the "most-recent frame only" guarantee:
        #   • If the AI worker is still processing the previous frame when a new
        #     one arrives, the stale frame is evicted and the fresh one takes its
        #     place — the AI never builds a backlog of delayed frames.
        #   • If the queue is empty the capture thread just adds the frame without
        #     blocking — the AI worker picks it up as soon as it is free.
        #
        # This is the drain-replace (swap) pattern: see _enqueue_for_ai().
        self.ai_queue = queue.Queue(maxsize=1)

        # ── Queue metrics (written by capture + AI threads, read by /cameras/status) ──
        self.ai_frames_produced = 0   # unique frames offered to the queue
        self.ai_frames_dropped  = 0   # stale frames evicted because AI was busy
        self.ai_frames_consumed = 0   # frames actually pulled and processed by AI

        # Connect to camera
        self.connect()

        # Start AI background thread — runs independently of capture success.
        # If camera failed to connect, is_running=False and the thread exits immediately.
        self._ai_thread = threading.Thread(target=self._ai_loop, daemon=True,
                                           name=f"cam{self.camera_id}-ai")
        self._ai_thread.start()
    
    def connect(self):
        """Connect to RTSP camera or webcam with enhanced support"""
        import os
        
        # Check if this is a webcam (integer or "0", "1" etc)
        is_webcam = False
        webcam_id = 0
        
        if self.camera_url.isdigit():
            is_webcam = True
            webcam_id = int(self.camera_url)
        elif self.camera_url.lower() == "webcam":
            is_webcam = True
            webcam_id = 0
        
        if is_webcam:
            print(f"[Camera {self.camera_id}] Connecting to webcam {webcam_id}...")
            try:
                cap = cv2.VideoCapture(webcam_id)
                cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
                if cap.isOpened():
                    ret, frame = cap.read()
                    if ret and frame is not None:
                        self.cap = cap
                        self.is_running = True
                        print(f"[Camera {self.camera_id}] ✓ Webcam connected! Frame: {frame.shape[1]}x{frame.shape[0]}")
                        self._start_threads()
                        return True
                cap.release()
            except Exception as e:
                print(f"[Camera {self.camera_id}] Webcam error: {e}")
            return False

        # ── RTSP camera connection ─────────────────────────────────────────────
        # Apply low-latency FFMPEG options BEFORE creating VideoCapture.
        os.environ['OPENCV_FFMPEG_CAPTURE_OPTIONS'] = _RTSP_FFMPEG_OPTS

        print(f"[Camera {self.camera_id}] Attempting RTSP connection to: {self.camera_url[:60]}...")

        max_retries = 2
        for attempt in range(max_retries):
            try:
                cap = cv2.VideoCapture(self.camera_url, cv2.CAP_FFMPEG)

                # CAP_PROP_BUFFERSIZE = 1 → OpenCV keeps only the LATEST decoded
                # frame.  Combined with fflags;nobuffer this minimises end-to-end lag.
                cap.set(cv2.CAP_PROP_OPEN_TIMEOUT_MSEC, 8000)
                cap.set(cv2.CAP_PROP_READ_TIMEOUT_MSEC,  5000)
                cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)   # was 2

                if cap.isOpened():
                    for _ in range(3):
                        ret, frame = cap.read()
                        if ret and frame is not None:
                            self.cap = cap
                            self.is_running = True
                            print(f"[Camera {self.camera_id}] ✓ Connected! "
                                  f"{frame.shape[1]}x{frame.shape[0]} "
                                  f"(low-latency RTSP)")
                            self._start_threads()
                            return True
                        time.sleep(0.3)

                    cap.release()
                    print(f"[Camera {self.camera_id}] Attempt {attempt+1}: opened but no frames")
                else:
                    print(f"[Camera {self.camera_id}] Attempt {attempt+1}: failed to open")

            except Exception as e:
                print(f"[Camera {self.camera_id}] Attempt {attempt+1} error: {e}")

            if attempt < max_retries - 1:
                print(f"[Camera {self.camera_id}] Retrying in 1 second...")
                time.sleep(1)

        return False

    def _start_threads(self):
        """Start the RTSP reader thread. The reader now feeds the AI queue directly;
        there is no separate capture/annotation thread anymore (video is delivered
        to browsers by MediaMTX, not this service)."""
        threading.Thread(target=self._rtsp_reader_loop, daemon=True,
                         name=f"cam{self.camera_id}-reader").start()
    
    def _rtsp_reader_loop(self):
        """Dedicated RTSP reader — the ONLY thread that calls cap.read().

        Runs in a tight loop at the camera's native frame rate. Each decoded
        frame is downscaled to TARGET resolution (if needed) and immediately
        fed to the AI worker queue via _enqueue_for_ai() — no separate
        capture/annotation thread exists anymore since this service no longer
        produces video output.

        Also owns reconnection: if the stream fails it releases cap, waits with
        exponential backoff, and reconnects.
        """
        consecutive_failures = 0
        reconnect_attempts   = 0

        while self.is_running:
            try:
                # ── Reconnect if cap is gone ──────────────────────────────────
                if self.cap is None or not self.cap.isOpened():
                    delay = min(
                        RECONNECT_BASE_DELAY * (2 ** min(reconnect_attempts, 5)),
                        RECONNECT_MAX_DELAY
                    )
                    print(f"[Camera {self.camera_id}] Reconnect attempt {reconnect_attempts + 1}"
                          f" — waiting {delay:.0f}s...")
                    time.sleep(delay)

                    if self.cap:
                        try:
                            self.cap.release()
                        except Exception:
                            pass
                        self.cap = None

                    # Re-apply low-latency options before reconnecting
                    if self.camera_url.isdigit():
                        new_cap = cv2.VideoCapture(int(self.camera_url))
                    elif self.camera_url.lower() == 'webcam':
                        new_cap = cv2.VideoCapture(0)
                    else:
                        os.environ['OPENCV_FFMPEG_CAPTURE_OPTIONS'] = _RTSP_FFMPEG_OPTS
                        new_cap = cv2.VideoCapture(self.camera_url, cv2.CAP_FFMPEG)
                        new_cap.set(cv2.CAP_PROP_OPEN_TIMEOUT_MSEC, 8000)
                        new_cap.set(cv2.CAP_PROP_READ_TIMEOUT_MSEC,  5000)

                    new_cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)

                    if new_cap.isOpened():
                        ret, _ = new_cap.read()
                        if ret:
                            self.cap         = new_cap
                            consecutive_failures = 0
                            reconnect_attempts   = 0
                            print(f"[Camera {self.camera_id}] ✓ Reconnected")
                        else:
                            new_cap.release()
                            reconnect_attempts += 1
                            print(f"[Camera {self.camera_id}] ✗ Reconnect failed (no frames)")
                    else:
                        new_cap.release()
                        reconnect_attempts += 1
                        print(f"[Camera {self.camera_id}] ✗ Reconnect failed (cannot open)")
                    continue

                # ── Normal read — blocks until next camera frame arrives ───────
                # cap.read() = grab() + retrieve() in one call. Running it on a
                # dedicated thread means the Flask event loop is never
                # network-blocked by slow/stalled cameras.
                ret, frame = self.cap.read()

                if ret and frame is not None:
                    consecutive_failures = 0
                    reconnect_attempts   = 0

                    # Downscale if camera resolution exceeds TARGET — keeps AI
                    # cost predictable and defines the coordinate space reported
                    # in detection events.
                    h, w = frame.shape[:2]
                    if w > TARGET_WIDTH:
                        frame = cv2.resize(frame, (TARGET_WIDTH, TARGET_HEIGHT),
                                           interpolation=cv2.INTER_LINEAR)
                        self._ai_frame_w = TARGET_WIDTH
                        self._ai_frame_h = TARGET_HEIGHT
                    else:
                        self._ai_frame_w = int(w)
                        self._ai_frame_h = int(h)

                    # Keep a reference for the MJPEG fallback endpoint.
                    with self._frame_lock:
                        self._latest_frame = frame

                    # Hand the frame to the AI worker (drain-replace, maxsize=1).
                    self._enqueue_for_ai(frame)
                else:
                    consecutive_failures += 1
                    if consecutive_failures > 10:
                        print(f"[Camera {self.camera_id}] Too many read failures — reconnecting")
                        if self.cap:
                            self.cap.release()
                            self.cap = None
                        consecutive_failures  = 0
                        reconnect_attempts   += 1
                    else:
                        time.sleep(0.01)

            except Exception as e:
                print(f"[Camera {self.camera_id}] RTSP reader error: {e}")
                time.sleep(0.3)

    # ── Producer helper ───────────────────────────────────────────────────────

    def _enqueue_for_ai(self, frame):
        """Producer step — push the most recent frame to the AI worker queue.

        Implements the drain-replace (swap) pattern for a maxsize=1 queue:

          1. Try to evict any stale frame that is still waiting (the AI worker
             has not consumed it yet).  If one is found, increment the drop
             counter — this frame represents delay we are actively discarding.
          2. Try to insert the fresh frame.  If the AI worker picked up the
             evicted frame in the tiny gap between steps 1 and 2, the queue is
             still empty and put_nowait succeeds trivially.  In the rare case
             where the queue is still full (AI is mid-process AND another
             producer racing — impossible here since only one capture thread
             exists), the frame is silently skipped; the next camera tick will
             try again.

        Thread safety: queue.Queue is internally synchronised.  No external
        lock is required.  This is the only place ai_queue receives items.
        """
        try:
            self.ai_queue.get_nowait()      # evict stale frame
            self.ai_frames_dropped += 1
        except queue.Empty:
            pass                             # queue was idle — nothing to evict

        try:
            self.ai_queue.put_nowait(frame)
            self.ai_frames_produced += 1
        except queue.Full:
            pass                             # AI still mid-process; skip this frame

    # ── AI background thread ──────────────────────────────────────────────────

    def _ai_loop(self):
        """AI worker thread — consumes frames from the RTSP reader.

        Blocks on ai_queue.get() until the reader delivers a fresh frame, then
        runs detection + recognition and publishes the result to event_bus.

        Natural rate-limiting: the worker processes as fast as the CPU allows.
        The queue (maxsize=1) ensures it always gets the freshest available frame
        and never builds up a backlog of stale work.
        """
        while self.is_running:
            try:
                # Block until the RTSP reader puts a frame in the queue.
                # timeout=0.5 s lets us re-check is_running on camera stop.
                frame = self.ai_queue.get(timeout=0.5)   # consumer step
            except queue.Empty:
                continue   # timed out — loop back and check is_running

            self.ai_frames_consumed += 1   # track how many frames actually ran AI
            self.frame_count += 1
            self.fps_counter.update()      # FPS meter now reflects AI throughput

            try:
                self._run_ai(frame)
            except Exception as e:
                print(f"[Camera {self.camera_id}] AI worker error: {e}")

            if self.frame_count % 300 == 0:
                gc.collect()

    def _run_ai(self, frame):
        """Run face detection + recognition on a single frame.

        Pipeline:
          1. Motion pre-filter  — skip yunet entirely on static empty scenes.
          2. YuNet detection    — find face bounding boxes in a 320×180 thumbnail.
          3. Quality gates      — drop crops that are too small, dark, uniform,
                                  or have a non-face aspect ratio.
          4. FaceNet embedding  — represent() with detector_backend='skip'.
          5. EmbeddingIndex     — nearest-neighbour search against stored embeddings.
          6. Entry / Exit write — update ActivePresence and AttendanceLog in DB.
          7. WebSocket event    — publish detection metadata to browser overlay.
        """
        h, w = frame.shape[:2]
        scale = w / PROCESS_WIDTH
        small_frame = cv2.resize(frame, (PROCESS_WIDTH, PROCESS_HEIGHT))

        # ── Step 1: Motion pre-filter ──────────────────────────────────────────
        # Convert to grayscale and compare with previous frame.  If the scene is
        # completely static AND we've seen no faces for a while, skip the detector
        # so we don't waste CPU on an empty corridor.
        gray = cv2.cvtColor(small_frame, cv2.COLOR_BGR2GRAY)
        if self._prev_gray is not None:
            motion_score = float(cv2.absdiff(gray, self._prev_gray).mean())
        else:
            motion_score = 999.0   # force detection on first frame
        self._prev_gray = gray

        if self._no_face_streak >= STATIC_SKIP_AFTER and motion_score < MOTION_THRESHOLD:
            # Scene is static and no recent faces — publish empty event and return.
            bus.publish({
                'type':       'detection',
                'camera_id':  self.camera_id,
                'timestamp':  int(time.time() * 1000),
                'frame_size': {'w': self._ai_frame_w, 'h': self._ai_frame_h},
                'detections': [],
            })
            return

        # ── Step 2: Face detection ─────────────────────────────────────────────
        small_faces = self._detect_faces(small_frame)

        new_cached_faces = []
        new_recognized   = []
        detections       = []

        for face in small_faces:
            # Scale bbox from detection frame (320×180) back to full resolution.
            x  = int(face['x'] * scale)
            y  = int(face['y'] * scale)
            fw = int(face['w'] * scale)
            fh = int(face['h'] * scale)

            new_cached_faces.append({
                'x': x, 'y': y, 'w': fw, 'h': fh,
                'confidence': face['confidence'],
            })

            detection = {
                'bbox':       {'x': x, 'y': y, 'w': fw, 'h': fh},
                'person':     {'recognized': False},
                'confidence': 0.0,
            }

            # ── Step 3: Quality gates ──────────────────────────────────────────
            # Gate A: minimum size — crop must be large enough for FaceNet.
            margin = int(max(fw, fh) * 0.25)
            y1 = max(0, y - margin);  y2 = min(h, y + fh + margin)
            x1 = max(0, x - margin);  x2 = min(w, x + fw + margin)
            face_crop = frame[y1:y2, x1:x2]

            if (face_crop.size == 0
                    or face_crop.shape[0] < MIN_FACE_SIZE
                    or face_crop.shape[1] < MIN_FACE_SIZE):
                detections.append(detection)
                continue

            # Gate B: aspect ratio — real faces are roughly square (0.4–2.5).
            # Horizontal "faces" detected on ceiling rails or shelves are rejected.
            aspect = fw / fh if fh > 0 else 0
            if not (0.4 <= aspect <= 2.5):
                detections.append(detection)
                continue

            # Gate C: brightness / uniformity — reject dark IR frames and blank
            # walls that somehow passed the yunet confidence threshold.
            if not _crop_looks_like_face(face_crop):
                detections.append(detection)
                continue

            # ── Step 4 & 5: Embed + search ────────────────────────────────────
            person_dict, distance = self._recognize_face(face_crop)

            if person_dict is not None:
                confidence = max(0.0, 1.0 - (distance / DISTANCE_THRESHOLD))
                detection['person'] = {
                    'recognized': True,
                    'id':   person_dict['person_id'],
                    'name': person_dict['name'],
                    'role': person_dict['role'],
                }
                detection['confidence'] = round(float(confidence), 3)

                new_recognized.append({
                    'name':        person_dict['name'],
                    'role':        person_dict['role'],
                    'person_id':   person_dict['person_id'],
                    'distance':    distance,
                    'confidence':  confidence,
                    'timestamp':   datetime.now().isoformat(),
                    'camera_id':   self.camera_id,
                    'camera_type': self.camera_type,
                })

                # ── Step 6: Entry / Exit DB write ─────────────────────────────
                if confidence >= RECOGNITION_CONFIDENCE_THRESHOLD:
                    self._handle_recognition(person_dict, confidence)
            else:
                # Unrecognised face — log as unknown (with cooldown).
                self._handle_unknown_face(face_crop, distance)

            detections.append(detection)

        # Update no-face streak for motion gate.
        if small_faces:
            self._no_face_streak = 0
        else:
            self._no_face_streak = min(self._no_face_streak + 1, STATIC_SKIP_AFTER + 50)

        self.last_detection_frame = self.frame_count
        self.cached_faces = new_cached_faces
        if new_recognized:
            self.recognized_persons = (self.recognized_persons + new_recognized)[-20:]

        # ── Step 7: Periodic recognition summary (every 60 s) ─────────────────
        now = time.time()
        if now - self._last_summary_t >= 60:
            cam_label = f"Camera {self.camera_id} ({self.camera_type})"
            if self._summary_matches:
                names = list({r['name'] for r in self.recognized_persons[-10:]})
                print(f"[{cam_label}] 60s summary: {self._summary_matches} DB write(s), "
                      f"seen: {', '.join(names) or 'none'}")
            else:
                print(f"[{cam_label}] 60s summary: no confirmed detections "
                      f"(streak={self._no_face_streak}, motion≈{motion_score:.1f})")
            self._last_summary_t = now
            self._summary_matches = 0

        # ── Step 7: WebSocket event ────────────────────────────────────────────
        bus.publish({
            'type':       'detection',
            'camera_id':  self.camera_id,
            'timestamp':  int(time.time() * 1000),
            'frame_size': {'w': self._ai_frame_w, 'h': self._ai_frame_h},
            'detections': detections,
        })
    
    def _detect_faces(self, frame):
        """Locate faces in a small detection frame using a lightweight detector.

        Uses DETECTOR_BACKEND (yunet by default, ~5-15 ms/frame on CPU).
        If the primary backend raises an exception (e.g. model download failed),
        automatically retries with the 'opencv' Haar-cascade which is always
        available and adds zero latency.

        align=False: we only need bounding-box coordinates here.  The face crop
        is extracted from the full-resolution frame in _run_ai(), so aligning
        the tiny detection frame would be wasted work and adds ~10-30 ms.

        Face size is checked against DETECT_MIN_PX (20 px in the 320×180 frame),
        NOT config.MIN_FACE_SIZE (40 px, used for the full-resolution crop).
        """
        faces = []

        def _parse(results):
            out = []
            for face_obj in results:
                conf        = float(face_obj.get('confidence', 0) or 0)
                facial_area = face_obj.get('facial_area', {})
                x  = facial_area.get('x', 0)
                y  = facial_area.get('y', 0)
                fw = facial_area.get('w', 0)
                fh = facial_area.get('h', 0)
                if fw < DETECT_MIN_PX or fh < DETECT_MIN_PX:
                    continue
                # Reject low-confidence detections — these are almost always
                # texture artefacts (ceiling beams, corners, IR noise) and
                # produce the polluted "unknown faces" log the user is seeing.
                if conf < FACE_DETECT_CONFIDENCE:
                    continue
                out.append({'x': x, 'y': y, 'w': fw, 'h': fh, 'confidence': conf})
            return out

        # ── Primary detector (yunet by default) ──────────────────────────────
        # CRITICAL: _tf_inference_lock must wrap this call even though it is
        # only detection (not FaceNet embedding). OpenCV's DNN BlobManager is
        # shared across threads and is NOT thread-safe: two cameras calling
        # DeepFace.extract_faces() with yunet simultaneously trigger a C-level
        # assertion abort (mapIt != reuseMap.end()) that kills the process with
        # no Python traceback. The lock is cheap (~0 ms when uncontested) and
        # is the only safe way to serialise DNN calls across camera threads.
        try:
            with _tf_inference_lock:
                results = DeepFace.extract_faces(
                    img_path=frame,
                    detector_backend=DETECTOR_BACKEND,
                    enforce_detection=False,
                    align=False,   # coordinates only — no landmark alignment needed
                )
            faces = _parse(results)
            return faces
        except Exception as primary_err:
            if "face" not in str(primary_err).lower():
                print(f"[Camera {self.camera_id}] {DETECTOR_BACKEND} detector error: {primary_err}"
                      f" — retrying with 'opencv' fallback")

        # ── Fallback: opencv Haar cascade (always available, zero download) ──
        if DETECTOR_BACKEND != 'opencv':
            try:
                results = DeepFace.extract_faces(
                    img_path=frame,
                    detector_backend='opencv',
                    enforce_detection=False,
                    align=False,
                )
                faces = _parse(results)
            except Exception as fb_err:
                if "face" not in str(fb_err).lower():
                    print(f"[Camera {self.camera_id}] opencv fallback error: {fb_err}")

        return faces
    
    def _preprocess_face(self, face_crop):
        """Preprocess face for better recognition - histogram equalization + resize"""
        try:
            # Convert to grayscale for histogram equalization
            if len(face_crop.shape) == 3:
                gray = cv2.cvtColor(face_crop, cv2.COLOR_BGR2GRAY)
            else:
                gray = face_crop
            
            # Apply CLAHE (Contrast Limited Adaptive Histogram Equalization)
            clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
            equalized = clahe.apply(gray)
            
            # Convert back to BGR for DeepFace
            equalized_bgr = cv2.cvtColor(equalized, cv2.COLOR_GRAY2BGR)
            
            # Resize to standard face size (160x160 for FaceNet)
            face_resized = cv2.resize(equalized_bgr, (FACE_SIZE, FACE_SIZE), 
                                      interpolation=cv2.INTER_LINEAR)
            
            return face_resized
        except Exception as e:
            # Fallback: just resize
            return cv2.resize(face_crop, (FACE_SIZE, FACE_SIZE))
    
    def _recognize_face(self, face_crop):
        """Recognize a face using DeepFace — runs in parallel across all camera AI threads.

        Uses _tf_inference_lock to serialise the DeepFace.represent() call —
        TF/Keras is NOT safe for concurrent inference across threads.

          1. A local reference to embedding_index is captured before the call.
             If reload() swaps the global mid-call, this thread keeps the old
             (still-valid) object alive until the search completes.
          2. EmbeddingIndex.search() is a pure numpy read — safe for many readers.
        """
        # Snapshot the current index — atomic read (GIL), no lock needed.
        index_ref = embedding_index

        if face_crop.size == 0 or face_crop.shape[0] < MIN_FACE_SIZE or face_crop.shape[1] < MIN_FACE_SIZE:
            return None, None

        if index_ref is None or len(index_ref) == 0:
            return None, None

        try:
            # Preprocessing pipeline — must match train.py / enrollment.py exactly:
            #   1. preprocess_face_crop : CLAHE contrast enhancement + upscale small crops
            #   2. resize to FACE_SIZE×FACE_SIZE : FaceNet's canonical input dimensions
            #   3. detector_backend='skip' : do NOT re-run a face detector on the crop.
            #      The crop was already located by yunet in _detect_faces; asking yunet
            #      to re-detect inside the tight crop often fails (low confidence, face
            #      fills the frame) and returns an unaligned embedding that lives in a
            #      different feature space from the stored training embeddings.
            #      With 'skip', DeepFace passes the image straight to FaceNet — fully
            #      consistent with how train.py generates the stored embeddings.
            face_preprocessed = preprocess_face_crop(face_crop)
            face_resized = cv2.resize(face_preprocessed, (FACE_SIZE, FACE_SIZE),
                                      interpolation=cv2.INTER_LINEAR)

            with _tf_inference_lock:
                results = DeepFace.represent(
                    img_path=face_resized,
                    model_name=MODEL_NAME,
                    detector_backend='skip',   # crop already extracted — skip re-detection
                    enforce_detection=False,
                    align=False,               # 'skip' backend ignores align anyway
                )

            if results and len(results) > 0:
                embedding = results[0]["embedding"]
                # Use the local snapshot so a concurrent reload cannot change the
                # index underneath us between the DeepFace call and the search.
                person_dict, distance = index_ref.search(embedding, DISTANCE_THRESHOLD)

                dist_str = f"{distance:.4f}" if distance is not None and distance != float('inf') else "inf"
                if person_dict is not None:
                    print(f"[Camera {self.camera_id}] ✓ MATCH: {person_dict['name']} (dist: {dist_str})")
                else:
                    print(f"[Camera {self.camera_id}] ✗ NO MATCH: best dist {dist_str} > {DISTANCE_THRESHOLD}")

                del results
                return person_dict, distance

        except Exception as e:
            if "face" not in str(e).lower():
                print(f"[Camera {self.camera_id}] Recognition error: {e}")

        return None, None
    
    def _handle_unknown_face(self, face_crop, distance):
        """Handle unknown face - save to database with cooldown"""
        global db_handler
        
        # Use cooldown to avoid saving same unknown person repeatedly
        current_time = time.time()
        unknown_key = f"unknown_{self.camera_id}"
        last_time = self.last_recognition_time.get(unknown_key, 0)
        
        # 30 second cooldown for unknown faces
        if current_time - last_time < 30:
            return  # Skip if recently saved unknown
        
        self.last_recognition_time[unknown_key] = current_time
        
        try:
            # Encode face image to JPEG bytes
            _, jpeg_buffer = cv2.imencode('.jpg', face_crop, [cv2.IMWRITE_JPEG_QUALITY, 90])
            image_bytes = jpeg_buffer.tobytes()
            
            # Confidence for an unknown face: how close it was to the threshold.
            # A face just above the threshold gets a small positive value;
            # a face far from any known person (or no embeddings loaded) gets 0.0.
            confidence = max(0.0, 1.0 - (distance / DISTANCE_THRESHOLD)) if distance is not None else 0.0
            
            # Save to database
            saved_id = db_handler.save_unknown_face(image_bytes, self.zone_id, confidence)
            dist_str = f"{distance:.2f}" if distance is not None and distance != float('inf') else "inf"
            if saved_id is not None:
                print(f"[Camera {self.camera_id}] ⚠ Unknown face saved (id={saved_id}, distance={dist_str}, zone={self.zone_id})")
            else:
                print(f"[Camera {self.camera_id}] ✗ Unknown face DB write FAILED (distance={dist_str}, zone={self.zone_id})")
            
        except Exception as e:
            print(f"[Camera {self.camera_id}] Error saving unknown face: {e}")
    
    def _handle_recognition(self, person_dict, confidence):
        """Confirm a recognised person and write to the database.

        Two-stage gate before any DB write:

        Stage 1 — EMA smoothing
          Exponential moving average (α=0.6) per person key across AI frames.
          Seeds from the first confidence reading so a strong single hit passes
          immediately.  Dampens borderline flickering readings.

        Stage 2 — Per-person cooldown (RECOGNITION_COOLDOWN seconds)
          Prevents duplicate DB rows when the same person is detected on
          consecutive frames.

        Entry camera  →  add_to_active_presence()   → inserts into ActivePresence
        Exit  camera  →  remove_from_active_presence() → deletes from ActivePresence
                                                         AND inserts into AttendanceLog
                                                         with EntryTime, ExitTime, Duration
        """
        global db_handler

        person_key = person_dict.get('person_key') or f"{person_dict['person_id']}|{person_dict['role']}"

        # ── Stage 1: EMA smoothing ────────────────────────────────────────────
        _EMA_ALPHA = EMA_ALPHA
        prev_ema   = self._conf_ema.get(person_key, confidence)
        ema        = _EMA_ALPHA * confidence + (1.0 - _EMA_ALPHA) * prev_ema
        self._conf_ema[person_key] = ema

        if ema < RECOGNITION_CONFIDENCE_THRESHOLD:
            return   # accumulating — not yet confident enough

        # ── Stage 2: cooldown ─────────────────────────────────────────────────
        now = time.time()
        if now - self.last_recognition_time.get(person_key, 0) < RECOGNITION_COOLDOWN:
            return   # duplicate suppressed

        self.last_recognition_time[person_key] = now
        if len(self.last_recognition_time) > MAX_CACHE_SIZE:
            oldest = min(self.last_recognition_time, key=self.last_recognition_time.get)
            del self.last_recognition_time[oldest]

        # ── Validate identity ─────────────────────────────────────────────────
        person_id   = person_dict.get('person_id')
        role        = (person_dict.get('role') or '').upper()
        name        = person_dict.get('name') or f"ID-{person_id}"

        if person_id is None or role not in ('STUDENT', 'TEACHER'):
            print(f"[Camera {self.camera_id}] WARN: invalid person dict — {person_dict!r}")
            return

        person_type = 'Student' if role == 'STUDENT' else 'Teacher'
        cam_type    = (self.camera_type or '').strip().capitalize()   # 'Entry' or 'Exit'

        # ── DB write — Entry camera ────────────────────────────────────────────
        # add_to_active_presence() inserts one row into ActivePresence
        # (Zone_id, PersonType, Student_ID or Teacher_ID, EntryTime=NOW).
        # It is a no-op if the person is already present (prevents duplicates).
        if cam_type == 'Entry':
            try:
                added = db_handler.add_to_active_presence(person_id, person_type, self.zone_id)
                if added:
                    self._summary_matches += 1
                    print(f"[ENTRY  Cam {self.camera_id}] + {name} ({role}) "
                          f"→ Zone {self.zone_id}  conf={ema:.0%}")
                else:
                    print(f"[ENTRY  Cam {self.camera_id}] = {name} already present "
                          f"in Zone {self.zone_id}")
            except Exception as e:
                print(f"[ENTRY  Cam {self.camera_id}] DB ERROR: {e}")

        # ── DB write — Exit camera ─────────────────────────────────────────────
        # remove_from_active_presence() does two things atomically:
        #   1. Reads EntryTime from ActivePresence for this person+zone.
        #   2. Inserts a completed row into AttendanceLog
        #      (EntryTime, ExitTime=NOW, Duration=seconds).
        #   3. Deletes the row from ActivePresence.
        # Returns False if the person was not in ActivePresence (they didn't use
        # the entry camera, or already exited).
        elif cam_type == 'Exit':
            try:
                removed = db_handler.remove_from_active_presence(person_id, person_type, self.zone_id)
                if removed:
                    self._summary_matches += 1
                    print(f"[EXIT   Cam {self.camera_id}] - {name} ({role}) "
                          f"← Zone {self.zone_id}  conf={ema:.0%}  → AttendanceLog written")
                else:
                    print(f"[EXIT   Cam {self.camera_id}] ? {name} not in Zone {self.zone_id} "
                          f"(no entry recorded or already exited)")
            except Exception as e:
                print(f"[EXIT   Cam {self.camera_id}] DB ERROR: {e}")

        elif cam_type == 'Both':
            # Smart bidirectional: act as entry if person not yet present, exit if they are.
            try:
                added = db_handler.add_to_active_presence(person_id, person_type, self.zone_id)
                if added:
                    self._summary_matches += 1
                    print(f"[BOTH   Cam {self.camera_id}] + {name} ({role}) "
                          f"→ Zone {self.zone_id}  conf={ema:.0%}  [entry]")
                else:
                    # Already present — treat as exit
                    removed = db_handler.remove_from_active_presence(person_id, person_type, self.zone_id)
                    if removed:
                        self._summary_matches += 1
                        print(f"[BOTH   Cam {self.camera_id}] - {name} ({role}) "
                              f"← Zone {self.zone_id}  conf={ema:.0%}  [exit → log]")
            except Exception as e:
                print(f"[BOTH   Cam {self.camera_id}] DB ERROR: {e}")

        else:
            print(f"[Camera {self.camera_id}] WARN: unknown camera_type={self.camera_type!r} "
                  f"— must be 'Entry', 'Exit', or 'Both'")

    def stop(self):
        """Stop camera stream with proper cleanup"""
        print(f"[Camera {self.camera_id}] Stopping...")
        self.is_running = False

        # Drain the AI queue so the worker thread unblocks from queue.get()
        # immediately instead of waiting for its 0.5 s timeout.
        try:
            self.ai_queue.get_nowait()
        except queue.Empty:
            pass

        self.last_recognition_time.clear()
        self._conf_ema.clear()
        self._prev_gray      = None
        self._no_face_streak = 0
        if self.cap:
            self.cap.release()
            self.cap = None
        gc.collect()
        print(f"[Camera {self.camera_id}] Stopped")


# Flask API Endpoints

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({
        'status': 'ok',
        'active_cameras': len(active_cameras),
        'known_persons': len(embeddings_data),
        'mediamtx_alive': mediamtx_client.is_alive(),
        'event_subscribers': bus.subscriber_count(),
    })


def _crop_looks_like_face(face_crop):
    """Cheap sanity check on a face crop before running the embedding model.

    Rejects:
      - near-black IR frames with no subject (mean brightness very low)
      - blank walls / ceilings (std-dev very low → almost uniform colour)

    Both classes show up repeatedly in the unknown-faces log when the
    detector mis-fires on textured surfaces, even after the confidence gate.
    """
    if face_crop is None or face_crop.size == 0:
        return False
    try:
        gray = cv2.cvtColor(face_crop, cv2.COLOR_BGR2GRAY) \
            if face_crop.ndim == 3 else face_crop
        mean = float(gray.mean())
        std  = float(gray.std())
        if mean < CROP_MIN_MEAN_BRIGHTNESS:
            return False
        if std < CROP_MIN_STD_DEV:
            return False
    except Exception:
        return True   # if we can't measure, don't block
    return True


def _enhance_frame_for_display(frame):
    """Boost brightness on dark/IR frames so the MJPEG preview is visible.

    Security cameras in night-vision mode output near-black frames (mean pixel
    value < 60) even though face recognition works because the AI model handles
    low-contrast images well.  CLAHE on the Y channel brings out detail without
    blowing out well-lit scenes.
    """
    try:
        gray_mean = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY).mean()
        if gray_mean < 60:
            clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
            yuv = cv2.cvtColor(frame, cv2.COLOR_BGR2YUV)
            yuv[:, :, 0] = clahe.apply(yuv[:, :, 0])
            return cv2.cvtColor(yuv, cv2.COLOR_YUV2BGR)
    except Exception:
        pass
    return frame


@app.route('/snapshot/<int:camera_id>')
def snapshot_camera(camera_id):
    """Single JPEG snapshot — polled by the React frontend every ~150 ms.

    More React-friendly than multipart/x-mixed-replace because each request
    is independent; React component remounts don't break the feed.
    """
    cam = active_cameras.get(camera_id)
    if cam is None or not cam.is_running:
        return jsonify({'error': 'Camera not active'}), 404

    with cam._frame_lock:
        frame = cam._latest_frame

    if frame is None:
        return jsonify({'error': 'No frame yet'}), 503

    frame = _enhance_frame_for_display(frame)
    ret, jpeg = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 75])
    if not ret:
        return jsonify({'error': 'Encode failed'}), 500

    return Response(
        jpeg.tobytes(),
        mimetype='image/jpeg',
        headers={
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Access-Control-Allow-Origin': '*',
        },
    )


@app.route('/stream/<int:camera_id>')
def stream_camera_mjpeg(camera_id):
    """MJPEG stream (kept for backward compatibility / non-React clients)."""
    cam = active_cameras.get(camera_id)
    if cam is None or not cam.is_running:
        return jsonify({'error': 'Camera not active'}), 404

    @stream_with_context
    def generate():
        while cam.is_running:
            with cam._frame_lock:
                frame = cam._latest_frame
            if frame is None:
                time.sleep(0.05)
                continue
            frame = _enhance_frame_for_display(frame)
            ret, jpeg = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 70])
            if not ret:
                time.sleep(0.05)
                continue
            jpeg_bytes = jpeg.tobytes()
            yield (
                b'--frame\r\n'
                b'Content-Type: image/jpeg\r\n'
                b'Content-Length: ' + str(len(jpeg_bytes)).encode() + b'\r\n'
                b'\r\n' +
                jpeg_bytes +
                b'\r\n'
            )
            time.sleep(0.1)

    return Response(
        generate(),
        mimetype='multipart/x-mixed-replace; boundary=frame',
        headers={
            'Cache-Control': 'no-cache, no-store',
            'Access-Control-Allow-Origin': '*',
            'X-Accel-Buffering': 'no',
        },
    )


@app.route('/cameras/start', methods=['POST'])
def start_camera():
    """Start a camera stream"""
    data = request.json
    camera_id = data.get('camera_id')
    camera_url = data.get('camera_url')
    camera_type = data.get('camera_type', 'Entry')
    zone_id = data.get('zone_id')
    
    if camera_id in active_cameras:
        return jsonify({'error': 'Camera already running'}), 400
    
    # Create camera stream
    camera = CameraStream(camera_id, camera_url, camera_type, zone_id)
    
    if camera.is_running:
        active_cameras[camera_id] = camera
        # Register the camera with MediaMTX so browsers can pull video via WebRTC.
        # Best-effort: if MediaMTX is down the AI pipeline still runs.
        mediamtx_client.register_path(camera_id, camera_url)
        bus.publish_status(camera_id, 'online')
        return jsonify({'success': True, 'message': f'Camera {camera_id} started'})
    else:
        bus.publish_status(camera_id, 'error', 'Failed to connect to camera')
        return jsonify({'error': 'Failed to connect to camera'}), 500


@app.route('/cameras/stop/<int:camera_id>', methods=['POST'])
def stop_camera(camera_id):
    """Stop a camera stream with cleanup"""
    if camera_id in active_cameras:
        active_cameras[camera_id].stop()
        del active_cameras[camera_id]
        mediamtx_client.unregister_path(camera_id)
        bus.publish_status(camera_id, 'offline')
        gc.collect()  # Force garbage collection
        return jsonify({'success': True, 'message': f'Camera {camera_id} stopped'})
    else:
        return jsonify({'error': 'Camera not found'}), 404


@app.route('/cameras/list', methods=['GET'])
def list_cameras():
    """List all active cameras"""
    cameras_info = []
    for camera_id, camera in active_cameras.items():
        cameras_info.append({
            'camera_id': camera_id,
            'camera_type': camera.camera_type,
            'zone_id': camera.zone_id,
            'is_running': camera.is_running,
            'fps': camera.fps_counter.get_fps(),
            'recognized_persons': camera.recognized_persons[-5:]  # Last 5
        })
    
    return jsonify({'cameras': cameras_info})


@app.route('/cameras/status', methods=['GET'])
def cameras_status():
    """Get status of all cameras - Used by frontend ZoneLive"""
    cameras_status = {}
    
    for camera_id, camera in active_cameras.items():
        produced = camera.ai_frames_produced
        dropped  = camera.ai_frames_dropped
        cameras_status[str(camera_id)] = {
            'camera_id': camera_id,
            'zone_id': camera.zone_id,
            'camera_type': camera.camera_type,
            'is_running': camera.is_running,
            'is_connected': camera.is_running,  # alias for frontend compatibility
            'fps': camera.fps_counter.get_fps(),
            'frame_count': camera.frame_count,
            'faces_detected': len(camera.cached_faces),
            'recognized_persons': camera.recognized_persons[-10:],
            'webrtc_url':  f'{MEDIAMTX_WEBRTC_URL}/cam{camera_id}/whep',
            'frame_size':  {'w': camera._ai_frame_w, 'h': camera._ai_frame_h},
            # ── AI queue health ───────────────────────────────────────────────
            # drop_rate near 0 = AI keeping up; near 1 = AI heavily overloaded
            'ai_frames_produced': produced,
            'ai_frames_dropped':  dropped,
            'ai_frames_consumed': camera.ai_frames_consumed,
            'ai_drop_rate': round(dropped / produced, 3) if produced > 0 else 0.0,
        }
    
    return jsonify({
        'success': True,
        'cameras': cameras_status,
        'total_active': len(active_cameras),
        'threshold': DISTANCE_THRESHOLD,
        'known_persons': len(embeddings_data)
    })


@app.route('/debug/embeddings', methods=['GET'])
def debug_embeddings():
    """Debug endpoint to view loaded embeddings"""
    persons = {}
    for data in embeddings_data:
        person = data.get('name') or data.get('person') or 'Unknown'
        if person not in persons:
            persons[person] = 0
        persons[person] += 1

    return jsonify({
        'total_embeddings': len(embeddings_data),
        'index_size': len(embedding_index) if embedding_index else 0,
        'threshold': DISTANCE_THRESHOLD,
        'confidence_threshold': RECOGNITION_CONFIDENCE_THRESHOLD,
        'model': MODEL_NAME,
        'persons': persons,
        'warning': 'No embeddings loaded — run python train.py first' if not embeddings_data else None,
    })


@app.route('/debug/recognition/<int:camera_id>', methods=['GET'])
def debug_recognition(camera_id):
    """Force-run recognition on the latest frame and return raw distances.

    Useful for diagnosing why a face shows as Unknown — returns the top-3
    closest persons and their distances so you can see how far off the match is.
    """
    cam = active_cameras.get(camera_id)
    if cam is None or not cam.is_running:
        return jsonify({'error': 'Camera not active'}), 404

    with cam._frame_lock:
        frame = cam._latest_frame
    if frame is None:
        return jsonify({'error': 'No frame captured yet'}), 503

    if embedding_index is None or len(embedding_index) == 0:
        return jsonify({
            'error': 'No embeddings loaded',
            'fix': 'Run python train.py in Facerecongination/ to generate embeddings',
        }), 400

    small = cv2.resize(frame, (PROCESS_WIDTH, PROCESS_HEIGHT))
    try:
        with _tf_inference_lock:
            face_results = DeepFace.extract_faces(
                img_path=small,
                detector_backend=DETECTOR_BACKEND,
                enforce_detection=False,
                align=False,
            )
    except Exception as e:
        return jsonify({'error': f'Detection failed: {e}'}), 500

    h, w = frame.shape[:2]
    scale = w / PROCESS_WIDTH
    faces_info = []

    for fr in face_results:
        fa = fr.get('facial_area', {})
        fw = fa.get('w', 0)
        fh = fa.get('h', 0)
        if fw < DETECT_MIN_PX or fh < DETECT_MIN_PX:
            continue

        x  = int(fa.get('x', 0) * scale)
        y  = int(fa.get('y', 0) * scale)
        fw = int(fw * scale)
        fh = int(fh * scale)
        margin = int(fw * 0.2)
        y1 = max(0, y - margin); y2 = min(h, y + fh + margin)
        x1 = max(0, x - margin); x2 = min(w, x + fw + margin)
        crop = frame[y1:y2, x1:x2]

        if crop.size == 0 or crop.shape[0] < MIN_FACE_SIZE or crop.shape[1] < MIN_FACE_SIZE:
            faces_info.append({'bbox': {'x': x,'y': y,'w': fw,'h': fh}, 'skip': 'too small'})
            continue

        try:
            from utils import preprocess_face_crop
            processed = preprocess_face_crop(crop)
            resized = cv2.resize(processed, (160, 160))
            with _tf_inference_lock:
                reps = DeepFace.represent(
                    img_path=resized,
                    model_name=MODEL_NAME,
                    detector_backend='skip',
                    enforce_detection=False,
                    align=True,
                )
            if not reps:
                faces_info.append({'bbox': {'x': x,'y': y,'w': fw,'h': fh}, 'skip': 'no embedding'})
                continue

            emb = reps[0]['embedding']
            query = np.array(emb, dtype=np.float32)
            dists = np.linalg.norm(embedding_index._matrix - query, axis=1).tolist()
            top3 = sorted(
                zip(dists, embedding_index._meta),
                key=lambda t: t[0]
            )[:3]

            faces_info.append({
                'bbox': {'x': x, 'y': y, 'w': fw, 'h': fh},
                'top_matches': [
                    {
                        'name': m['name'],
                        'role': m['role'],
                        'distance': round(d, 4),
                        'confidence': round(max(0.0, 1.0 - d / DISTANCE_THRESHOLD), 3),
                        'would_match': d <= DISTANCE_THRESHOLD,
                    }
                    for d, m in top3
                ],
            })
        except Exception as e:
            faces_info.append({'bbox': {'x': x,'y': y,'w': fw,'h': fh}, 'error': str(e)})

    return jsonify({
        'camera_id': camera_id,
        'faces_detected': len(faces_info),
        'threshold': DISTANCE_THRESHOLD,
        'confidence_threshold': RECOGNITION_CONFIDENCE_THRESHOLD,
        'faces': faces_info,
    })


@sock.route('/ws/events')
def ws_events_endpoint(ws):
    """WebSocket endpoint — pushes detection metadata as JSON to browsers.

    Protocol (all messages JSON):
      Client → server:
        {"type": "subscribe",   "camera_ids": [1, 3, 7]}
        {"type": "unsubscribe", "camera_ids": [3]}

      Server → client:
        {"type": "hello", "server_time": <ms>}
        {"type": "detection", "camera_id": N, "timestamp": <ms>,
         "frame_size": {"w": W, "h": H},
         "detections": [{"bbox": {...}, "person": {...}, "confidence": F}, ...]}
        {"type": "camera_status", "camera_id": N,
         "status": "online"|"offline"|"error", "message": "..."}

    The client opens ONE connection per browser tab and selects cameras via
    subscribe / unsubscribe — no need to reconnect when switching views.
    """
    sub = bus.subscribe()
    try:
        ws.send(json.dumps({
            'type': 'hello',
            'server_time': int(time.time() * 1000),
        }))

        stop = threading.Event()

        # Reader thread: parses subscribe/unsubscribe control messages.
        # Blocks on ws.receive() — no timeout — so only a real connection
        # close (exception or None) triggers stop and ends the writer loop.
        def _reader():
            try:
                while not stop.is_set():
                    raw = ws.receive()      # blocks until message or close
                    if raw is None:
                        break               # connection closed cleanly
                    try:
                        msg = json.loads(raw)
                    except (ValueError, TypeError):
                        continue
                    mtype = msg.get('type')
                    cams  = msg.get('camera_ids') or []
                    if mtype == 'subscribe':
                        sub.add_cameras(cams)
                    elif mtype == 'set':
                        sub.set_cameras(cams)
                    elif mtype == 'unsubscribe':
                        sub.remove_cameras(cams)
            except Exception:
                pass   # connection closed abruptly
            finally:
                stop.set()

        threading.Thread(target=_reader, daemon=True,
                         name='ws-events-reader').start()

        # Writer loop (this thread): fan-out from the subscriber's queue.
        while not stop.is_set():
            try:
                event = sub.queue.get(timeout=1.0)
            except queue.Empty:
                continue
            try:
                ws.send(json.dumps(event))
            except Exception:
                break
    finally:
        bus.unsubscribe(sub)


def _rebuild_embeddings_from_db():
    """Pull all rows from FaceEmbeddings, rewrite the JSON cache, swap the
    in-memory index. Called after enrol / un-enrol so live recognition
    immediately knows about the new (or removed) person without restart.
    """
    global embeddings_data, embedding_index
    from config import EMBEDDINGS_FILE
    from utils import save_embeddings_to_json

    persons = db_handler.fetch_all_persons()
    new_data = []
    for p in persons.values():
        for emb in p['embeddings']:
            new_data.append({
                'person_id':  p['id'],
                'name':       p['name'],
                'role':       p['role'],
                'person_key': p['key'],
                'embedding':  emb,
            })

    new_index = EmbeddingIndex(new_data)
    save_embeddings_to_json(new_data, EMBEDDINGS_FILE)

    with _reload_lock:
        embeddings_data = new_data
        embedding_index = new_index

    return len(new_data)


@app.route('/enroll/<person_type>/<int:person_id>', methods=['POST'])
def enroll_person(person_type, person_id):
    """Generate FaceNet embeddings for one student/teacher and hot-reload the
    index. Called by the Node.js backend after a student/teacher is created
    or updated, so newly-enrolled people are recognised on the next frame
    without needing a service restart or a manual /embeddings/reload."""
    pt = (person_type or '').lower()
    if pt not in ('student', 'teacher'):
        return jsonify({'success': False, 'error': 'person_type must be student or teacher'}), 400
    role_label = 'Student' if pt == 'student' else 'Teacher'

    try:
        from enrollment import enroll_person_from_database
        ok = enroll_person_from_database(person_id, role_label, db_handler)
        if not ok:
            return jsonify({'success': False, 'error': 'enrollment failed — check service logs'}), 500

        total = _rebuild_embeddings_from_db()
        return jsonify({
            'success': True,
            'person_type': role_label,
            'person_id':   person_id,
            'total_embeddings': total,
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/enroll/<person_type>/<int:person_id>', methods=['DELETE'])
def unenroll_person(person_type, person_id):
    """Remove a person's embeddings (called by Node.js after delete)."""
    pt = (person_type or '').lower()
    if pt not in ('student', 'teacher'):
        return jsonify({'success': False, 'error': 'person_type must be student or teacher'}), 400
    id_field = '"Student_ID"' if pt == 'student' else '"Teacher_ID"'

    try:
        db_handler._ensure_connection()
        with db_handler.conn.cursor() as cur:
            cur.execute(f'DELETE FROM "FaceEmbeddings" WHERE {id_field} = %s', (person_id,))
            db_handler.conn.commit()

        total = _rebuild_embeddings_from_db()
        return jsonify({
            'success': True,
            'removed_person_id': person_id,
            'total_embeddings':  total,
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/embeddings/reload', methods=['POST'])
def reload_embeddings():
    """Reload embeddings from file without restarting.

    Uses _reload_lock only to serialise concurrent reload requests — recognition
    threads are never blocked.  The heavy EmbeddingIndex build happens outside
    any lock; only the two atomic reference swaps happen inside.
    """
    global embeddings_data, embedding_index

    from config import EMBEDDINGS_FILE

    with _reload_lock:
        # Load JSON and build the new index entirely outside the hot path.
        # Recognition threads keep using the old index during this work.
        new_data  = load_embeddings_from_json(EMBEDDINGS_FILE)
        new_index = EmbeddingIndex(new_data)

        # Atomic reference swaps — GIL guarantees each assignment is instantaneous.
        # Any recognition thread already inside index_ref.search() holds its own
        # local reference to the old index and will finish without interruption.
        embeddings_data = new_data
        embedding_index = new_index

    persons = {d.get('name') or d.get('person', 'Unknown') for d in embeddings_data}
    return jsonify({
        'success': True,
        'loaded': len(embeddings_data),
        'persons': list(persons)
    })


@app.route('/stats', methods=['GET'])
def get_stats():
    """Get recognition statistics"""
    stats = {
        'active_cameras': len(active_cameras),
        'known_persons': len(embeddings_data),
        'cameras': {}
    }
    
    for camera_id, camera in active_cameras.items():
        stats['cameras'][str(camera_id)] = {
            'zone_id': camera.zone_id,
            'camera_type': camera.camera_type,
            'is_running': camera.is_running,
            'fps': camera.fps_counter.get_fps(),
            'frame_count': camera.frame_count,
            'recognized_count': len(camera.recognized_persons)
        }
    
    return jsonify(stats)


@app.route('/zones/<int:zone_id>/start_all', methods=['POST'])
def start_zone_cameras(zone_id):
    """Start all cameras for a zone"""
    try:
        cameras = db_handler.get_zone_cameras_list(zone_id)
        
        started = []
        failed = []
        
        for camera in cameras:
            camera_id = camera['Camara_Id']
            
            if camera_id not in active_cameras:
                cam_stream = CameraStream(
                    camera_id,
                    camera['Camera_URL'],
                    camera['Camera_Type'],
                    zone_id
                )
                
                if cam_stream.is_running:
                    active_cameras[camera_id] = cam_stream
                    mediamtx_client.register_path(camera_id, camera['Camera_URL'])
                    bus.publish_status(camera_id, 'online')
                    started.append(camera_id)
                else:
                    failed.append(camera_id)
        
        return jsonify({
            'success': True,
            'started': started,
            'failed': failed,
            'already_running': [c for c in cameras if c['Camara_Id'] in active_cameras]
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


def initialize():
    """Initialize the service"""
    global embeddings_data, embedding_index, db_handler

    print("="*70)
    print("IntelliSight - Live Camera Streaming Service (OPTIMIZED)")
    print("="*70)

    # Load embeddings and build vectorized index
    from config import EMBEDDINGS_FILE
    embeddings_data = load_embeddings_from_json(EMBEDDINGS_FILE)
    embedding_index = EmbeddingIndex(embeddings_data)
    print(f"✓ Loaded {len(embeddings_data)} face embeddings ({len(embedding_index)} vectors in index)")
    
    if len(embeddings_data) == 0:
        print("⚠ WARNING: No embeddings loaded! Run 'python train.py --train' first.")
    else:
        persons = set([d.get('name') or d.get('person', 'Unknown') for d in embeddings_data])
        print(f"  Persons: {', '.join(persons)}")
    
    # Initialize database handler
    db_handler = DatabaseHandler()
    print("✓ Database connected")

    # ── Warm up the face detector ─────────────────────────────────────────────
    # On first call DeepFace downloads the yunet model (~400 KB) and loads it
    # into OpenCV's DNN runtime.  Doing this now means the first real camera
    # frame is not penalised by that one-time setup cost.
    print(f"[*] Warming up '{DETECTOR_BACKEND}' detector...")
    try:
        _blank = np.zeros((PROCESS_HEIGHT, PROCESS_WIDTH, 3), dtype=np.uint8)
        DeepFace.extract_faces(
            img_path=_blank,
            detector_backend=DETECTOR_BACKEND,
            enforce_detection=False,
            align=False,
        )
        print(f"✓ Detector ready ({DETECTOR_BACKEND})")
        del _blank
    except Exception as _e:
        print(f"[WARN] '{DETECTOR_BACKEND}' warm-up failed: {_e}")
        print(f"       Falling back to 'opencv' detector automatically on first frame.")
    # ─────────────────────────────────────────────────────────────────────────

    # Auto-start cameras in a background thread so Flask binds immediately.
    # RTSP connections can take 8–16 s each to time out; running them on the
    # main thread would delay Flask startup by N_cameras × timeout seconds.
    def _bg_start():
        print("\n[*] Auto-starting cameras from database (background)...")
        auto_start_all_cameras()
        print("[*] Camera auto-start complete.")

    threading.Thread(target=_bg_start, daemon=True).start()

    print("="*70)
    print("Service ready! API: http://0.0.0.0:5001")
    print("Use POST /cameras/start to start cameras")
    print("="*70)


def auto_start_all_cameras():
    """Auto-start all cameras from database on service startup"""
    global active_cameras, db_handler
    
    try:
        # Get all cameras from database
        db_handler._ensure_connection()
        cursor = db_handler.conn.cursor(cursor_factory=RealDictCursor)

        cursor.execute("""
            SELECT c.*, z."Zone_Name"
            FROM "Camara" c
            LEFT JOIN "Zone" z ON c."Zone_id" = z."Zone_id"
            ORDER BY c."Zone_id", c."Camera_Type"
        """)

        cameras = cursor.fetchall()
        cursor.close()
        
        print(f"[*] Found {len(cameras)} cameras in database")
        
        started = 0
        failed = 0
        
        for camera in cameras:
            camera_id = camera['Camara_Id']
            camera_url = camera['Camera_URL']
            camera_type = camera.get('Camera_Type', 'Entry')
            zone_id = camera.get('Zone_id')
            zone_name = camera.get('Zone_Name', 'Unknown')
            
            if not camera_url:
                print(f"[!] Camera {camera_id}: No URL configured, skipping")
                continue
            
            print(f"[*] Starting Camera {camera_id} ({camera_type}) for Zone: {zone_name}...")
            
            try:
                cam_stream = CameraStream(camera_id, camera_url, camera_type, zone_id)
                
                if cam_stream.is_running:
                    active_cameras[camera_id] = cam_stream
                    mediamtx_client.register_path(camera_id, camera_url)
                    bus.publish_status(camera_id, 'online')
                    print(f"[OK] Camera {camera_id} started successfully")
                    started += 1
                else:
                    print(f"[FAIL] Camera {camera_id} failed to connect")
                    failed += 1
            except Exception as e:
                print(f"[ERROR] Camera {camera_id}: {e}")
                failed += 1
        
        print(f"\n[*] Auto-start complete: {started} started, {failed} failed")
        
    except Exception as e:
        print(f"[ERROR] Failed to auto-start cameras: {e}")


def _configure_tensorflow():
    """Configure TF before any model is loaded.

    - memory_growth=True: TF allocates GPU VRAM on demand instead of reserving
      all of it upfront.  Prevents OOM crashes when multiple processes share the
      same GPU.
    - Limit inter/intra-op threads: avoids CPU oversubscription when 2+ cameras
      are running AI threads simultaneously.  4 total threads is plenty for
      FaceNet on a modern CPU.
    """
    try:
        import tensorflow as tf
        gpus = tf.config.experimental.list_physical_devices('GPU')
        for gpu in gpus:
            tf.config.experimental.set_memory_growth(gpu, True)
        # Bound the thread pool so two AI threads don't each spin up 16 workers
        tf.config.threading.set_inter_op_parallelism_threads(2)
        tf.config.threading.set_intra_op_parallelism_threads(2)
        print(f"[TF] Configured: {len(gpus)} GPU(s), memory_growth=True, threads=2/2",
              flush=True)
    except Exception as e:
        print(f"[TF] Config skipped ({e})", flush=True)


if __name__ == '__main__':
    _configure_tensorflow()
    try:
        initialize()
        print(f"[BOOT] Flask app.run starting on :5001 — PID {os.getpid()}", flush=True)
        app.run(host='0.0.0.0', port=5001, threaded=True, debug=False, use_reloader=False)
    except SystemExit:
        raise
    except KeyboardInterrupt:
        print("[EXIT] KeyboardInterrupt received — shutting down", flush=True)
    except Exception as e:
        print(f"[FATAL] Main loop crashed: {type(e).__name__}: {e}", flush=True)
        traceback.print_exc()
        sys.exit(1)
    print(f"[EXIT] app.run returned normally at {datetime.now().isoformat()}", flush=True)
