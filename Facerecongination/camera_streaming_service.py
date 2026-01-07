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

import cv2
import numpy as np
import json
import time
import threading
import gc
import queue
from concurrent.futures import ThreadPoolExecutor
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
embeddings_cache = {}  # {person_name: [embeddings]} - Memory cache
db_handler = None
embeddings_lock = threading.Lock()

# Thread pool for parallel processing
recognition_executor = ThreadPoolExecutor(max_workers=4)

# ============================================================================
# CPU-OPTIMIZED DETECTION SETTINGS
# ============================================================================
# Primary: OpenCV Haar Cascade (fastest on CPU)
# Fallback: DeepFace SSD (more accurate but slower)
# Frame throttling: Process every 3rd frame to reduce CPU load
# ============================================================================
DETECTOR_BACKEND = "opencv"  # Fast Haar cascade for CPU
SCORE_THRESHOLD = 0.35       # Lower threshold for better detection
RECOGNITION_COOLDOWN = 3.0   # 3 second cooldown between same person detections
MAX_CACHE_SIZE = 100
FRAME_PROCESS_INTERVAL = 3   # Process every 3rd frame (CPU optimization)
MAX_FRAME_QUEUE = 1          # Drop stale frames immediately
CONSECUTIVE_MATCHES_REQUIRED = 2  # Require 2 consecutive matches for accuracy

# PERFORMANCE SETTINGS - Optimized for 720p @ 15fps input
TARGET_WIDTH = 1280       # Display width (720p)
TARGET_HEIGHT = 720       # Display height
PROCESS_WIDTH = 480       # Detection width (smaller = faster)
PROCESS_HEIGHT = 270      # Detection height
FACE_SIZE = 160           # Standard face size for embedding

# Preload Haar cascade once (shared across all cameras)
HAAR_CASCADE = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_alt2.xml')
HAAR_CASCADE_DEFAULT = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')


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
        
        # Consecutive match tracking for accuracy
        self.consecutive_matches = {}  # {person_name: count}
        self.last_match_frame = {}     # {person_name: frame_count}
        
        # Frame queue for dropping stale frames
        self.frame_queue = queue.Queue(maxsize=MAX_FRAME_QUEUE)
        
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
        """Background thread to continuously capture frames - CPU OPTIMIZED"""
        consecutive_failures = 0
        
        while self.is_running:
            try:
                # Grab frame (non-blocking if possible)
                ret = self.cap.grab()
                
                if ret:
                    consecutive_failures = 0
                    self.frame_count += 1
                    
                    # Only decode every Nth frame (frame throttling)
                    if self.frame_count % FRAME_PROCESS_INTERVAL == 0:
                        ret, frame = self.cap.retrieve()
                        
                        if ret and frame is not None:
                            # Resize to 720p for display
                            h, w = frame.shape[:2]
                            if w > TARGET_WIDTH:
                                frame = cv2.resize(frame, (TARGET_WIDTH, TARGET_HEIGHT), 
                                                 interpolation=cv2.INTER_LINEAR)
                            
                            # Process face detection and recognition
                            self.frame = self._process_frame(frame)
                            self.fps_counter.update()
                    else:
                        # Use cached frame with boxes (no processing)
                        if self.frame is not None:
                            pass  # Keep existing frame
                        self.fps_counter.update()
                    
                    # Periodic cleanup
                    if self.frame_count % 300 == 0:
                        gc.collect()
                    
                    # Small sleep to prevent CPU hogging
                    time.sleep(0.005)
                else:
                    consecutive_failures += 1
                    if consecutive_failures > 10:
                        print(f"[Camera {self.camera_id}] Too many failures, reconnecting...")
                        time.sleep(1)
                        self.cap.release()
                        self.cap = cv2.VideoCapture(self.camera_url, cv2.CAP_FFMPEG)
                        consecutive_failures = 0
                    else:
                        time.sleep(0.1)
                    
            except Exception as e:
                print(f"[Camera {self.camera_id}] Capture error: {e}")
                time.sleep(0.3)
    
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
                
                # Save unknown face to database
                self._handle_unknown_face(face_crop, distance)
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
        Face detection - CPU OPTIMIZED
        PRIMARY: OpenCV Haar Cascade (fastest on CPU)
        FALLBACK: DeepFace OpenCV DNN (more accurate, slower)
        """
        faces = []
        
        # PRIMARY: OpenCV Haar Cascade (FASTEST on CPU)
        try:
            # Convert to grayscale
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            
            # Apply histogram equalization for lighting normalization
            gray = cv2.equalizeHist(gray)
            
            # Use preloaded cascade (no file I/O per frame)
            haar_faces = HAAR_CASCADE.detectMultiScale(
                gray,
                scaleFactor=1.15,      # Faster scaling
                minNeighbors=4,        # Balance speed/accuracy
                minSize=(40, 40),      # Minimum face size
                maxSize=(300, 300),    # Maximum face size
                flags=cv2.CASCADE_SCALE_IMAGE
            )
            
            for (x, y, w, h) in haar_faces:
                faces.append({
                    'x': int(x), 'y': int(y), 'w': int(w), 'h': int(h),
                    'confidence': 0.8,
                    'face': None
                })
            
            # If Haar found faces, return immediately (fast path)
            if faces:
                return faces
            
            # Try default cascade as backup
            haar_faces = HAAR_CASCADE_DEFAULT.detectMultiScale(
                gray,
                scaleFactor=1.2,
                minNeighbors=3,
                minSize=(30, 30)
            )
            
            for (x, y, w, h) in haar_faces:
                faces.append({
                    'x': int(x), 'y': int(y), 'w': int(w), 'h': int(h),
                    'confidence': 0.7,
                    'face': None
                })
            
            if faces:
                return faces
                
        except Exception as e:
            print(f"[Camera {self.camera_id}] Haar detection error: {e}")
        
        # FALLBACK: DeepFace OpenCV DNN (slower but more accurate)
        try:
            results = DeepFace.extract_faces(
                img_path=frame,
                detector_backend="opencv",  # OpenCV DNN (faster than SSD)
                enforce_detection=False,
                align=False  # Skip alignment for speed
            )
            
            for face_obj in results:
                conf = face_obj.get('confidence', 0)
                if conf >= 0.25:
                    facial_area = face_obj.get('facial_area', {})
                    x = facial_area.get('x', 0)
                    y = facial_area.get('y', 0)
                    fw = facial_area.get('w', 0)
                    fh = facial_area.get('h', 0)
                    
                    if fw > 25 and fh > 25:
                        faces.append({
                            'x': x, 'y': y, 'w': fw, 'h': fh,
                            'confidence': conf,
                            'face': face_obj.get('face', None)
                        })
                
        except Exception as e:
            if "face" not in str(e).lower():
                print(f"[Camera {self.camera_id}] DeepFace fallback error: {e}")
        
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
        """Recognize a face using DeepFace - CPU OPTIMIZED without heavy preprocessing"""
        global embeddings_data
        
        # Check if face crop is valid
        if face_crop.size == 0 or face_crop.shape[0] < 30 or face_crop.shape[1] < 30:
            return None, None
        
        try:
            # Simple resize to standard face size (160x160 for FaceNet) - NO color conversion
            face_resized = cv2.resize(face_crop, (160, 160), interpolation=cv2.INTER_LINEAR)
            
            # Use thread lock to prevent concurrent DeepFace calls
            with embeddings_lock:
                results = DeepFace.represent(
                    img_path=face_resized,
                    model_name=MODEL_NAME,
                    detector_backend="skip",  # Skip detection, already have face
                    enforce_detection=False,
                    align=True  # Enable alignment for better matching
                )
            
            if results and len(results) > 0:
                embedding = results[0]["embedding"]
                person, distance = find_best_match(embedding, embeddings_data, DISTANCE_THRESHOLD)
                
                # DEBUG: Log recognition results
                if person != "Unknown":
                    print(f"[Camera {self.camera_id}] ✓ MATCH: {person} (distance: {distance:.4f}, threshold: {DISTANCE_THRESHOLD})")
                else:
                    print(f"[Camera {self.camera_id}] ✗ NO MATCH: Best distance: {distance:.4f} > threshold {DISTANCE_THRESHOLD}")
                
                # Cleanup
                del results
                
                return person, distance
                
        except Exception as e:
            # Only log non-face related errors
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
            
            # Calculate confidence (inverse of distance)
            confidence = max(0.0, min(1.0, 1.0 - (distance / 20.0))) if distance else 0.5
            
            # Save to database
            db_handler.save_unknown_face(image_bytes, self.zone_id, confidence)
            print(f"[Camera {self.camera_id}] ⚠ Unknown face saved to database (distance: {distance:.2f})")
            
        except Exception as e:
            print(f"[Camera {self.camera_id}] Error saving unknown face: {e}")
    
    def _handle_recognition(self, person, distance):
        """Handle recognized person with consecutive match verification for accuracy"""
        global db_handler
        
        # Track consecutive matches for accuracy
        current_frame = self.frame_count
        last_frame = self.last_match_frame.get(person, 0)
        
        # Check if this is a consecutive match (within 10 frames)
        if current_frame - last_frame <= 10:
            self.consecutive_matches[person] = self.consecutive_matches.get(person, 0) + 1
        else:
            self.consecutive_matches[person] = 1  # Reset counter
        
        self.last_match_frame[person] = current_frame
        
        # Only proceed if we have enough consecutive matches
        if self.consecutive_matches[person] < CONSECUTIVE_MATCHES_REQUIRED:
            print(f"[Camera {self.camera_id}] Verifying {person}... ({self.consecutive_matches[person]}/{CONSECUTIVE_MATCHES_REQUIRED})")
            return
        
        # Per-person cooldown to avoid spam after confirmed detection
        current_time = time.time()
        last_time = self.last_recognition_time.get(person, 0)
        
        if current_time - last_time < RECOGNITION_COOLDOWN:
            return  # Skip if recently confirmed
        
        self.last_recognition_time[person] = current_time
        
        # Reset consecutive counter after successful recognition
        self.consecutive_matches[person] = 0
        
        # Limit cache size to prevent memory leak
        if len(self.last_recognition_time) > MAX_CACHE_SIZE:
            oldest = min(self.last_recognition_time, key=self.last_recognition_time.get)
            del self.last_recognition_time[oldest]
        
        try:
            # Try to find person in database by exact name match
            person_id, person_type = self._find_person_in_db(person)
            
            if person_id:
                if self.camera_type == 'Entry':
                    result = db_handler.add_to_active_presence(person_id, person_type, self.zone_id)
                    if result:
                        print(f"[Entry] ✅ {person} ({person_type}) entered Zone {self.zone_id}")
                    else:
                        print(f"[Entry] ℹ️ {person} already in Zone {self.zone_id}")
                    
                elif self.camera_type == 'Exit':
                    result = db_handler.remove_from_active_presence(person_id, person_type, self.zone_id)
                    if result:
                        print(f"[Exit] ✅ {person} ({person_type}) left Zone {self.zone_id} - Log completed")
                    else:
                        print(f"[Exit] ℹ️ {person} was not in Zone {self.zone_id}")
            else:
                print(f"[Warning] Person '{person}' not found in database")
                
        except Exception as e:
            print(f"[Database Error] {e}")
    
    def _find_person_in_db(self, person_name):
        """Find person ID and type from database by name"""
        global db_handler
        
        try:
            # Clean up person name (remove any role suffix like "-Student")
            clean_name = person_name.rsplit('-', 1)[0] if '-' in person_name else person_name
            clean_name = clean_name.replace('_', ' ')  # Handle underscores
            
            with db_handler.conn.cursor() as cur:
                # Try to find as Student first
                cur.execute('''SELECT "Student_ID" FROM "Students" WHERE "Name" ILIKE %s''', (f'%{clean_name}%',))
                result = cur.fetchone()
                if result:
                    return result[0], 'Student'
                
                # Try to find as Teacher
                cur.execute('''SELECT "Teacher_ID" FROM "Teacher" WHERE "Name" ILIKE %s''', (f'%{clean_name}%',))
                result = cur.fetchone()
                if result:
                    return result[0], 'Teacher'
                
        except Exception as e:
            print(f"[DB] Error finding person: {e}")
        
        return None, None
    
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
    
    # Auto-start all cameras from database
    print("\n[*] Auto-starting all cameras from database...")
    auto_start_all_cameras()
    
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
