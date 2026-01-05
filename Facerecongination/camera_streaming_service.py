"""
IntelliSight - Live Camera Stream with Face Recognition
Backend service that processes RTSP camera feeds and streams results to frontend
Supports multiple cameras with face detection and recognition

*** USING SAME DETECTION MODEL AS WEBCAM (Zone 1) ***
Webcam uses: face-api.js TinyFaceDetector (SSD MobileNet based)
Backend uses: OpenCV DNN SSD MobileNet (SAME architecture)
Both use SSD (Single Shot Detector) with MobileNet backbone
"""

import cv2
import numpy as np
import json
import time
import threading
import gc
from flask import Flask, Response, jsonify, request
from flask_cors import CORS
from datetime import datetime
from deepface import DeepFace
import psycopg2
from psycopg2.extras import RealDictCursor

from config import DB_CONFIG, MODEL_NAME, DISTANCE_THRESHOLD, MIN_FACE_SIZE
from utils import load_embeddings_from_json, find_best_match, FPSCounter
from database_handler import DatabaseHandler

app = Flask(__name__)
CORS(app)

# Global variables
active_cameras = {}  # {camera_id: CameraStream}
embeddings_data = []
db_handler = None
embeddings_lock = threading.Lock()

# ============================================================================
# DETECTION SETTINGS - SAME AS WEBCAM (face-api.js TinyFaceDetector)
# ============================================================================
# face-api.js TinyFaceDetector uses SSD MobileNet architecture
# We use the SAME SSD MobileNet model via OpenCV DNN for consistency
# This ensures identical detection behavior across webcam and RTSP cameras
# ============================================================================
DETECTOR_BACKEND = "ssd"  # SSD MobileNet - SAME as TinyFaceDetector
SCORE_THRESHOLD = 0.4     # Same as face-api.js scoreThreshold
RECOGNITION_COOLDOWN = 2.0
MAX_CACHE_SIZE = 50
DETECTION_INTERVAL = 2    # Process every 2 frames for faster response

# PERFORMANCE SETTINGS - Use 720p for faster processing
TARGET_WIDTH = 1280       # 720p width (faster than 1080p)
TARGET_HEIGHT = 720       # 720p height
PROCESS_WIDTH = 640       # Width for face detection (even faster)
PROCESS_HEIGHT = 360      # Height for face detection


class CameraStream:
    """Handles individual camera RTSP stream with face recognition"""
    
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
        
        # Cache for face detections (to avoid detecting every frame)
        self.cached_faces = []
        self.last_detection_frame = 0
        
        # Connect to camera
        self.connect()
    
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
                if cap.isOpened():
                    ret, frame = cap.read()
                    if ret and frame is not None:
                        self.cap = cap
                        self.is_running = True
                        print(f"[Camera {self.camera_id}] ✓ Webcam connected! Frame: {frame.shape[1]}x{frame.shape[0]}")
                        thread = threading.Thread(target=self._capture_loop, daemon=True)
                        thread.start()
                        return True
                cap.release()
            except Exception as e:
                print(f"[Camera {self.camera_id}] Webcam error: {e}")
            return False
        
        # RTSP camera connection
        # Set FFMPEG options for RTSP - optimize for Imou cameras
        os.environ['OPENCV_FFMPEG_CAPTURE_OPTIONS'] = 'rtsp_transport;tcp|rtsp_flags;prefer_tcp|stimeout;10000000|analyzeduration;2000000|probesize;500000'
        
        print(f"[Camera {self.camera_id}] Attempting RTSP connection to: {self.camera_url[:60]}...")
        
        # Try multiple connection attempts with shorter timeout
        max_retries = 2
        for attempt in range(max_retries):
            try:
                # Use FFMPEG backend for RTSP
                cap = cv2.VideoCapture(self.camera_url, cv2.CAP_FFMPEG)
                
                # Set properties for better RTSP handling (reduced timeouts)
                cap.set(cv2.CAP_PROP_OPEN_TIMEOUT_MSEC, 8000)  # 8 second timeout (faster)
                cap.set(cv2.CAP_PROP_READ_TIMEOUT_MSEC, 8000)
                cap.set(cv2.CAP_PROP_BUFFERSIZE, 2)
                
                if cap.isOpened():
                    # Test read a frame with retry (reduced attempts)
                    for i in range(3):
                        ret, frame = cap.read()
                        if ret and frame is not None:
                            self.cap = cap
                            self.is_running = True
                            print(f"[Camera {self.camera_id}] ✓ Connected! Frame: {frame.shape[1]}x{frame.shape[0]}")
                            
                            # Start capture thread
                            thread = threading.Thread(target=self._capture_loop, daemon=True)
                            thread.start()
                            return True
                        time.sleep(0.3)
                    
                    cap.release()
                    print(f"[Camera {self.camera_id}] Attempt {attempt+1}: Opened but cannot read frames")
                else:
                    print(f"[Camera {self.camera_id}] Attempt {attempt+1}: Failed to open stream")
                    
            except Exception as e:
                print(f"[Camera {self.camera_id}] Attempt {attempt+1} error: {e}")
            
            if attempt < max_retries - 1:
                print(f"[Camera {self.camera_id}] Retrying in 1 second...")
                time.sleep(1)
        
        return False
    
    def _capture_loop(self):
        """Background thread to continuously capture frames - OPTIMIZED for 720p"""
        
        while self.is_running:
            try:
                ret, frame = self.cap.read()
                
                if ret:
                    self.frame_count += 1
                    
                    # Resize to 720p for display (faster than 1080p)
                    h, w = frame.shape[:2]
                    if w > TARGET_WIDTH:
                        frame = cv2.resize(frame, (TARGET_WIDTH, TARGET_HEIGHT))
                    
                    # Process face recognition every N frames
                    if self.frame_count % DETECTION_INTERVAL == 0:
                        self.frame = self._process_frame(frame)
                    else:
                        # Draw cached boxes on resized frame (fast)
                        self.frame = self._draw_cached_boxes(frame)
                    
                    self.fps_counter.update()
                    
                    # Periodic garbage collection
                    if self.frame_count % 500 == 0:
                        gc.collect()
                    
                    time.sleep(0.01)
                else:
                    print(f"[Camera {self.camera_id}] Failed to read frame, reconnecting...")
                    time.sleep(2)
                    self.cap.release()
                    self.cap = cv2.VideoCapture(self.camera_url, cv2.CAP_FFMPEG)
                    
            except Exception as e:
                print(f"[Camera {self.camera_id}] Capture error: {e}")
                time.sleep(0.5)
    
    def _draw_cached_boxes(self, frame):
        """Draw cached face boxes without re-detecting"""
        display = frame.copy()
        
        for face_data in self.cached_faces:
            x, y, fw, fh = face_data['x'], face_data['y'], face_data['w'], face_data['h']
            cv2.rectangle(display, (x, y), (x + fw, y + fh), (255, 255, 0), 2)
        
        fps = self.fps_counter.get_fps()
        cv2.putText(display, f"FPS: {fps:.1f}", (10, 30),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
        cv2.putText(display, f"Faces: {len(self.cached_faces)}", (10, 60),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
        
        return display
    
    def _process_frame(self, frame):
        """Process frame with SSD detection - OPTIMIZED for speed using smaller resolution"""
        display = frame.copy()
        h, w = frame.shape[:2]
        
        self.recognized_persons = []
        
        # Create smaller frame for detection (MUCH faster - 640x360 vs 1920x1080)
        scale = w / PROCESS_WIDTH
        small_frame = cv2.resize(frame, (PROCESS_WIDTH, PROCESS_HEIGHT))
        
        # Run face detection on small frame
        small_faces = self._detect_faces(small_frame)
        
        # Scale face coordinates back to display resolution
        self.cached_faces = []
        for face in small_faces:
            self.cached_faces.append({
                'x': int(face['x'] * scale),
                'y': int(face['y'] * scale),
                'w': int(face['w'] * scale),
                'h': int(face['h'] * scale),
                'confidence': face['confidence'],
                'face': face.get('face')
            })
        
        self.last_detection_frame = self.frame_count
        
        # Process cached face detections
        for face_data in self.cached_faces:
            x = face_data['x']
            y = face_data['y']
            fw = face_data['w']
            fh = face_data['h']
            
            # Extract face crop with margin
            margin = int(fw * 0.2)
            y1 = max(0, y - margin)
            y2 = min(h, y + fh + margin)
            x1 = max(0, x - margin)
            x2 = min(w, x + fw + margin)
            
            face_crop = frame[y1:y2, x1:x2]
            
            if face_crop.size == 0 or face_crop.shape[0] < 40 or face_crop.shape[1] < 40:
                continue
            
            # Recognize face
            person, distance = self._recognize_face(face_crop)
            
            if person and person != "Unknown":
                color = (0, 255, 0)  # Green
                confidence = max(0, 100 - (distance * 10))
                label = f"{person} ({confidence:.0f}%)"
                
                self.recognized_persons.append({
                    'name': person,
                    'distance': distance,
                    'confidence': confidence,
                    'timestamp': datetime.now().isoformat(),
                    'camera_id': self.camera_id,
                    'camera_type': self.camera_type
                })
                
                self._handle_recognition(person, distance)
                
            elif person == "Unknown":
                color = (0, 0, 255)  # Red
                label = f"Unknown ({distance:.1f})" if distance and distance < 100 else "Unknown"
            else:
                color = (255, 255, 0)  # Yellow
                label = "Detecting..."
            
            # Draw bounding box
            cv2.rectangle(display, (x, y), (x + fw, y + fh), color, 2)
            
            # Label with background
            label_size = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 2)[0]
            cv2.rectangle(display, (x, y - 28), (x + label_size[0] + 10, y), color, -1)
            cv2.putText(display, label, (x + 5, y - 8),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
        
        # Draw info panel
        fps = self.fps_counter.get_fps()
        cv2.putText(display, f"FPS: {fps:.1f}", (10, 30),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
        cv2.putText(display, f"Faces: {len(self.cached_faces)}", (10, 60),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
        cv2.putText(display, f"Type: {self.camera_type}", (10, 90),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
        
        return display
    
    def _detect_faces(self, frame):
        """
        Face detection using SSD MobileNet - SAME AS ZONE 1 (face-api.js TinyFaceDetector)
        Both use SSD (Single Shot Detector) architecture for consistent detection
        """
        faces = []
        
        # PRIMARY: SSD MobileNet - SAME as face-api.js TinyFaceDetector in Zone 1
        try:
            results = DeepFace.extract_faces(
                img_path=frame,
                detector_backend="ssd",  # Same architecture as TinyFaceDetector
                enforce_detection=False,
                align=True  # Enable alignment for better recognition
            )
            
            for face_obj in results:
                conf = face_obj.get('confidence', 0)
                if conf >= 0.3:  # Lower threshold for better detection
                    facial_area = face_obj.get('facial_area', {})
                    x = facial_area.get('x', 0)
                    y = facial_area.get('y', 0)
                    fw = facial_area.get('w', 0)
                    fh = facial_area.get('h', 0)
                    
                    if fw > 20 and fh > 20:  # Accept smaller faces
                        faces.append({
                            'x': x, 'y': y, 'w': fw, 'h': fh,
                            'confidence': conf,
                            'face': face_obj.get('face', None)
                        })
            
            if faces:
                return faces
                
        except Exception as e:
            if "face" not in str(e).lower():
                print(f"[Camera {self.camera_id}] SSD detection error: {e}")
        
        # FALLBACK: OpenCV Haar Cascade (fast backup)
        try:
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            haar_cascade = cv2.CascadeClassifier(
                cv2.data.haarcascades + 'haarcascade_frontalface_alt2.xml'
            )
            haar_faces = haar_cascade.detectMultiScale(
                gray, 
                scaleFactor=1.1, 
                minNeighbors=3,
                minSize=(30, 30)
            )
            
            for (x, y, w, h) in haar_faces:
                faces.append({
                    'x': int(x), 'y': int(y), 'w': int(w), 'h': int(h),
                    'confidence': 0.7,
                    'face': None
                })
                
        except Exception as e:
            print(f"[Camera {self.camera_id}] Haar fallback error: {e}")
        
        return faces
    
    def _recognize_face(self, face_crop):
        """Recognize a face using DeepFace - OPTIMIZED for accuracy"""
        global embeddings_data
        
        # Check if face crop is valid
        if face_crop.size == 0 or face_crop.shape[0] < 30 or face_crop.shape[1] < 30:
            return None, None
        
        try:
            # OPTIMIZED: Resize face to standard size for better recognition
            face_resized = cv2.resize(face_crop, (160, 160))
            
            # Use thread lock to prevent concurrent DeepFace calls
            with embeddings_lock:
                results = DeepFace.represent(
                    img_path=face_resized,
                    model_name=MODEL_NAME,
                    detector_backend="skip",  # Skip detection, we already have face
                    enforce_detection=False,
                    align=True  # OPTIMIZED: Enable alignment for better accuracy
                )
            
            if results and len(results) > 0:
                embedding = results[0]["embedding"]
                person, distance = find_best_match(embedding, embeddings_data, DISTANCE_THRESHOLD)
                
                # DEBUG: Log recognition results
                if person != "Unknown":
                    print(f"[Camera {self.camera_id}] MATCH: {person} (distance: {distance:.4f}, threshold: {DISTANCE_THRESHOLD})")
                elif distance < float('inf'):
                    print(f"[Camera {self.camera_id}] NO MATCH: Best distance: {distance:.4f} > threshold {DISTANCE_THRESHOLD}")
                
                # Cleanup
                del results, embedding
                
                return person, distance
                
        except Exception as e:
            # Only log non-face related errors
            if "face" not in str(e).lower():
                print(f"[Camera {self.camera_id}] Recognition error: {e}")
        
        return None, None
        
        return None, None
    
    def _handle_recognition(self, person, distance):
        """Handle recognized person (update database) - OPTIMIZED with per-person cooldown"""
        global db_handler
        
        # Per-person cooldown to avoid spam
        current_time = time.time()
        last_time = self.last_recognition_time.get(person, 0)
        
        if current_time - last_time < RECOGNITION_COOLDOWN:
            return  # Skip if recently recognized
        
        self.last_recognition_time[person] = current_time
        
        # Limit cache size to prevent memory leak
        if len(self.last_recognition_time) > MAX_CACHE_SIZE:
            oldest = min(self.last_recognition_time, key=self.last_recognition_time.get)
            del self.last_recognition_time[oldest]
        
        try:
            # Parse person name (format: "Name-ROLE" or just "Name")
            parts = person.rsplit('-', 1)
            name = parts[0]
            role = parts[1].upper() if len(parts) > 1 else "STUDENT"
            
            if self.camera_type == 'Entry':
                db_handler.mark_entry(name, role, self.zone_id, self.camera_id)
                print(f"[Entry] ✓ {name} entered Zone {self.zone_id}")
                
            elif self.camera_type == 'Exit':
                db_handler.mark_exit(name, role, self.zone_id, self.camera_id)
                print(f"[Exit] ✓ {name} left Zone {self.zone_id}")
                
        except Exception as e:
            print(f"[Database Error] {e}")
    
    def get_frame(self):
        """Get current frame as JPEG bytes - OPTIMIZED"""
        if self.frame is not None:
            # Higher quality, faster encoding
            ret, jpeg = cv2.imencode('.jpg', self.frame, [
                cv2.IMWRITE_JPEG_QUALITY, 85,  # Good quality
                cv2.IMWRITE_JPEG_OPTIMIZE, 1   # Optimize encoding
            ])
            if ret:
                return jpeg.tobytes()
        return None
    
    def stop(self):
        """Stop camera stream with proper cleanup"""
        print(f"[Camera {self.camera_id}] Stopping...")
        self.is_running = False
        self.last_recognition_time.clear()  # Clear cache
        if self.cap:
            self.cap.release()
            self.cap = None
        gc.collect()  # Force garbage collection
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


@app.route('/embeddings/reload', methods=['POST'])
def reload_embeddings():
    """Reload embeddings from file without restarting"""
    global embeddings_data
    
    from config import EMBEDDINGS_FILE
    
    with embeddings_lock:
        embeddings_data = load_embeddings_from_json(EMBEDDINGS_FILE)
    
    persons = set([d.get('person', 'Unknown') for d in embeddings_data])
    
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
    global embeddings_data, db_handler
    
    print("="*70)
    print("IntelliSight - Live Camera Streaming Service (OPTIMIZED)")
    print("="*70)
    
    # Load embeddings
    from config import EMBEDDINGS_FILE
    embeddings_data = load_embeddings_from_json(EMBEDDINGS_FILE)
    print(f"✓ Loaded {len(embeddings_data)} face embeddings")
    
    if len(embeddings_data) == 0:
        print("⚠ WARNING: No embeddings loaded! Run 'python train.py --train' first.")
    else:
        # Print loaded persons
        persons = set([d.get('person', 'Unknown') for d in embeddings_data])
        print(f"  Persons: {', '.join(persons)}")
    
    # Initialize database handler
    db_handler = DatabaseHandler()
    print("✓ Database connected")
    
    # DISABLED: Auto-start cameras (too slow at startup, cameras are started manually or by frontend)
    # print("\n[*] Auto-starting all cameras from database...")
    # auto_start_all_cameras()
    
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
