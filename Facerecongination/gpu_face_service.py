"""
IntelliSight - GPU-Optimized Face Recognition Service
Uses CUDA acceleration for faster face detection and recognition
Port: 5001
"""

import os
import sys

# Set environment variables BEFORE importing TensorFlow
os.environ['TF_FORCE_GPU_ALLOW_GROWTH'] = 'true'
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2'  # Reduce TF logging
os.environ['CUDA_VISIBLE_DEVICES'] = '0'

import cv2
import numpy as np
from flask import Flask, request, jsonify, Response
from flask_cors import CORS
import threading
import time
import base64
from io import BytesIO
from PIL import Image
import json
import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime
import gc

# Now import TensorFlow
import tensorflow as tf

# Configure GPU memory growth
gpus = tf.config.experimental.list_physical_devices('GPU')
if gpus:
    try:
        for gpu in gpus:
            tf.config.experimental.set_memory_growth(gpu, True)
        print(f"✅ GPU Enabled: {len(gpus)} GPU(s) available")
        for gpu in gpus:
            print(f"   - {gpu.name}")
    except RuntimeError as e:
        print(f"⚠️ GPU Config Error: {e}")
else:
    print("⚠️ No GPU found, using CPU")

# Import DeepFace after TF is configured
from deepface import DeepFace

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

# =============================================================================
# CONFIGURATION
# =============================================================================

CONFIG = {
    'detector_backend': 'opencv',      # Fast and stable (opencv, ssd, retinaface, mtcnn)
    'model_name': 'Facenet512',        # Best accuracy for recognition
    'distance_metric': 'cosine',
    'distance_threshold': 0.4,         # Lower = stricter matching
    'min_confidence': 0.5,             # Minimum face detection confidence
    'frame_skip': 2,                   # Process every N frames
    'batch_size': 4,                   # Faces to process in batch
}

# Database configuration
DB_CONFIG = {
    'host': '127.0.0.1',
    'port': 5000,
    'database': 'FYP_Intellisight',
    'user': 'postgres',
    'password': 'ozair'
}

# Global storage
embeddings_data = []
embeddings_lock = threading.Lock()
active_cameras = {}

# =============================================================================
# DATABASE HANDLER
# =============================================================================

class DatabaseHandler:
    def __init__(self):
        self.conn = None
        self.connect()
        
    def connect(self):
        try:
            self.conn = psycopg2.connect(**DB_CONFIG)
            print("✅ Database connected")
        except Exception as e:
            print(f"❌ Database connection failed: {e}")
            self.conn = None
            
    def get_cursor(self):
        if not self.conn or self.conn.closed:
            self.connect()
        return self.conn.cursor(cursor_factory=RealDictCursor)
        
    def mark_entry(self, name, person_type, zone_id, camera_id):
        """Mark person entry"""
        try:
            cursor = self.get_cursor()
            
            # Get person ID
            if person_type.upper() == 'STUDENT':
                cursor.execute('SELECT "Student_ID" FROM "Students" WHERE "Name" = %s', (name,))
                result = cursor.fetchone()
                person_id = result['Student_ID'] if result else None
            else:
                cursor.execute('SELECT "Teacher_ID" FROM "Teacher" WHERE "Name" = %s', (name,))
                result = cursor.fetchone()
                person_id = result['Teacher_ID'] if result else None
                
            if person_id:
                # Insert attendance log
                cursor.execute('''
                    INSERT INTO "AttendanceLog" ("PersonType", "Student_ID", "Teacher_ID", "Zone_id", "EntryTime")
                    VALUES (%s, %s, %s, %s, NOW())
                ''', (
                    person_type.upper(),
                    person_id if person_type.upper() == 'STUDENT' else None,
                    person_id if person_type.upper() == 'TEACHER' else None,
                    zone_id
                ))
                
                # Insert active presence
                cursor.execute('''
                    INSERT INTO "ActivePresence" ("PersonType", "Student_ID", "Teacher_ID", "Zone_id", "EntryTime")
                    VALUES (%s, %s, %s, %s, NOW())
                    ON CONFLICT DO NOTHING
                ''', (
                    person_type.upper(),
                    person_id if person_type.upper() == 'STUDENT' else None,
                    person_id if person_type.upper() == 'TEACHER' else None,
                    zone_id
                ))
                
                self.conn.commit()
                print(f"✅ Entry logged: {name} ({person_type})")
                
        except Exception as e:
            print(f"❌ Database error: {e}")
            if self.conn:
                self.conn.rollback()

# Initialize database handler
db_handler = DatabaseHandler()

# =============================================================================
# FACE RECOGNITION FUNCTIONS
# =============================================================================

def load_embeddings():
    """Load face embeddings from database FaceEmbeddings table"""
    global embeddings_data
    
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # Load embeddings from database
        cursor.execute('''
            SELECT "Embedding_ID", "PersonType", "PersonName", "Student_ID", "Teacher_ID", "EmbeddingJson"
            FROM "FaceEmbeddings"
            WHERE "EmbeddingJson" IS NOT NULL
        ''')
        
        rows = cursor.fetchall()
        embeddings_data = []
        
        for row in rows:
            try:
                embedding = json.loads(row['EmbeddingJson']) if row['EmbeddingJson'] else None
                if embedding:
                    embeddings_data.append({
                        'embedding': embedding,
                        'person': row['PersonName'],
                        'person_type': row['PersonType'],
                        'student_id': row['Student_ID'],
                        'teacher_id': row['Teacher_ID']
                    })
            except Exception as e:
                print(f"⚠️ Error parsing embedding for {row['PersonName']}: {e}")
        
        conn.close()
        
        print(f"✅ Loaded {len(embeddings_data)} face embeddings")
        
        # Print loaded persons
        persons = set([d.get('person', 'Unknown') for d in embeddings_data])
        print(f"   Persons: {', '.join(list(persons)[:10])}...")
        
    except Exception as e:
        print(f"❌ Error loading embeddings from database: {e}")
        # Fallback to JSON file
        embeddings_file = os.path.join(os.path.dirname(__file__), 'embeddings', 'representations_facenet.json')
        if os.path.exists(embeddings_file):
            try:
                with open(embeddings_file, 'r') as f:
                    embeddings_data = json.load(f)
                print(f"✅ Loaded {len(embeddings_data)} embeddings from JSON fallback")
            except:
                embeddings_data = []
        else:
            embeddings_data = []


def cosine_distance(a, b):
    """Calculate cosine distance between two vectors"""
    a = np.array(a)
    b = np.array(b)
    return 1 - np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))


def find_best_match(embedding, threshold=None):
    """Find the best matching person for an embedding"""
    if threshold is None:
        threshold = CONFIG['distance_threshold']
        
    best_match = None
    best_distance = float('inf')
    
    for data in embeddings_data:
        stored_embedding = data.get('embedding', [])
        if len(stored_embedding) == 0:
            continue
            
        distance = cosine_distance(embedding, stored_embedding)
        
        if distance < best_distance:
            best_distance = distance
            if distance < threshold:
                best_match = data.get('person', 'Unknown')
                
    return best_match, best_distance


def detect_faces_gpu(frame):
    """Detect faces using GPU-accelerated DeepFace"""
    try:
        faces = DeepFace.extract_faces(
            frame,
            detector_backend=CONFIG['detector_backend'],
            enforce_detection=False,
            align=True
        )
        
        results = []
        for face in faces:
            confidence = face.get('confidence', 0)
            if confidence >= CONFIG['min_confidence']:
                facial_area = face.get('facial_area', {})
                results.append({
                    'x': facial_area.get('x', 0),
                    'y': facial_area.get('y', 0),
                    'w': facial_area.get('w', 0),
                    'h': facial_area.get('h', 0),
                    'confidence': confidence,
                    'face': face.get('face', None)
                })
                
        return results
        
    except Exception as e:
        if 'face' not in str(e).lower():
            print(f"⚠️ Detection error: {e}")
        return []


def get_face_embedding(face_img):
    """Get face embedding using GPU"""
    try:
        # Ensure face image is valid
        if face_img is None or face_img.size == 0:
            return None
            
        # Resize to expected input size
        face_resized = cv2.resize(face_img, (160, 160))
        
        embedding = DeepFace.represent(
            face_resized,
            model_name=CONFIG['model_name'],
            detector_backend='skip',  # Skip detection, face already extracted
            enforce_detection=False
        )
        
        if embedding and len(embedding) > 0:
            return embedding[0].get('embedding', None)
            
    except Exception as e:
        if 'face' not in str(e).lower():
            print(f"⚠️ Embedding error: {e}")
            
    return None


# =============================================================================
# CAMERA STREAM CLASS
# =============================================================================

class CameraStream:
    """GPU-accelerated camera stream processor"""
    
    def __init__(self, camera_id, source, camera_type='Entry', zone_id=1):
        self.camera_id = camera_id
        self.source = source
        self.camera_type = camera_type
        self.zone_id = zone_id
        self.cap = None
        self.frame = None
        self.processed_frame = None
        self.faces = []
        self.recognized_persons = []
        self.running = False
        self.frame_count = 0
        self.fps = 0
        self.last_fps_time = time.time()
        self.fps_frames = 0
        self.lock = threading.Lock()
        self.recognition_cooldown = {}
        self.cooldown_seconds = 60  # Don't re-log same person for 60 seconds
        
    def start(self):
        """Start the camera stream"""
        print(f"[Camera {self.camera_id}] Connecting to: {self.source}")
        
        # Try to open camera
        if str(self.source).isdigit() or self.source == '0':
            self.cap = cv2.VideoCapture(int(self.source))
        else:
            self.cap = cv2.VideoCapture(self.source)
            
        if not self.cap.isOpened():
            print(f"[Camera {self.camera_id}] ❌ Failed to open")
            return False
            
        # Set camera properties
        self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
        self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
        self.cap.set(cv2.CAP_PROP_FPS, 30)
        self.cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
        
        self.running = True
        
        # Start processing thread
        thread = threading.Thread(target=self._process_loop, daemon=True)
        thread.start()
        
        print(f"[Camera {self.camera_id}] ✅ Started ({self.camera_type})")
        return True
        
    def stop(self):
        """Stop the camera stream"""
        self.running = False
        if self.cap:
            self.cap.release()
        print(f"[Camera {self.camera_id}] Stopped")
        
    def _process_loop(self):
        """Main processing loop"""
        while self.running:
            try:
                ret, frame = self.cap.read()
                
                if not ret:
                    print(f"[Camera {self.camera_id}] Frame read failed, reconnecting...")
                    time.sleep(1)
                    continue
                    
                self.frame_count += 1
                
                # Update FPS
                self.fps_frames += 1
                if time.time() - self.last_fps_time >= 1.0:
                    self.fps = self.fps_frames
                    self.fps_frames = 0
                    self.last_fps_time = time.time()
                
                # Process every N frames for detection
                if self.frame_count % CONFIG['frame_skip'] == 0:
                    self._detect_and_recognize(frame)
                    
                # Draw on frame
                display_frame = self._draw_overlay(frame)
                
                with self.lock:
                    self.frame = frame
                    self.processed_frame = display_frame
                    
                # Small delay to prevent CPU overload
                time.sleep(0.01)
                
            except Exception as e:
                print(f"[Camera {self.camera_id}] Error: {e}")
                time.sleep(0.5)
                
    def _detect_and_recognize(self, frame):
        """Detect and recognize faces"""
        # Resize for faster detection
        scale = 0.5
        small_frame = cv2.resize(frame, None, fx=scale, fy=scale)
        
        # Detect faces
        faces = detect_faces_gpu(small_frame)
        
        # Scale coordinates back
        self.faces = []
        self.recognized_persons = []
        
        h, w = frame.shape[:2]
        
        for face in faces:
            # Scale coordinates
            x = int(face['x'] / scale)
            y = int(face['y'] / scale)
            fw = int(face['w'] / scale)
            fh = int(face['h'] / scale)
            
            # Extract face region with margin
            margin = int(fw * 0.2)
            y1 = max(0, y - margin)
            y2 = min(h, y + fh + margin)
            x1 = max(0, x - margin)
            x2 = min(w, x + fw + margin)
            
            face_crop = frame[y1:y2, x1:x2]
            
            if face_crop.size == 0 or face_crop.shape[0] < 50 or face_crop.shape[1] < 50:
                continue
                
            # Get embedding and match
            embedding = get_face_embedding(face_crop)
            
            person = None
            distance = float('inf')
            
            if embedding:
                person, distance = find_best_match(embedding)
                
            face_data = {
                'x': x, 'y': y, 'w': fw, 'h': fh,
                'confidence': face['confidence'],
                'person': person,
                'distance': distance
            }
            
            self.faces.append(face_data)
            
            if person and person != 'Unknown':
                self.recognized_persons.append({
                    'name': person,
                    'confidence': max(0, 100 - distance * 100),
                    'timestamp': datetime.now().isoformat()
                })
                
                # Log to database with cooldown
                self._log_recognition(person)
                
    def _log_recognition(self, person):
        """Log recognition to database with cooldown"""
        current_time = time.time()
        last_time = self.recognition_cooldown.get(person, 0)
        
        if current_time - last_time >= self.cooldown_seconds:
            self.recognition_cooldown[person] = current_time
            
            # Parse person name (format: "Name-ROLE")
            parts = person.rsplit('-', 1)
            name = parts[0]
            role = parts[1].upper() if len(parts) > 1 else 'STUDENT'
            
            db_handler.mark_entry(name, role, self.zone_id, self.camera_id)
            
    def _draw_overlay(self, frame):
        """Draw detection overlay on frame"""
        display = frame.copy()
        
        for face in self.faces:
            x, y, w, h = face['x'], face['y'], face['w'], face['h']
            person = face.get('person')
            distance = face.get('distance', float('inf'))
            
            if person and person != 'Unknown':
                color = (0, 255, 0)  # Green for recognized
                confidence = max(0, 100 - distance * 100)
                label = f"{person} ({confidence:.0f}%)"
            else:
                color = (0, 0, 255)  # Red for unknown
                label = "Unknown"
                
            # Draw bounding box
            cv2.rectangle(display, (x, y), (x + w, y + h), color, 2)
            
            # Draw label background
            label_size = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 2)[0]
            cv2.rectangle(display, (x, y - 25), (x + label_size[0] + 10, y), color, -1)
            cv2.putText(display, label, (x + 5, y - 7),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
                       
        # Draw info panel
        cv2.putText(display, f"FPS: {self.fps}", (10, 30),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
        cv2.putText(display, f"Faces: {len(self.faces)}", (10, 60),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
        cv2.putText(display, f"GPU: {'Yes' if gpus else 'No'}", (10, 90),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 255), 2)
                   
        return display
        
    def get_frame_jpeg(self):
        """Get current frame as JPEG"""
        with self.lock:
            if self.processed_frame is not None:
                ret, jpeg = cv2.imencode('.jpg', self.processed_frame, 
                                         [cv2.IMWRITE_JPEG_QUALITY, 85])
                if ret:
                    return jpeg.tobytes()
        return None


# =============================================================================
# FLASK ROUTES
# =============================================================================

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint - returns 'ok' for frontend compatibility"""
    return jsonify({
        'status': 'ok',  # Frontend expects 'ok' not 'healthy'
        'gpu': len(gpus) > 0,
        'gpu_count': len(gpus),
        'gpu_name': gpus[0].name if gpus else 'None',
        'active_cameras': len(active_cameras),
        'known_persons': len(embeddings_data),
        'detector': CONFIG['detector_backend'],
        'model': CONFIG['model_name'],
        'timestamp': datetime.now().isoformat()
    })


@app.route('/detect', methods=['POST'])
def detect():
    """Detect faces in uploaded image"""
    try:
        start_time = time.time()
        
        # Get image from request
        if 'image' in request.files:
            file = request.files['image']
            img = Image.open(file.stream)
            frame = cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)
        elif request.json and 'image' in request.json:
            img_data = base64.b64decode(request.json['image'])
            img = Image.open(BytesIO(img_data))
            frame = cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)
        else:
            return jsonify({'error': 'No image provided'}), 400
            
        # Detect faces
        faces = detect_faces_gpu(frame)
        
        detection_time = (time.time() - start_time) * 1000
        
        return jsonify({
            'success': True,
            'faces': [{'x': f['x'], 'y': f['y'], 'w': f['w'], 'h': f['h'], 
                      'confidence': f['confidence']} for f in faces],
            'count': len(faces),
            'detection_time_ms': round(detection_time, 2),
            'gpu': len(gpus) > 0
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/recognize', methods=['POST'])
def recognize():
    """Recognize face in uploaded image"""
    try:
        start_time = time.time()
        
        # Get image
        if 'image' in request.files:
            file = request.files['image']
            img = Image.open(file.stream)
            frame = cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)
        elif request.json and 'image' in request.json:
            img_data = base64.b64decode(request.json['image'])
            img = Image.open(BytesIO(img_data))
            frame = cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)
        else:
            return jsonify({'error': 'No image provided'}), 400
            
        # Detect faces
        faces = detect_faces_gpu(frame)
        
        if not faces:
            return jsonify({'success': False, 'error': 'No face detected'}), 400
            
        results = []
        h, w = frame.shape[:2]
        
        for face in faces:
            x, y, fw, fh = face['x'], face['y'], face['w'], face['h']
            
            # Extract face with margin
            margin = int(fw * 0.2)
            y1 = max(0, y - margin)
            y2 = min(h, y + fh + margin)
            x1 = max(0, x - margin)
            x2 = min(w, x + fw + margin)
            
            face_crop = frame[y1:y2, x1:x2]
            
            # Get embedding
            embedding = get_face_embedding(face_crop)
            
            if embedding:
                person, distance = find_best_match(embedding)
                results.append({
                    'person': person or 'Unknown',
                    'confidence': max(0, 100 - distance * 100) if distance < float('inf') else 0,
                    'distance': distance if distance < float('inf') else None,
                    'face_region': {'x': x, 'y': y, 'w': fw, 'h': fh}
                })
                
        processing_time = (time.time() - start_time) * 1000
        
        return jsonify({
            'success': True,
            'results': results,
            'processing_time_ms': round(processing_time, 2),
            'gpu': len(gpus) > 0
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/cameras/start', methods=['POST'])
def start_camera():
    """Start a camera stream"""
    data = request.json
    camera_id = data.get('camera_id', 1)
    source = data.get('camera_url', '0')
    camera_type = data.get('camera_type', 'Entry')
    zone_id = data.get('zone_id', 1)
    
    if camera_id in active_cameras:
        return jsonify({'error': 'Camera already running'}), 400
        
    camera = CameraStream(camera_id, source, camera_type, zone_id)
    
    if camera.start():
        active_cameras[camera_id] = camera
        return jsonify({'success': True, 'message': f'Camera {camera_id} started'})
    else:
        return jsonify({'error': 'Failed to start camera'}), 500


@app.route('/cameras/stop/<int:camera_id>', methods=['POST'])
def stop_camera(camera_id):
    """Stop a camera stream"""
    if camera_id in active_cameras:
        active_cameras[camera_id].stop()
        del active_cameras[camera_id]
        gc.collect()
        return jsonify({'success': True})
    return jsonify({'error': 'Camera not found'}), 404


@app.route('/cameras/status', methods=['GET'])
def cameras_status():
    """Get status of all cameras"""
    status = {}
    for cam_id, cam in active_cameras.items():
        status[str(cam_id)] = {
            'camera_id': cam_id,
            'zone_id': cam.zone_id,
            'camera_type': cam.camera_type,
            'is_running': cam.running,
            'fps': cam.fps,
            'faces_detected': len(cam.faces),
            'recognized_persons': cam.recognized_persons[-10:]
        }
        
    return jsonify({
        'success': True,
        'cameras': status,
        'total_active': len(active_cameras),
        'gpu': len(gpus) > 0
    })


@app.route('/stream/<int:camera_id>')
def stream(camera_id):
    """Stream camera feed as MJPEG"""
    def generate():
        while camera_id in active_cameras:
            frame = active_cameras[camera_id].get_frame_jpeg()
            if frame:
                yield (b'--frame\r\n'
                       b'Content-Type: image/jpeg\r\n\r\n' + frame + b'\r\n')
            time.sleep(0.033)  # ~30 FPS
            
    if camera_id not in active_cameras:
        return jsonify({'error': 'Camera not found'}), 404
        
    return Response(generate(),
                   mimetype='multipart/x-mixed-replace; boundary=frame')


@app.route('/embeddings/reload', methods=['POST'])
def reload_embeddings():
    """Reload embeddings from file"""
    with embeddings_lock:
        load_embeddings()
        
    return jsonify({
        'success': True,
        'loaded': len(embeddings_data)
    })


@app.route('/embeddings/count', methods=['GET'])
def embeddings_count():
    """Get count of loaded embeddings"""
    persons = set([d.get('person', 'Unknown') for d in embeddings_data])
    return jsonify({
        'total_embeddings': len(embeddings_data),
        'unique_persons': len(persons),
        'persons': list(persons)
    })


# =============================================================================
# CAMERA CONNECTION CHECKING
# =============================================================================

def test_camera_connection(camera_url, timeout=10):
    """Test if a camera is accessible"""
    try:
        print(f"   Testing: {camera_url}...", end=" ", flush=True)
        
        # For RTSP URLs, add options for better compatibility
        if 'rtsp://' in str(camera_url).lower():
            # Set OpenCV to use TCP for RTSP (more reliable than UDP)
            os.environ['OPENCV_FFMPEG_CAPTURE_OPTIONS'] = 'rtsp_transport;tcp'
        
        if str(camera_url).isdigit() or camera_url == '0':
            cap = cv2.VideoCapture(int(camera_url))
        else:
            cap = cv2.VideoCapture(camera_url, cv2.CAP_FFMPEG)
            
        # Set properties for RTSP
        cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
        cap.set(cv2.CAP_PROP_OPEN_TIMEOUT_MSEC, timeout * 1000)
        cap.set(cv2.CAP_PROP_READ_TIMEOUT_MSEC, timeout * 1000)
        
        if not cap.isOpened():
            print("❌ Failed to open")
            cap.release()
            return False, "Failed to open camera"
        
        # Try to read a frame with timeout
        start_time = time.time()
        ret = False
        frame = None
        
        while time.time() - start_time < timeout:
            ret, frame = cap.read()
            if ret and frame is not None:
                break
            time.sleep(0.2)  # Longer sleep for RTSP
        
        cap.release()
        
        if ret and frame is not None:
            print(f"✅ Connected ({frame.shape[1]}x{frame.shape[0]})")
            return True, f"Connected: {frame.shape[1]}x{frame.shape[0]}"
        else:
            print("❌ No frame received")
            return False, "Camera opened but no frame received"
            
    except Exception as e:
        print(f"❌ Error: {str(e)[:50]}")
        return False, str(e)


def get_cameras_from_database():
    """Fetch all cameras from database"""
    cameras = []
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute('''
            SELECT c."Camara_Id", c."Camera_URL", c."Camera_Type", c."Zone_id", z."Zone_Name"
            FROM "Camara" c
            LEFT JOIN "Zone" z ON c."Zone_id" = z."Zone_id"
            ORDER BY c."Camara_Id"
        ''')
        cameras = cursor.fetchall()
        cursor.close()
        conn.close()
    except Exception as e:
        print(f"❌ Error fetching cameras: {e}")
    return cameras


def check_all_cameras():
    """Check all cameras from database and report status"""
    print("\n" + "=" * 60)
    print("CAMERA CONNECTION CHECK")
    print("=" * 60)
    
    cameras = get_cameras_from_database()
    
    if not cameras:
        print("⚠️  No cameras found in database")
        print("   Add cameras via the admin dashboard")
        print("=" * 60)
        return []
    
    print(f"📷 Found {len(cameras)} camera(s) in database\n")
    
    results = []
    connected_count = 0
    
    for cam in cameras:
        cam_id = cam.get('Camara_Id')
        cam_url = cam.get('Camera_URL')
        cam_type = cam.get('Camera_Type', 'Entry')
        zone_id = cam.get('Zone_id')
        zone_name = cam.get('Zone_Name', f'Zone {zone_id}')
        
        print(f"[Camera {cam_id}] {zone_name} ({cam_type})")
        
        if not cam_url:
            print("   ⚠️  No URL configured")
            results.append({
                'camera_id': cam_id,
                'connected': False,
                'error': 'No URL configured',
                'zone_id': zone_id,
                'camera_type': cam_type
            })
            continue
        
        connected, message = test_camera_connection(cam_url)
        
        results.append({
            'camera_id': cam_id,
            'camera_url': cam_url,
            'connected': connected,
            'message': message,
            'zone_id': zone_id,
            'camera_type': cam_type,
            'zone_name': zone_name
        })
        
        if connected:
            connected_count += 1
    
    print("\n" + "-" * 60)
    print(f"📊 Results: {connected_count}/{len(cameras)} cameras connected")
    
    if connected_count == 0:
        print("\n⚠️  No cameras available for face recognition")
        print("   Please check:")
        print("   - Camera URLs are correct")
        print("   - Cameras are powered on and accessible")
        print("   - Network connectivity for IP cameras")
        print("   - USB cameras are properly connected")
    elif connected_count < len(cameras):
        print("\n⚠️  Some cameras are offline")
        for r in results:
            if not r['connected']:
                print(f"   - Camera {r['camera_id']}: {r.get('error', r.get('message', 'Unknown error'))}")
    
    print("=" * 60 + "\n")
    
    return results


def auto_start_cameras():
    """Automatically start all connected cameras"""
    print("\n" + "=" * 60)
    print("AUTO-STARTING CAMERAS")
    print("=" * 60)
    
    cameras = get_cameras_from_database()
    started = 0
    
    for cam in cameras:
        cam_id = cam.get('Camara_Id')
        cam_url = cam.get('Camera_URL')
        cam_type = cam.get('Camera_Type', 'Entry')
        zone_id = cam.get('Zone_id', 1)
        
        if not cam_url:
            continue
            
        if cam_id in active_cameras:
            print(f"[Camera {cam_id}] Already running")
            started += 1
            continue
        
        print(f"[Camera {cam_id}] Starting...", end=" ")
        
        camera = CameraStream(cam_id, cam_url, cam_type, zone_id)
        
        if camera.start():
            active_cameras[cam_id] = camera
            started += 1
            print("✅")
        else:
            print("❌")
    
    print("-" * 60)
    print(f"📊 Started {started}/{len(cameras)} cameras")
    print("=" * 60 + "\n")
    
    return started


# =============================================================================
# FLASK ROUTE - CAMERA CHECK
# =============================================================================

@app.route('/cameras/check', methods=['GET'])
def check_cameras():
    """API endpoint to check all camera connections"""
    results = check_all_cameras()
    connected = sum(1 for r in results if r['connected'])
    return jsonify({
        'success': True,
        'cameras': results,
        'total': len(results),
        'connected': connected,
        'disconnected': len(results) - connected
    })


@app.route('/cameras/auto-start', methods=['POST'])
def api_auto_start_cameras():
    """API endpoint to auto-start all cameras"""
    started = auto_start_cameras()
    return jsonify({
        'success': True,
        'started': started,
        'total_active': len(active_cameras)
    })


# =============================================================================
# MAIN
# =============================================================================

def initialize():
    """Initialize the service"""
    print("=" * 60)
    print("IntelliSight - GPU Face Recognition Service")
    print("=" * 60)
    print(f"GPU Available: {len(gpus) > 0}")
    if gpus:
        print(f"GPU Device: {gpus[0].name}")
    else:
        print("Running on CPU mode")
    print(f"Detector: {CONFIG['detector_backend']}")
    print(f"Model: {CONFIG['model_name']}")
    print("=" * 60)
    
    # Load embeddings
    load_embeddings()
    
    # Check camera connections
    camera_results = check_all_cameras()
    
    # Auto-start connected cameras (optional - uncomment to enable)
    # auto_start_cameras()
    
    print("=" * 60)
    print("Service ready! API: http://0.0.0.0:3002")
    print("")
    print("Endpoints:")
    print("  GET  /health           - Service health check")
    print("  GET  /cameras/check    - Check all camera connections")
    print("  POST /cameras/auto-start - Auto-start all cameras")
    print("  POST /cameras/start    - Start a specific camera")
    print("  POST /cameras/stop/<id> - Stop a camera")
    print("  GET  /cameras/status   - Get all camera statuses")
    print("  GET  /stream/<id>      - Get camera MJPEG stream")
    print("  POST /detect           - Detect faces in image")
    print("  POST /recognize        - Recognize faces in image")
    print("=" * 60)


if __name__ == '__main__':
    initialize()
    app.run(host='0.0.0.0', port=3002, threaded=True, debug=False)
