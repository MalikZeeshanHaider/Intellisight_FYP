"""
IntelliSight - Live Camera Stream with Face Recognition
Backend service that processes RTSP camera feeds and streams results to frontend
Supports multiple cameras with face detection and recognition

*** OPTIMIZED FOR CPU-ONLY PROCESSING ***
- Frame throttling: Process every 3rd frame
- Parallel processing: Separate threads for capture/detection/recognition
- Fast detector: OpenCV Haar Cascade as primary (faster than DeepFace SSD on CPU)
- Histogram equalization for lighting normalization
- Memory-cached embeddings (no DB hits per frame)
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
from flask import Flask, Response, jsonify, request
from flask_cors import CORS
from flask_sock import Sock
from datetime import datetime
from deepface import DeepFace

# Fix Windows console encoding so Unicode characters (✓, ✅, ⚠, etc.) don't crash
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')
import psycopg2
from psycopg2.extras import RealDictCursor

from config import (
    DB_CONFIG, MODEL_NAME, DISTANCE_THRESHOLD, MIN_FACE_SIZE,
    RECOGNITION_CONFIDENCE_THRESHOLD, DETECTOR_BACKEND, FRAME_SKIP,
)
from utils import load_embeddings_from_json, FPSCounter, preprocess_face_crop, EmbeddingIndex
from database_handler import DatabaseHandler

app = Flask(__name__)
CORS(app)
sock = Sock(app)

# Global variables
active_cameras  = {}    # {camera_id: CameraStream}
embeddings_data = []    # raw list — kept for len() / reload responses
embedding_index = None  # EmbeddingIndex — built once at startup
db_handler      = None

# Fine-grained lock strategy
# ─────────────────────────────────────────────────────────────────────────────
# _reload_lock  — protects the reload code path only (prevents two concurrent
#                 /embeddings/reload calls from racing).  Recognition threads
#                 do NOT acquire this lock — they take a local snapshot of the
#                 embedding_index reference instead (see _recognize_face).
#
# Why no global recognition lock?
#   • DeepFace.represent() in TF2 eager mode is safe to call concurrently —
#     the loaded Keras model is read-only during inference.
#   • EmbeddingIndex.search() only reads numpy arrays — safe for many readers.
#   • Python's GIL makes reference assignment atomic:
#       embedding_index = new_index
#     Any camera thread already inside search() holds a reference to the OLD
#     index object; it will complete safely before GC reclaims that object.
#
# Result: Camera 1 and Camera 2 can run face recognition simultaneously.
# ─────────────────────────────────────────────────────────────────────────────
_reload_lock = threading.Lock()

# ── WebSocket client registry ─────────────────────────────────────────────────
# Each browser tab that opens /ws/stream/<id> gets its own queue (maxsize=1).
# _push_ws_frame() is called from the capture thread; WS handler threads read
# from their queues and forward bytes to the browser over the WebSocket.
# _ws_clients_lock protects dict mutations only — frame delivery is lock-free.
_ws_clients      = {}               # {camera_id: set of queue.Queue}
_ws_clients_lock = threading.Lock()


def _push_ws_frame(camera_id, jpeg_bytes):
    """Push the latest JPEG frame to every WebSocket client watching this camera.

    Uses the same drain-replace pattern as the AI queue: each client queue
    holds at most 1 frame, so a slow browser never causes back-pressure on
    the capture thread.
    """
    with _ws_clients_lock:
        clients = set(_ws_clients.get(camera_id, set()))   # snapshot
    for q in clients:
        try:
            q.get_nowait()          # drop stale frame
        except queue.Empty:
            pass
        try:
            q.put_nowait(jpeg_bytes)
        except queue.Full:
            pass


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
        self.frame = None
        self.is_running = False
        self.fps_counter = FPSCounter()
        self.last_recognition_time = {}
        self.recognized_persons = []
        self.frame_count = 0
        
        # Cache for face detections (avoid detecting every frame)
        self.cached_faces = []
        self.last_detection_frame = 0

        # Per-face labels drawn by the fast path (set by AI thread)
        self.cached_face_labels = []   # list of {x,y,fw,fh,label,color}

        # ── Confidence EMA cache ───────────────────────────────────────────────
        # Short-term exponential moving average of recognition confidence per
        # person.  Smooths single-frame jitter without adding blocking delays:
        #   ema_new = α × confidence_new + (1 − α) × ema_old  (α = 0.6)
        # A borderline first reading decays slightly; a consistent high reading
        # stays high.  Keyed by person_key; cleared in stop().
        self._conf_ema = {}   # {person_key: float}

        # ── RTSP reader → capture pipeline ────────────────────────────────────────
        # _live_frame is written by _rtsp_reader_loop (one writer, fast loop).
        # _capture_loop reads it to annotate and encode — never touches cap directly.
        # Python's GIL makes reference assignment atomic so no lock is needed.
        self._live_frame = None  # latest raw numpy frame from camera

        # ── Streaming output (written by capture thread, read by Flask) ──────────
        # Pre-encoded JPEG bytes so the streaming generator never does CPU work.
        self.jpeg_frame = None   # bytes | None

        # ── AI worker queue (capture → AI thread) ─────────────────────────────
        # maxsize=1: capture thread always replaces stale frames with the freshest
        # one available.  The AI worker is naturally rate-limited by its own speed —
        # it simply processes as fast as the CPU allows, never accumulating a backlog.
        self.ai_queue = queue.Queue(maxsize=1)

        # Connect to camera
        self.connect()

        # Start AI background thread — runs independently of capture success.
        # If camera failed to connect, is_running=False and the thread exits immediately.
        self._ai_thread = threading.Thread(target=self._ai_loop, daemon=True)
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
        """Start the RTSP reader thread and the capture/annotation thread."""
        threading.Thread(target=self._rtsp_reader_loop, daemon=True).start()
        threading.Thread(target=self._capture_loop,     daemon=True).start()
    
    def _rtsp_reader_loop(self):
        """Dedicated RTSP reader — the ONLY thread that calls cap.read().

        Runs in a tight loop at the camera's native frame rate.  Every decoded
        frame immediately replaces self._live_frame (atomic reference swap via
        GIL), so _capture_loop always reads the most recent camera image with
        zero buffering delay.

        Also owns reconnection: if the stream fails it releases cap, waits with
        exponential backoff, and reconnects — _capture_loop is never involved.
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
                # cap.read() = grab() + retrieve() in one call, but the key
                # difference is we do this in a DEDICATED thread so the annotation
                # / JPEG-encode thread (_capture_loop) is never network-blocked.
                ret, frame = self.cap.read()

                if ret and frame is not None:
                    consecutive_failures = 0
                    reconnect_attempts   = 0
                    # Atomic swap — GIL guarantees _capture_loop sees a complete
                    # frame object, never a half-written one.
                    self._live_frame = frame
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

    def _capture_loop(self):
        """Annotation + encode thread — pure CPU work, never touches the network.

        Reads the latest raw frame from self._live_frame (written by the RTSP
        reader thread), draws cached AI labels, encodes to JPEG once, and stores
        the bytes in self.jpeg_frame for the Flask streaming generator to serve.
        Also feeds the AI worker queue.
        """
        while self.is_running:
            try:
                frame = self._live_frame   # atomic read — no lock needed
                if frame is None:
                    time.sleep(0.01)       # wait for first frame from reader
                    continue

                h, w = frame.shape[:2]
                if w > TARGET_WIDTH:
                    frame = cv2.resize(frame, (TARGET_WIDTH, TARGET_HEIGHT),
                                       interpolation=cv2.INTER_LINEAR)

                self.frame_count += 1

                # ── Feed AI worker (non-blocking, always-fresh) ───────────────
                try:
                    self.ai_queue.get_nowait()   # drain stale frame
                except queue.Empty:
                    pass
                try:
                    self.ai_queue.put_nowait(frame.copy())
                except queue.Full:
                    pass   # AI mid-process — safe to skip

                # ── Annotate + encode (zero network wait) ─────────────────────
                annotated = self._draw_annotated_frame(frame)
                self.frame = annotated   # numpy ref for debug access

                ok, jpeg = cv2.imencode(
                    '.jpg', annotated,
                    [cv2.IMWRITE_JPEG_QUALITY, 80, cv2.IMWRITE_JPEG_OPTIMIZE, 1]
                )
                if ok:
                    jpeg_bytes = jpeg.tobytes()
                    self.jpeg_frame = jpeg_bytes          # for MJPEG fallback
                    _push_ws_frame(self.camera_id, jpeg_bytes)   # WebSocket push

                self.fps_counter.update()

                if self.frame_count % 300 == 0:
                    gc.collect()

                time.sleep(0.005)   # ~200 Hz ceiling; actual rate = camera FPS

            except Exception as e:
                print(f"[Camera {self.camera_id}] Capture loop error: {e}")
                time.sleep(0.1)
    
    def _draw_annotated_frame(self, frame):
        """Draw cached face boxes and recognition labels from the last AI run.
        Pure drawing — no AI calls. Called on EVERY captured frame for smooth streaming."""
        display = frame.copy()

        # Take a local reference so the AI thread can replace the list mid-frame
        # without causing iteration errors (Python GIL guarantees atomic ref swap).
        face_labels = self.cached_face_labels

        for fl in face_labels:
            x, y, fw, fh = fl['x'], fl['y'], fl['fw'], fl['fh']
            color  = fl['color']
            label  = fl['label']
            cv2.rectangle(display, (x, y), (x + fw, y + fh), color, 2)
            label_size = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 2)[0]
            cv2.rectangle(display, (x, y - 28), (x + label_size[0] + 10, y), color, -1)
            cv2.putText(display, label, (x + 5, y - 8),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)

        fps = self.fps_counter.get_fps()
        cv2.putText(display, f"FPS: {fps:.1f}", (10, 30),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
        cv2.putText(display, f"Faces: {len(face_labels)}", (10, 60),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
        cv2.putText(display, f"Type: {self.camera_type}", (10, 90),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)

        return display
    
    # ── AI background thread ──────────────────────────────────────────────────

    def _ai_loop(self):
        """AI worker thread — completely independent of the capture / streaming thread.

        Blocks on ai_queue.get() until the capture thread delivers a fresh frame,
        then runs detection + recognition.  It never touches self.jpeg_frame and
        never makes the streaming generator wait.

        Natural rate-limiting: the worker processes as fast as the CPU allows.
        The queue (maxsize=1) ensures it always gets the freshest available frame
        and never builds up a backlog of stale work.
        """
        while self.is_running:
            try:
                # Block until the capture thread puts a frame in the queue.
                # timeout=0.5 s lets us re-check is_running on camera stop.
                frame = self.ai_queue.get(timeout=0.5)
            except queue.Empty:
                continue   # timed out — loop back and check is_running

            # frame is a raw numpy array copy — safe to process without locks.
            try:
                self._run_ai(frame)
            except Exception as e:
                print(f"[Camera {self.camera_id}] AI worker error: {e}")

    def _run_ai(self, frame):
        """Run face detection + recognition on a frame snapshot.
        Updates self.cached_faces, self.cached_face_labels, self.recognized_persons.
        Runs entirely in _ai_loop thread — does NOT touch self.frame."""
        h, w = frame.shape[:2]
        scale = w / PROCESS_WIDTH
        small_frame = cv2.resize(frame, (PROCESS_WIDTH, PROCESS_HEIGHT))

        # Detect faces on the downscaled frame
        small_faces = self._detect_faces(small_frame)

        new_cached_faces = []
        new_face_labels  = []
        new_recognized   = []

        for face in small_faces:
            # Scale coordinates back to display resolution
            x  = int(face['x'] * scale)
            y  = int(face['y'] * scale)
            fw = int(face['w'] * scale)
            fh = int(face['h'] * scale)

            new_cached_faces.append({
                'x': x, 'y': y, 'w': fw, 'h': fh,
                'confidence': face['confidence'],
            })

            # Extract face crop with margin
            margin = int(fw * 0.2)
            y1 = max(0, y - margin);  y2 = min(h, y + fh + margin)
            x1 = max(0, x - margin);  x2 = min(w, x + fw + margin)
            face_crop = frame[y1:y2, x1:x2]

            if (face_crop.size == 0
                    or face_crop.shape[0] < MIN_FACE_SIZE
                    or face_crop.shape[1] < MIN_FACE_SIZE):
                new_face_labels.append({'x': x, 'y': y, 'fw': fw, 'fh': fh,
                                        'label': 'Detecting...', 'color': (255, 255, 0)})
                continue

            person_dict, distance = self._recognize_face(face_crop)

            if person_dict is not None:
                confidence = max(0.0, 1.0 - (distance / DISTANCE_THRESHOLD))
                label = f"{person_dict['name']} ({confidence:.0%})"
                color = (0, 255, 0)   # Green
                new_recognized.append({
                    'name':       person_dict['name'],
                    'role':       person_dict['role'],
                    'person_id':  person_dict['person_id'],
                    'distance':   distance,
                    'confidence': confidence,
                    'timestamp':  datetime.now().isoformat(),
                    'camera_id':  self.camera_id,
                    'camera_type': self.camera_type,
                })
                # Confidence gate — only forward high-confidence detections.
                # EMA smoothing inside _handle_recognition handles borderline cases.
                if confidence >= RECOGNITION_CONFIDENCE_THRESHOLD:
                    self._handle_recognition(person_dict, confidence)
            elif distance is not None:
                label = f"Unknown ({distance:.1f})" if distance < 100 else "Unknown"
                color = (0, 0, 255)   # Red
                self._handle_unknown_face(face_crop, distance)
            else:
                label = "Detecting..."
                color = (255, 255, 0)  # Yellow

            new_face_labels.append({
                'x': x, 'y': y, 'fw': fw, 'fh': fh,
                'label': label, 'color': color,
            })

        self.last_detection_frame = self.frame_count

        # Atomically replace cached state.
        # Python's GIL makes reference assignment atomic, so the capture thread
        # will always see a complete list, never a half-written one.
        self.cached_faces      = new_cached_faces
        self.cached_face_labels = new_face_labels
        if new_recognized:
            # Keep a rolling window of the last 20 recognitions
            self.recognized_persons = (self.recognized_persons + new_recognized)[-20:]
    
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
                conf        = face_obj.get('confidence', 0)
                facial_area = face_obj.get('facial_area', {})
                x  = facial_area.get('x', 0)
                y  = facial_area.get('y', 0)
                fw = facial_area.get('w', 0)
                fh = facial_area.get('h', 0)
                if fw >= DETECT_MIN_PX and fh >= DETECT_MIN_PX:
                    out.append({'x': x, 'y': y, 'w': fw, 'h': fh, 'confidence': conf})
            return out

        # ── Primary detector (yunet by default) ──────────────────────────────
        try:
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

        No global lock is acquired here.  Instead:
          1. A local reference to embedding_index is captured before the DeepFace call.
             If reload() swaps the global mid-call, this thread keeps using the old
             (still-valid) index object; GC won't free it until we're done.
          2. DeepFace.represent() is safe to call concurrently in TF2 eager mode —
             the Keras model is read-only during inference.
          3. EmbeddingIndex.search() is a pure numpy read — safe for many readers.
        """
        # Snapshot the current index — atomic read (GIL), no lock needed.
        index_ref = embedding_index

        if face_crop.size == 0 or face_crop.shape[0] < MIN_FACE_SIZE or face_crop.shape[1] < MIN_FACE_SIZE:
            return None, None

        if index_ref is None or len(index_ref) == 0:
            return None, None

        try:
            # Preprocess: upscale small faces + CLAHE for low-light, then resize to FaceNet input size
            face_preprocessed = preprocess_face_crop(face_crop)
            face_resized = cv2.resize(face_preprocessed, (160, 160), interpolation=cv2.INTER_LINEAR)

            # No lock — Camera 1 and Camera 2 run this concurrently.
            results = DeepFace.represent(
                img_path=face_resized,
                model_name=MODEL_NAME,
                detector_backend="skip",   # face already cropped — skip re-detection
                enforce_detection=False,
                align=True
            )

            if results and len(results) > 0:
                embedding = results[0]["embedding"]
                # Use the local snapshot so a concurrent reload cannot change the
                # index underneath us between the DeepFace call and the search.
                person_dict, distance = index_ref.search(embedding, DISTANCE_THRESHOLD)

                if person_dict is not None:
                    print(f"[Camera {self.camera_id}] ✓ MATCH: {person_dict['name']} (dist: {distance:.4f})")
                else:
                    print(f"[Camera {self.camera_id}] ✗ NO MATCH: best dist {distance:.4f} > {DISTANCE_THRESHOLD}")

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
            # a face far from any known person gets 0.0.
            confidence = max(0.0, 1.0 - (distance / DISTANCE_THRESHOLD)) if distance else 0.0
            
            # Save to database
            db_handler.save_unknown_face(image_bytes, self.zone_id, confidence)
            print(f"[Camera {self.camera_id}] ⚠ Unknown face saved to database (distance: {distance:.2f})")
            
        except Exception as e:
            print(f"[Camera {self.camera_id}] Error saving unknown face: {e}")
    
    def _handle_recognition(self, person_dict, confidence):
        """Confirm a recognized person and write to the database.

        Replaces the old consecutive-frame requirement with a two-stage gate:

        Stage 1 — EMA smoothing (non-blocking stabiliser)
          An exponential moving average (α = 0.6) of confidence per person is
          maintained across AI frames.  This dampens one-off high readings from
          noise while letting genuinely consistent detections accumulate quickly.

          α = 0.6 means:
            • First reading  → ema  = confidence  (no history yet, pass-through)
            • Second reading → ema  = 0.6 × new + 0.4 × old
          A single very-high reading (e.g. 0.95) passes immediately because ema
          initialises to that value on first sight.  A borderline first reading
          (e.g. 0.76 when threshold is 0.75) is slightly smoothed on the next
          frame but never blocks indefinitely.

        Stage 2 — Per-person cooldown
          After a confirmed detection, RECOGNITION_COOLDOWN seconds must elapse
          before the same person can trigger another DB write.  This prevents
          spam without needing consecutive frames.
        """
        global db_handler

        person_key = person_dict.get('person_key') or f"{person_dict['person_id']}|{person_dict['role']}"

        # ── Stage 1: EMA smoothing ────────────────────────────────────────────
        _EMA_ALPHA = 0.6
        prev_ema   = self._conf_ema.get(person_key, confidence)  # seed with current on first sight
        ema        = _EMA_ALPHA * confidence + (1.0 - _EMA_ALPHA) * prev_ema
        self._conf_ema[person_key] = ema

        if ema < RECOGNITION_CONFIDENCE_THRESHOLD:
            # EMA not yet high enough — keep accumulating without blocking
            print(f"[Camera {self.camera_id}] Stabilising {person_dict['name']} "
                  f"(ema={ema:.2f} < {RECOGNITION_CONFIDENCE_THRESHOLD})")
            return

        # ── Stage 2: cooldown gate ────────────────────────────────────────────
        current_time = time.time()
        if current_time - self.last_recognition_time.get(person_key, 0) < RECOGNITION_COOLDOWN:
            return   # recently confirmed — suppress duplicate DB write

        self.last_recognition_time[person_key] = current_time

        # Evict oldest entry if cache is full
        if len(self.last_recognition_time) > MAX_CACHE_SIZE:
            oldest = min(self.last_recognition_time, key=self.last_recognition_time.get)
            del self.last_recognition_time[oldest]

        # ── Write to database ─────────────────────────────────────────────────
        try:
            person_id   = person_dict['person_id']
            role        = person_dict['role']
            name        = person_dict['name']

            if person_id is None or role not in ('STUDENT', 'TEACHER'):
                print(f"[Warning] Invalid identity in person dict: {person_dict!r}")
                return

            person_type = 'Student' if role == 'STUDENT' else 'Teacher'

            if self.camera_type == 'Entry':
                result = db_handler.add_to_active_presence(person_id, person_type, self.zone_id)
                if result:
                    print(f"[Entry] ✓ {name} ({role}) entered Zone {self.zone_id} — conf {ema:.0%}")
                else:
                    print(f"[Entry] {name} already in Zone {self.zone_id}")

            elif self.camera_type == 'Exit':
                result = db_handler.remove_from_active_presence(person_id, person_type, self.zone_id)
                if result:
                    print(f"[Exit] ✅ {name} ({role}) left Zone {self.zone_id} — conf {ema:.0%}")
                else:
                    print(f"[Exit] ℹ️ {name} was not in Zone {self.zone_id}")

        except Exception as e:
            print(f"[Database Error] {e}")

    def get_frame(self):
        """Return the latest pre-encoded JPEG frame as bytes.

        Zero CPU work here — encoding happens once in the capture thread.
        Multiple browser tabs / consumers all read the same bytes for free.
        """
        return self.jpeg_frame   # bytes | None
    
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
        'known_persons': len(embeddings_data)
    })


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
        return jsonify({'success': True, 'message': f'Camera {camera_id} started'})
    else:
        return jsonify({'error': 'Failed to connect to camera'}), 500


@app.route('/cameras/stop/<int:camera_id>', methods=['POST'])
def stop_camera(camera_id):
    """Stop a camera stream with cleanup"""
    if camera_id in active_cameras:
        active_cameras[camera_id].stop()
        del active_cameras[camera_id]
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
        cameras_status[str(camera_id)] = {
            'camera_id': camera_id,
            'zone_id': camera.zone_id,
            'camera_type': camera.camera_type,
            'is_running': camera.is_running,
            'is_connected': camera.is_running,  # Alias for frontend compatibility
            'fps': camera.fps_counter.get_fps(),
            'frame_count': camera.frame_count,
            'faces_detected': len(camera.cached_faces),
            'recognized_persons': camera.recognized_persons[-10:],
            'stream_url': f'/stream/{camera_id}'
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
        person = data.get('person', 'Unknown')
        if person not in persons:
            persons[person] = 0
        persons[person] += 1
    
    return jsonify({
        'total_embeddings': len(embeddings_data),
        'threshold': DISTANCE_THRESHOLD,
        'model': MODEL_NAME,
        'persons': persons
    })


@app.route('/stream/<int:camera_id>')
def stream_camera(camera_id):
    """Stream camera feed with optimized FPS"""
    def generate():
        while camera_id in active_cameras:
            frame = active_cameras[camera_id].get_frame()
            if frame:
                yield (b'--frame\r\n'
                       b'Content-Type: image/jpeg\r\n\r\n' + frame + b'\r\n')
            time.sleep(0.02)  # 50 FPS max for smoother streaming
    
    if camera_id in active_cameras:
        return Response(generate(), 
                       mimetype='multipart/x-mixed-replace; boundary=frame')
    else:
        return jsonify({'error': 'Camera not found'}), 404


@sock.route('/ws/stream/<int:camera_id>')
def ws_stream_endpoint(ws, camera_id):
    """WebSocket endpoint — pushes annotated JPEG frames in binary to the browser.

    Protocol:
      • Client opens  ws://host:5001/ws/stream/<camera_id>
      • Server sends binary messages; each message is one complete JPEG image.
      • No client→server messages expected (one-way push).

    Back-pressure handling:
      Each connected client gets its own queue (maxsize=1).  The capture thread
      always replaces stale frames using the drain-replace pattern, so a slow
      browser tab simply misses frames rather than growing a backlog.

    Lifecycle:
      • If the camera is not running, the handler returns immediately.
      • If the camera stops while streaming, the loop exits and the client
        will see the WebSocket close, prompting a reconnect in the frontend.
    """
    if camera_id not in active_cameras:
        return

    client_q = queue.Queue(maxsize=1)
    with _ws_clients_lock:
        _ws_clients.setdefault(camera_id, set()).add(client_q)

    try:
        cam = active_cameras.get(camera_id)
        while cam and cam.is_running and camera_id in active_cameras:
            try:
                frame_bytes = client_q.get(timeout=1.0)
                ws.send(frame_bytes)
            except queue.Empty:
                continue   # no frame yet — keep waiting
    except Exception:
        pass   # client disconnected or WebSocket error
    finally:
        with _ws_clients_lock:
            if camera_id in _ws_clients:
                _ws_clients[camera_id].discard(client_q)


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

    persons = {d.get('person', 'Unknown') for d in embeddings_data}
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
        # Print loaded persons
        persons = set([d.get('person', 'Unknown') for d in embeddings_data])
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
        conn = db_handler.conn
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
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


if __name__ == '__main__':
    initialize()
    app.run(host='0.0.0.0', port=5001, threaded=True, debug=False)
