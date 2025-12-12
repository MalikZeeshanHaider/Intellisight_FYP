"""
IntelliSight - Live Camera Stream with Face Recognition
Backend service that processes RTSP camera feeds and streams results to frontend
Supports multiple cameras with face detection and recognition
"""

import cv2
import numpy as np
import json
import time
import threading
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


class CameraStream:
    """Handles individual camera RTSP stream with face recognition"""
    
    def __init__(self, camera_id, camera_url, camera_type, zone_id):
        self.camera_id = camera_id
        self.camera_url = camera_url
        self.camera_type = camera_type
        self.zone_id = zone_id
        self.cap = None
        self.frame = None
        self.is_running = False
        self.fps_counter = FPSCounter()
        self.last_recognition_time = time.time()
        self.recognized_persons = []
        
        # Face detection
        self.face_cascade = cv2.CascadeClassifier(
            cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
        )
        
        # Connect to camera
        self.connect()
    
    def connect(self):
        """Connect to RTSP camera"""
        try:
            self.cap = cv2.VideoCapture(self.camera_url)
            
            if self.cap.isOpened():
                self.is_running = True
                print(f"[Camera {self.camera_id}] Connected: {self.camera_url}")
                
                # Start capture thread
                thread = threading.Thread(target=self._capture_loop, daemon=True)
                thread.start()
                return True
            else:
                print(f"[Camera {self.camera_id}] Failed to connect: {self.camera_url}")
                return False
                
        except Exception as e:
            print(f"[Camera {self.camera_id}] Connection error: {e}")
            return False
    
    def _capture_loop(self):
        """Background thread to continuously capture frames"""
        frame_count = 0
        process_every = 2  # Process recognition every 2 frames for faster detection
        
        while self.is_running:
            try:
                ret, frame = self.cap.read()
                
                if ret:
                    frame_count += 1
                    
                    # Process face recognition more frequently
                    if frame_count % process_every == 0:
                        self.frame = self._process_frame(frame)
                    else:
                        # Still show the frame but reuse previous detection
                        if self.frame is not None:
                            self.frame = frame
                        else:
                            self.frame = frame
                    
                    self.fps_counter.update()
                    
                    # Small delay to prevent overwhelming the system
                    time.sleep(0.01)  # 10ms delay = up to 100 FPS
                else:
                    print(f"[Camera {self.camera_id}] Failed to read frame, reconnecting...")
                    time.sleep(1)
                    self.cap.release()
                    self.cap = cv2.VideoCapture(self.camera_url)
                    
            except Exception as e:
                print(f"[Camera {self.camera_id}] Capture error: {e}")
                time.sleep(0.5)
    
    def _process_frame(self, frame):
        """Process frame with face detection and recognition - OPTIMIZED"""
        display = frame.copy()
        h, w = frame.shape[:2]
        
        # Resize frame for faster detection (process smaller image)
        scale = 0.5
        small_frame = cv2.resize(frame, (int(w * scale), int(h * scale)))
        gray = cv2.cvtColor(small_frame, cv2.COLOR_BGR2GRAY)
        
        # Detect faces - OPTIMIZED PARAMETERS
        faces = self.face_cascade.detectMultiScale(
            gray,
            scaleFactor=1.2,  # Faster detection
            minNeighbors=3,   # Lower = more detections, faster
            minSize=(20, 20)   # Smaller minimum for distant faces
        )
        
        self.recognized_persons = []
        
        # Process each detected face
        for (x, y, w, h) in faces:
            # Scale coordinates back to original size
            x = int(x / scale)
            y = int(y / scale)
            w = int(w / scale)
            h = int(h / scale)
            
            # Extract face crop with margin
            margin = 15
            y1 = max(0, y - margin)
            y2 = min(frame.shape[0], y + h + margin)
            x1 = max(0, x - margin)
            x2 = min(frame.shape[1], x + w + margin)
            
            face_crop = frame[y1:y2, x1:x2]
            
            # Recognize face (run in separate thread to avoid blocking)
            person, distance = self._recognize_face(face_crop)
            
            if person and person != "Unknown":
                # Known person
                color = (0, 255, 0)  # Green
                label = f"{person} ({distance:.1f})"
                
                self.recognized_persons.append({
                    'name': person,
                    'distance': distance,
                    'timestamp': datetime.now().isoformat(),
                    'camera_id': self.camera_id,
                    'camera_type': self.camera_type
                })
                
                # Log to database
                self._handle_recognition(person, distance)
                
            elif person == "Unknown":
                color = (0, 0, 255)  # Red
                label = f"Unknown ({distance:.1f})"
            else:
                color = (255, 255, 0)  # Yellow
                label = "Detecting..."
            
            # Draw bounding box
            cv2.rectangle(display, (x, y), (x + w, y + h), color, 2)
            cv2.putText(display, label, (x, y - 10),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2)
        
        # Draw info panel
        fps = self.fps_counter.get_fps()
        cv2.putText(display, f"FPS: {fps:.1f}", (10, 30),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
        cv2.putText(display, f"Faces: {len(faces)}", (10, 60),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
        cv2.putText(display, f"Camera: {self.camera_type}", (10, 90),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
        
        return display
    
    def _recognize_face(self, face_crop):
        """Recognize a face using DeepFace - OPTIMIZED"""
        global embeddings_data
        
        # Check if face crop is valid
        if face_crop.size == 0 or face_crop.shape[0] < 20 or face_crop.shape[1] < 20:
            return None, None
        
        try:
            # Use faster detector backend for speed
            results = DeepFace.represent(
                img_path=face_crop,
                model_name=MODEL_NAME,
                detector_backend="skip",  # Skip detection, we already have face
                enforce_detection=False,
                align=False  # Skip alignment for speed
            )
            
            if results and len(results) > 0:
                embedding = results[0]["embedding"]
                person, distance = find_best_match(embedding, embeddings_data, DISTANCE_THRESHOLD)
                return person, distance
                
        except Exception as e:
            pass
        
        return None, None
    
    def _handle_recognition(self, person, distance):
        """Handle recognized person (update database)"""
        global db_handler
        
        # Throttle database updates (max once per 5 seconds per person)
        current_time = time.time()
        if current_time - self.last_recognition_time < 5:
            return
        
        self.last_recognition_time = current_time
        
        try:
            # Parse person name (format: "Name-ROLE")
            parts = person.split('-')
            name = parts[0]
            role = parts[1] if len(parts) > 1 else "STUDENT"
            
            if self.camera_type == 'Entry':
                # Entry camera: Add to ActivePresence
                db_handler.mark_entry(name, role, self.zone_id, self.camera_id)
                print(f"[Entry] {name} entered Zone {self.zone_id}")
                
            elif self.camera_type == 'Exit':
                # Exit camera: Remove from ActivePresence, log attendance
                db_handler.mark_exit(name, role, self.zone_id, self.camera_id)
                print(f"[Exit] {name} left Zone {self.zone_id}")
                
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
        """Stop camera stream"""
        self.is_running = False
        if self.cap:
            self.cap.release()


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
    """Stop a camera stream"""
    if camera_id in active_cameras:
        active_cameras[camera_id].stop()
        del active_cameras[camera_id]
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
    print("IntelliSight - Live Camera Streaming Service")
    print("="*70)
    
    # Load embeddings
    from config import EMBEDDINGS_FILE
    embeddings_data = load_embeddings_from_json(EMBEDDINGS_FILE)
    print(f"Loaded {len(embeddings_data)} face embeddings")
    
    # Initialize database handler
    db_handler = DatabaseHandler()
    print("Database connected")
    
    print("="*70)
    print("Service ready!")
    print("="*70)


if __name__ == '__main__':
    initialize()
    app.run(host='0.0.0.0', port=5001, threaded=True, debug=False)
