"""
IntelliSight - OPTIMIZED Live Camera Stream with Face Recognition
Fixed: Memory leaks, slow detection, inaccurate recognition
Version: 2.0 - Performance & Accuracy Improvements
"""

import os
import sys
import cv2
import numpy as np
import json
import time
import threading
import gc
import weakref
from collections import deque
from flask import Flask, Response, jsonify, request
from flask_cors import CORS
from datetime import datetime
from deepface import DeepFace
import psycopg2

# Fix Windows console encoding so Unicode characters don't crash the server
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')
from psycopg2.extras import RealDictCursor

from config import (
    DB_CONFIG, MODEL_NAME, DISTANCE_THRESHOLD, MIN_FACE_SIZE,
    EMBEDDINGS_FILE, RECOGNITION_CONFIDENCE_THRESHOLD, DETECTOR_BACKEND, FRAME_SKIP
)
from utils import load_embeddings_from_json, get_euclidean_distance, FPSCounter, preprocess_face_crop, EmbeddingIndex, FaceTracker
from database_handler import DatabaseHandler

app = Flask(__name__)
CORS(app)

# Global variables
active_cameras  = {}
embeddings_data = []    # raw list — kept for len() / reload responses
embedding_index = None  # EmbeddingIndex — built once at startup
db_handler      = None
embeddings_lock = threading.Lock()

# OPTIMIZED SETTINGS
# RECOGNITION_CONFIDENCE_THRESHOLD, MIN_FACE_SIZE imported from config — do not redefine here
RECOGNITION_COOLDOWN = 2.0  # Seconds between recognizing same person
MAX_CACHE_SIZE = 100
# DISTANCE_THRESHOLD_STRICT removed — use DISTANCE_THRESHOLD from config


def find_best_match_optimized(embedding, embeddings_data_or_index, threshold=DISTANCE_THRESHOLD):
    """
    Vectorized search with confidence scoring.  Delegates to
    EmbeddingIndex.search_with_confidence() — accepts either an EmbeddingIndex
    (preferred, built once at startup) or a legacy list of dicts.

    Returns:
        (person_dict | None, float distance, float confidence)
    """
    if isinstance(embeddings_data_or_index, EmbeddingIndex):
        return embeddings_data_or_index.search_with_confidence(embedding, threshold)
    return EmbeddingIndex(embeddings_data_or_index).search_with_confidence(embedding, threshold)


# FaceTracker is now defined in utils.py and imported at the top of this file.


class CameraStream:
    """OPTIMIZED: Camera stream with improved recognition and memory management"""
    
    def __init__(self, camera_id, camera_url, camera_type, zone_id):
        self.camera_id = camera_id
        self.camera_url = camera_url.strip() if camera_url else ""
        self.camera_type = camera_type
        self.zone_id = zone_id
        self.cap = None
        self.frame = None
        self.is_running = False
        self.fps_counter = FPSCounter()
        self.frame_count = 0
        
        # OPTIMIZED: Face tracking to avoid repeated recognition
        self.face_tracker = FaceTracker()
        self.recognition_cache = {}  # {person: last_recognition_time}
        self.cache_lock = threading.Lock()
        
        # Recognition statistics
        self.stats = {
            'total_detections': 0,
            'total_recognitions': 0,
            'unknown_faces': 0,
            'known_faces': 0
        }
        
        # Connect to camera
        self.connect()
    
    def connect(self):
        """Connect to RTSP camera with optimized settings"""
        import os
        
        # OPTIMIZED: Better FFMPEG settings for RTSP
        os.environ['OPENCV_FFMPEG_CAPTURE_OPTIONS'] = (
            'rtsp_transport;tcp|'
            'rtsp_flags;prefer_tcp|'
            'stimeout;5000000|'
            'max_delay;500000|'
            'reorder_queue_size;0'
        )
        
        print(f"[Camera {self.camera_id}] Connecting to: {self.camera_url[:60]}...")
        
        try:
            cap = cv2.VideoCapture(self.camera_url, cv2.CAP_FFMPEG)
            cap.set(cv2.CAP_PROP_OPEN_TIMEOUT_MSEC, 10000)
            cap.set(cv2.CAP_PROP_READ_TIMEOUT_MSEC, 5000)
            cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)  # Minimal buffer for real-time
            
            if cap.isOpened():
                ret, frame = cap.read()
                if ret and frame is not None:
                    self.cap = cap
                    self.is_running = True
                    self.frame = frame
                    print(f"[Camera {self.camera_id}] ✓ Connected! Resolution: {frame.shape[1]}x{frame.shape[0]}")
                    
                    # Start capture thread
                    thread = threading.Thread(target=self._capture_loop, daemon=True)
                    thread.start()
                    return True
                else:
                    cap.release()
                    print(f"[Camera {self.camera_id}] Cannot read frames")
            else:
                print(f"[Camera {self.camera_id}] Failed to open stream")
                
        except Exception as e:
            print(f"[Camera {self.camera_id}] Connection error: {e}")
        
        return False
    
    def _capture_loop(self):
        """OPTIMIZED: Background capture loop with exponential-backoff reconnection."""
        process_every      = FRAME_SKIP
        reconnect_attempts = 0

        while self.is_running:
            try:
                # ── Reconnect if stream is lost ───────────────────────────────
                if self.cap is None or not self.cap.isOpened():
                    delay = min(2 * (2 ** min(reconnect_attempts, 5)), 60)
                    print(
                        f"[Camera {self.camera_id}] Reconnect attempt {reconnect_attempts + 1} "
                        f"— waiting {delay:.0f}s..."
                    )
                    time.sleep(delay)

                    if self.cap:
                        self.cap.release()
                        self.cap = None

                    # Re-open in-place — do NOT call connect(), it would start a new thread
                    os.environ['OPENCV_FFMPEG_CAPTURE_OPTIONS'] = (
                        'rtsp_transport;tcp|'
                        'rtsp_flags;prefer_tcp|'
                        'stimeout;5000000|'
                        'max_delay;500000|'
                        'reorder_queue_size;0'
                    )
                    new_cap = cv2.VideoCapture(self.camera_url, cv2.CAP_FFMPEG)
                    new_cap.set(cv2.CAP_PROP_OPEN_TIMEOUT_MSEC, 10000)
                    new_cap.set(cv2.CAP_PROP_READ_TIMEOUT_MSEC,  5000)
                    new_cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)

                    if new_cap.isOpened():
                        ret, frame = new_cap.read()
                        if ret and frame is not None:
                            self.cap   = new_cap
                            self.frame = frame
                            reconnect_attempts = 0
                            print(f"[Camera {self.camera_id}] ✓ Reconnected successfully")
                        else:
                            new_cap.release()
                            reconnect_attempts += 1
                            print(f"[Camera {self.camera_id}] ✗ Reconnect failed (no frames)")
                    else:
                        new_cap.release()
                        reconnect_attempts += 1
                        print(f"[Camera {self.camera_id}] ✗ Reconnect failed (cannot open)")

                    continue

                # ── Normal frame read ─────────────────────────────────────────
                ret, frame = self.cap.read()

                if ret and frame is not None:
                    reconnect_attempts = 0
                    self.frame_count  += 1

                    if self.frame_count % process_every == 0:
                        self.frame = self._process_frame(frame)
                    else:
                        self.frame = self._draw_cached_boxes(frame)

                    self.fps_counter.update()

                    if self.frame_count % 300 == 0:
                        gc.collect()

                    time.sleep(0.01)
                else:
                    print(f"[Camera {self.camera_id}] Frame read failed — marking for reconnect")
                    if self.cap:
                        self.cap.release()
                        self.cap = None
                    time.sleep(0.5)

            except Exception as e:
                print(f"[Camera {self.camera_id}] Capture error: {e}")
                time.sleep(0.5)

        print(f"[Camera {self.camera_id}] Capture loop ended")
    
    def _detect_faces(self, frame):
        """Face detection using RetinaFace via DeepFace.extract_faces().
        Returns list of (x, y, w, h) tuples filtered by minimum size.
        """
        faces = []
        try:
            results = DeepFace.extract_faces(
                img_path=frame,
                detector_backend=DETECTOR_BACKEND,
                enforce_detection=False,
                align=True
            )

            for face_obj in results:
                facial_area = face_obj.get('facial_area', {})
                x  = facial_area.get('x', 0)
                y  = facial_area.get('y', 0)
                fw = facial_area.get('w', 0)
                fh = facial_area.get('h', 0)

                if fw >= MIN_FACE_SIZE and fh >= MIN_FACE_SIZE:
                    faces.append((x, y, fw, fh))

        except Exception as e:
            if "face" not in str(e).lower():
                print(f"[Camera {self.camera_id}] Face detection error: {e}")

        return faces
    
    def _non_max_suppression(self, faces, overlap_thresh=0.3):
        """Remove overlapping face detections"""
        if len(faces) == 0:
            return []
        
        boxes = np.array(faces)
        x1 = boxes[:, 0]
        y1 = boxes[:, 1]
        x2 = boxes[:, 0] + boxes[:, 2]
        y2 = boxes[:, 1] + boxes[:, 3]
        areas = boxes[:, 2] * boxes[:, 3]
        
        # Sort by area (largest first)
        idxs = np.argsort(areas)[::-1]
        
        pick = []
        while len(idxs) > 0:
            i = idxs[0]
            pick.append(i)
            
            xx1 = np.maximum(x1[i], x1[idxs[1:]])
            yy1 = np.maximum(y1[i], y1[idxs[1:]])
            xx2 = np.minimum(x2[i], x2[idxs[1:]])
            yy2 = np.minimum(y2[i], y2[idxs[1:]])
            
            w = np.maximum(0, xx2 - xx1)
            h = np.maximum(0, yy2 - yy1)
            
            overlap = (w * h) / areas[idxs[1:]]
            
            idxs = idxs[np.where(overlap <= overlap_thresh)[0] + 1]
        
        return [faces[i] for i in pick]
    
    def _process_frame(self, frame):
        """OPTIMIZED: Process frame with better recognition"""
        display = frame.copy()
        
        # Detect faces
        faces = self._detect_faces(frame)
        self.stats['total_detections'] += len(faces)
        
        detections = []
        recognized_this_frame = []
        
        for (x, y, w, h) in faces:
            bbox = (x, y, w, h)
            
            # Check cache first (avoid re-recognition)
            cached_person, cached_dist, cached_conf = self.face_tracker.get_person_for_bbox(bbox)

            if cached_person is not None:
                # Use cached result (cached_person is a dict or None)
                person_dict = cached_person
                distance    = cached_dist
                confidence  = cached_conf
            else:
                # Need to recognize
                person_dict, distance, confidence = self._recognize_face(frame, x, y, w, h)

            # Store detection for tracking
            detections.append({
                'bbox':       bbox,
                'person':     person_dict,
                'distance':   distance,
                'confidence': confidence
            })

            # Draw bounding box
            if person_dict is not None:
                color = (0, 255, 0)  # Green for recognized
                label = f"{person_dict['name']} ({confidence:.0%})"
                self.stats['known_faces'] += 1

                # Handle recognition event (database update)
                if self._should_record_recognition(person_dict):
                    recognized_this_frame.append({
                        'name':      person_dict['name'],
                        'role':      person_dict['role'],
                        'person_id': person_dict['person_id'],
                        'distance':  distance,
                        'confidence': confidence
                    })
                    self._handle_recognition(person_dict, distance)
            else:
                color = (0, 0, 255)  # Red for unknown
                label = f"Unknown ({distance:.1f})" if distance else "Detecting..."
                self.stats['unknown_faces'] += 1
            
            # Draw box and label
            cv2.rectangle(display, (x, y), (x + w, y + h), color, 2)
            
            # Draw label with background
            label_size = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 2)[0]
            cv2.rectangle(display, (x, y - 25), (x + label_size[0] + 10, y), color, -1)
            cv2.putText(display, label, (x + 5, y - 8),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 2)
        
        # Update face tracker
        self.face_tracker.update(detections, self.frame_count)
        
        # Store recognized persons for API
        self.recognized_persons = recognized_this_frame
        
        # Draw info panel
        self._draw_info_panel(display, len(faces))
        
        return display
    
    def _draw_cached_boxes(self, frame):
        """Draw boxes from cached tracking data"""
        display = frame.copy()
        
        with self.face_tracker.lock:
            for track_id, track in self.face_tracker.tracks.items():
                bbox        = track['bbox']
                person_dict = track.get('person')
                confidence  = track.get('confidence', 0)

                x, y, w, h = bbox

                if person_dict is not None:
                    color = (0, 255, 0)
                    label = f"{person_dict['name']} ({confidence:.0%})"
                else:
                    color = (0, 0, 255)
                    label = "Unknown"
                
                cv2.rectangle(display, (x, y), (x + w, y + h), color, 2)
                cv2.putText(display, label, (x, y - 10),
                           cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)
        
        self._draw_info_panel(display, len(self.face_tracker.tracks))
        return display
    
    def _draw_info_panel(self, display, face_count):
        """Draw information panel on frame"""
        fps = self.fps_counter.get_fps()
        
        # Semi-transparent background
        overlay = display.copy()
        cv2.rectangle(overlay, (5, 5), (200, 100), (0, 0, 0), -1)
        cv2.addWeighted(overlay, 0.5, display, 0.5, 0, display)
        
        cv2.putText(display, f"FPS: {fps:.1f}", (10, 25),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)
        cv2.putText(display, f"Faces: {face_count}", (10, 50),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)
        cv2.putText(display, f"Type: {self.camera_type}", (10, 75),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
        cv2.putText(display, f"Zone: {self.zone_id}", (10, 95),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.5, (200, 200, 200), 1)
    
    def _recognize_face(self, frame, x, y, w, h):
        """OPTIMIZED: Recognize face with better accuracy"""
        global embedding_index

        # Extract face with margin for better recognition
        margin_ratio = 0.2
        margin_x = int(w * margin_ratio)
        margin_y = int(h * margin_ratio)
        
        y1 = max(0, y - margin_y)
        y2 = min(frame.shape[0], y + h + margin_y)
        x1 = max(0, x - margin_x)
        x2 = min(frame.shape[1], x + w + margin_x)
        
        face_crop = frame[y1:y2, x1:x2]
        
        # Validate face crop
        if face_crop.size == 0 or face_crop.shape[0] < 30 or face_crop.shape[1] < 30:
            return None, None, 0
        
        try:
            # Preprocess: upscale small faces + CLAHE for low-light, then resize to FaceNet input size
            face_preprocessed = preprocess_face_crop(face_crop)
            face_resized = cv2.resize(face_preprocessed, (160, 160))

            # Generate embedding
            with embeddings_lock:
                results = DeepFace.represent(
                    img_path=face_resized,
                    model_name=MODEL_NAME,
                    detector_backend="skip",  # Already detected
                    enforce_detection=False,
                    align=True  # Enable alignment for better accuracy
                )
            
            if results and len(results) > 0:
                embedding = results[0]["embedding"]
                self.stats['total_recognitions'] += 1
                
                # Find best match with confidence
                person_dict, distance, confidence = (
                    embedding_index.search_with_confidence(embedding, DISTANCE_THRESHOLD)
                    if embedding_index is not None
                    else (None, float('inf'), 0.0)
                )

                # Cleanup
                del results, embedding

                return person_dict, distance, confidence
                
        except Exception as e:
            # Only log unexpected errors
            if "face" not in str(e).lower():
                print(f"[Camera {self.camera_id}] Recognition error: {e}")
        
        return "Unknown", float('inf'), 0
    
    def _should_record_recognition(self, person_dict):
        """Check if we should record this recognition (cooldown)"""
        current_time = time.time()
        cache_key = f"{person_dict.get('person_id')}|{person_dict.get('role', '')}"

        with self.cache_lock:
            last_time = self.recognition_cache.get(cache_key, 0)

            if current_time - last_time >= RECOGNITION_COOLDOWN:
                self.recognition_cache[cache_key] = current_time

                # Limit cache size
                if len(self.recognition_cache) > MAX_CACHE_SIZE:
                    oldest = min(self.recognition_cache, key=self.recognition_cache.get)
                    del self.recognition_cache[oldest]

                return True

        return False

    def _handle_recognition(self, person_dict, distance):
        """Handle recognized person — update database using explicit identity fields."""
        global db_handler

        try:
            # Read fields directly — no string parsing needed
            person_id   = person_dict['person_id']
            role        = person_dict['role']
            name        = person_dict['name']

            if person_id is None or role not in ('STUDENT', 'TEACHER'):
                print(f"[Warning] Invalid identity in person dict: {person_dict!r}")
                return

            person_type = 'Student' if role == 'STUDENT' else 'Teacher'

            if self.camera_type == 'Entry':
                db_handler.mark_entry(person_id, person_type, self.zone_id, self.camera_id)
                print(f"[Entry] ✓ {name} ({role}) entered Zone {self.zone_id}")
            elif self.camera_type == 'Exit':
                db_handler.mark_exit(person_id, person_type, self.zone_id, self.camera_id)
                print(f"[Exit] ✓ {name} ({role}) exited Zone {self.zone_id}")

        except Exception as e:
            print(f"[DB Error] {e}")
    
    def get_frame(self):
        """Get current frame as JPEG bytes"""
        if self.frame is not None:
            ret, jpeg = cv2.imencode('.jpg', self.frame, [
                cv2.IMWRITE_JPEG_QUALITY, 80
            ])
            if ret:
                return jpeg.tobytes()
        return None
    
    def get_stats(self):
        """Get recognition statistics"""
        return {
            'camera_id': self.camera_id,
            'zone_id': self.zone_id,
            'camera_type': self.camera_type,
            'is_running': self.is_running,
            'fps': self.fps_counter.get_fps(),
            'frame_count': self.frame_count,
            'active_tracks': len(self.face_tracker.tracks),
            'stats': self.stats.copy()
        }
    
    def stop(self):
        """Stop camera stream with proper cleanup"""
        print(f"[Camera {self.camera_id}] Stopping...")
        self.is_running = False
        
        # Clear caches
        self.face_tracker.clear()
        self.recognition_cache.clear()
        
        # Release camera
        if self.cap:
            self.cap.release()
            self.cap = None
        
        # Force garbage collection
        gc.collect()
        print(f"[Camera {self.camera_id}] Stopped and cleaned up")


# ==================== Flask API Endpoints ====================

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
    
    camera = CameraStream(camera_id, camera_url, camera_type, zone_id)
    
    if camera.is_running:
        active_cameras[camera_id] = camera
        return jsonify({'success': True, 'message': f'Camera {camera_id} started'})
    else:
        return jsonify({'error': 'Failed to connect to camera'}), 500


@app.route('/cameras/stop/<int:camera_id>', methods=['POST'])
def stop_camera(camera_id):
    """Stop a camera stream"""
    if camera_id in active_cameras:
        active_cameras[camera_id].stop()
        del active_cameras[camera_id]
        gc.collect()
        return jsonify({'success': True, 'message': f'Camera {camera_id} stopped'})
    else:
        return jsonify({'error': 'Camera not found'}), 404


@app.route('/cameras/list', methods=['GET'])
def list_cameras():
    """List all active cameras with stats"""
    cameras_info = []
    for camera_id, camera in active_cameras.items():
        cameras_info.append(camera.get_stats())
    
    return jsonify({'cameras': cameras_info})


@app.route('/stream/<int:camera_id>')
def stream_camera(camera_id):
    """Stream camera feed"""
    def generate():
        while camera_id in active_cameras:
            frame = active_cameras[camera_id].get_frame()
            if frame:
                yield (b'--frame\r\n'
                       b'Content-Type: image/jpeg\r\n\r\n' + frame + b'\r\n')
            time.sleep(0.033)  # ~30 FPS max
    
    if camera_id in active_cameras:
        return Response(generate(), 
                       mimetype='multipart/x-mixed-replace; boundary=frame')
    else:
        return jsonify({'error': 'Camera not found'}), 404


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
            'failed': failed
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/zones/<int:zone_id>/stop_all', methods=['POST'])
def stop_zone_cameras(zone_id):
    """Stop all cameras for a zone"""
    stopped = []
    for camera_id, camera in list(active_cameras.items()):
        if camera.zone_id == zone_id:
            camera.stop()
            del active_cameras[camera_id]
            stopped.append(camera_id)
    
    gc.collect()
    return jsonify({'success': True, 'stopped': stopped})


@app.route('/embeddings/reload', methods=['POST'])
def reload_embeddings():
    """Reload embeddings from file"""
    global embeddings_data, embedding_index

    with embeddings_lock:
        embeddings_data = load_embeddings_from_json(EMBEDDINGS_FILE)
        embedding_index = EmbeddingIndex(embeddings_data)
    
    return jsonify({
        'success': True,
        'loaded': len(embeddings_data)
    })


@app.route('/stats', methods=['GET'])
def get_stats():
    """Get overall statistics"""
    total_stats = {
        'active_cameras': len(active_cameras),
        'known_persons': len(embeddings_data),
        'cameras': {}
    }
    
    for camera_id, camera in active_cameras.items():
        total_stats['cameras'][camera_id] = camera.get_stats()
    
    return jsonify(total_stats)


def initialize():
    """Initialize the service"""
    global embeddings_data, embedding_index, db_handler

    print("=" * 70)
    print("IntelliSight - OPTIMIZED Camera Streaming Service v2.0")
    print("=" * 70)

    # Load embeddings and build vectorized index
    embeddings_data = load_embeddings_from_json(EMBEDDINGS_FILE)
    embedding_index = EmbeddingIndex(embeddings_data)
    print(f"✓ Loaded {len(embeddings_data)} face embeddings ({len(embedding_index)} vectors in index)")
    
    if len(embeddings_data) == 0:
        print("⚠ WARNING: No embeddings loaded! Recognition will not work.")
        print("  Run 'python train.py --train' to generate embeddings first.")
    
    # Initialize database handler
    db_handler = DatabaseHandler()
    print("✓ Database connected")
    
    # Auto-start all cameras
    print("\n[*] Auto-starting cameras from database...")
    auto_start_all_cameras()
    
    print("=" * 70)
    print("Service ready! API running on http://0.0.0.0:5001")
    print("=" * 70)


def auto_start_all_cameras():
    """Auto-start all cameras from database"""
    global active_cameras, db_handler
    
    try:
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
                print(f"[!] Camera {camera_id}: No URL configured")
                continue
            
            print(f"[*] Starting Camera {camera_id} ({camera_type}) - Zone: {zone_name}...")
            
            try:
                cam_stream = CameraStream(camera_id, camera_url, camera_type, zone_id)
                
                if cam_stream.is_running:
                    active_cameras[camera_id] = cam_stream
                    print(f"[✓] Camera {camera_id} started")
                    started += 1
                else:
                    print(f"[✗] Camera {camera_id} failed to connect")
                    failed += 1
            except Exception as e:
                print(f"[✗] Camera {camera_id}: {e}")
                failed += 1
        
        print(f"\n[*] Auto-start complete: {started} started, {failed} failed")
        
    except Exception as e:
        print(f"[ERROR] Failed to auto-start cameras: {e}")


if __name__ == '__main__':
    initialize()
    app.run(host='0.0.0.0', port=5001, threaded=True, debug=False)
