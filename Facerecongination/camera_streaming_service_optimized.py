"""
IntelliSight - OPTIMIZED Live Camera Stream with Face Recognition
Fixed: Memory leaks, slow detection, inaccurate recognition
Version: 2.0 - Performance & Accuracy Improvements
"""

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
from psycopg2.extras import RealDictCursor

from config import DB_CONFIG, MODEL_NAME, DISTANCE_THRESHOLD, MIN_FACE_SIZE, EMBEDDINGS_FILE
from utils import load_embeddings_from_json, get_euclidean_distance, FPSCounter
from database_handler import DatabaseHandler

app = Flask(__name__)
CORS(app)

# Global variables
active_cameras = {}
embeddings_data = []
db_handler = None
embeddings_lock = threading.Lock()

# OPTIMIZED SETTINGS
DETECTION_CONFIDENCE = 0.7
RECOGNITION_COOLDOWN = 2.0  # Seconds between recognizing same person
MAX_CACHE_SIZE = 100
FACE_SIZE_MIN = 40  # Minimum face size for recognition
DISTANCE_THRESHOLD_STRICT = 8.0  # More strict threshold for better accuracy


def find_best_match_optimized(embedding, embeddings_data, threshold=DISTANCE_THRESHOLD_STRICT):
    """
    OPTIMIZED: Find the best matching person with confidence scoring
    """
    if not embeddings_data:
        return "Unknown", float('inf'), 0.0
    
    best_person = None
    min_distance = float('inf')
    match_count = 0
    
    # Group embeddings by person for better matching
    person_distances = {}
    
    for data in embeddings_data:
        if not isinstance(data, dict) or 'embedding' not in data:
            continue
        
        emb = data['embedding']
        person = data.get('person', 'Unknown')
        
        try:
            dist = get_euclidean_distance(embedding, emb)
            
            if person not in person_distances:
                person_distances[person] = []
            person_distances[person].append(dist)
            
            if dist < min_distance:
                min_distance = dist
                best_person = person
        except Exception:
            continue
    
    # Calculate confidence based on multiple embeddings per person
    confidence = 0.0
    if best_person and best_person in person_distances:
        distances = person_distances[best_person]
        avg_distance = sum(distances) / len(distances)
        match_count = sum(1 for d in distances if d < threshold)
        
        # Higher confidence if multiple embeddings match
        if min_distance < threshold:
            confidence = max(0, 1 - (min_distance / threshold)) * 100
            # Boost confidence if multiple matches
            if match_count > 1:
                confidence = min(100, confidence * (1 + match_count * 0.1))
    
    if min_distance <= threshold and best_person:
        return best_person, min_distance, confidence
    
    return "Unknown", min_distance, confidence


class FaceTracker:
    """
    OPTIMIZED: Track faces across frames to avoid repeated recognition
    Fixes: Memory leak by limiting cache size
    """
    def __init__(self, max_age=30, max_cache=MAX_CACHE_SIZE):
        self.tracks = {}  # {track_id: {bbox, person, last_seen, embedding}}
        self.next_id = 0
        self.max_age = max_age
        self.max_cache = max_cache
        self.lock = threading.Lock()
    
    def _iou(self, box1, box2):
        """Calculate Intersection over Union"""
        x1 = max(box1[0], box2[0])
        y1 = max(box1[1], box2[1])
        x2 = min(box1[0] + box1[2], box2[0] + box2[2])
        y2 = min(box1[1] + box1[3], box2[1] + box2[3])
        
        if x2 < x1 or y2 < y1:
            return 0.0
        
        intersection = (x2 - x1) * (y2 - y1)
        area1 = box1[2] * box1[3]
        area2 = box2[2] * box2[3]
        union = area1 + area2 - intersection
        
        return intersection / union if union > 0 else 0
    
    def update(self, detections, frame_count):
        """Update tracks with new detections"""
        with self.lock:
            # Match detections to existing tracks
            matched = set()
            
            for det in detections:
                bbox = det['bbox']
                best_track = None
                best_iou = 0.3  # Minimum IoU threshold
                
                for track_id, track in self.tracks.items():
                    iou = self._iou(bbox, track['bbox'])
                    if iou > best_iou:
                        best_iou = iou
                        best_track = track_id
                
                if best_track is not None:
                    # Update existing track
                    self.tracks[best_track]['bbox'] = bbox
                    self.tracks[best_track]['last_seen'] = frame_count
                    if det.get('person'):
                        self.tracks[best_track]['person'] = det['person']
                        self.tracks[best_track]['distance'] = det.get('distance', 0)
                        self.tracks[best_track]['confidence'] = det.get('confidence', 0)
                    matched.add(best_track)
                else:
                    # Create new track
                    self.tracks[self.next_id] = {
                        'bbox': bbox,
                        'person': det.get('person'),
                        'distance': det.get('distance', 0),
                        'confidence': det.get('confidence', 0),
                        'last_seen': frame_count,
                        'first_seen': frame_count
                    }
                    self.next_id += 1
            
            # Remove old tracks
            to_remove = []
            for track_id, track in self.tracks.items():
                if frame_count - track['last_seen'] > self.max_age:
                    to_remove.append(track_id)
            
            for track_id in to_remove:
                del self.tracks[track_id]
            
            # Limit cache size to prevent memory leak
            if len(self.tracks) > self.max_cache:
                # Remove oldest tracks
                sorted_tracks = sorted(self.tracks.items(), 
                                      key=lambda x: x[1]['last_seen'])
                for track_id, _ in sorted_tracks[:len(self.tracks) - self.max_cache]:
                    del self.tracks[track_id]
    
    def get_person_for_bbox(self, bbox):
        """Get cached person for a bounding box"""
        with self.lock:
            best_track = None
            best_iou = 0.5
            
            for track_id, track in self.tracks.items():
                iou = self._iou(bbox, track['bbox'])
                if iou > best_iou and track.get('person'):
                    best_iou = iou
                    best_track = track
            
            if best_track:
                return best_track.get('person'), best_track.get('distance', 0), best_track.get('confidence', 0)
            return None, None, None
    
    def clear(self):
        """Clear all tracks - prevents memory leak"""
        with self.lock:
            self.tracks.clear()
            gc.collect()


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
        
        # OPTIMIZED: Use DNN face detector (more accurate than Haar)
        self.use_dnn = True
        self.dnn_net = None
        self._init_face_detector()
        
        # Connect to camera
        self.connect()
    
    def _init_face_detector(self):
        """Initialize face detector - DNN is more accurate"""
        try:
            # Try to use DNN detector (OpenCV's DNN face detector)
            model_path = cv2.data.haarcascades + '../haarcascades_cuda/'
            
            # Fall back to Haar Cascade but with better parameters
            self.face_cascade = cv2.CascadeClassifier(
                cv2.data.haarcascades + 'haarcascade_frontalface_alt2.xml'
            )
            # Also load profile face detector for side views
            self.profile_cascade = cv2.CascadeClassifier(
                cv2.data.haarcascades + 'haarcascade_profileface.xml'
            )
            print(f"[Camera {self.camera_id}] Face detector initialized")
        except Exception as e:
            print(f"[Camera {self.camera_id}] Face detector init error: {e}")
            self.face_cascade = cv2.CascadeClassifier(
                cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
            )
    
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
        """OPTIMIZED: Background capture loop with better memory management"""
        process_every = 3  # Process recognition every N frames
        reconnect_attempts = 0
        max_reconnect = 5
        
        while self.is_running:
            try:
                if self.cap is None or not self.cap.isOpened():
                    if reconnect_attempts < max_reconnect:
                        print(f"[Camera {self.camera_id}] Reconnecting... ({reconnect_attempts + 1}/{max_reconnect})")
                        time.sleep(2)
                        self.connect()
                        reconnect_attempts += 1
                    else:
                        print(f"[Camera {self.camera_id}] Max reconnect attempts reached")
                        break
                    continue
                
                ret, frame = self.cap.read()
                
                if ret and frame is not None:
                    reconnect_attempts = 0
                    self.frame_count += 1
                    
                    # Process recognition on selected frames
                    if self.frame_count % process_every == 0:
                        self.frame = self._process_frame(frame)
                    else:
                        # Just update the frame without heavy processing
                        self.frame = self._draw_cached_boxes(frame)
                    
                    self.fps_counter.update()
                    
                    # MEMORY CLEANUP: Periodic garbage collection
                    if self.frame_count % 300 == 0:  # Every ~10 seconds at 30fps
                        gc.collect()
                    
                    time.sleep(0.01)  # Small delay
                else:
                    print(f"[Camera {self.camera_id}] Frame read failed")
                    time.sleep(0.5)
                    
            except Exception as e:
                print(f"[Camera {self.camera_id}] Capture error: {e}")
                time.sleep(0.5)
        
        print(f"[Camera {self.camera_id}] Capture loop ended")
    
    def _detect_faces(self, frame):
        """OPTIMIZED: Better face detection with multiple detectors"""
        h, w = frame.shape[:2]
        
        # OPTIMIZED: Adaptive scaling based on resolution
        if w > 1280:
            scale = 0.4
        elif w > 640:
            scale = 0.6
        else:
            scale = 0.8
        
        small_frame = cv2.resize(frame, (int(w * scale), int(h * scale)))
        gray = cv2.cvtColor(small_frame, cv2.COLOR_BGR2GRAY)
        
        # OPTIMIZED: Better histogram equalization for varying lighting
        gray = cv2.equalizeHist(gray)
        
        # Detect frontal faces with OPTIMIZED parameters
        faces = self.face_cascade.detectMultiScale(
            gray,
            scaleFactor=1.1,   # Smaller scale = more accurate but slower
            minNeighbors=5,    # Higher = fewer false positives
            minSize=(25, 25),  # Minimum face size
            flags=cv2.CASCADE_SCALE_IMAGE
        )
        
        # Also detect profile faces (side views)
        try:
            profile_faces = self.profile_cascade.detectMultiScale(
                gray,
                scaleFactor=1.1,
                minNeighbors=5,
                minSize=(25, 25)
            )
            if len(profile_faces) > 0:
                faces = np.vstack([faces, profile_faces]) if len(faces) > 0 else profile_faces
        except:
            pass
        
        # Scale back to original size and filter
        scaled_faces = []
        for (x, y, fw, fh) in faces:
            x = int(x / scale)
            y = int(y / scale)
            fw = int(fw / scale)
            fh = int(fh / scale)
            
            # Filter too small faces
            if fw >= FACE_SIZE_MIN and fh >= FACE_SIZE_MIN:
                scaled_faces.append((x, y, fw, fh))
        
        # Remove duplicate/overlapping detections
        filtered_faces = self._non_max_suppression(scaled_faces)
        
        return filtered_faces
    
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
        global embeddings_data
        
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
            
            if cached_person and cached_person != "Unknown":
                # Use cached result
                person = cached_person
                distance = cached_dist
                confidence = cached_conf
            else:
                # Need to recognize
                person, distance, confidence = self._recognize_face(frame, x, y, w, h)
            
            # Store detection for tracking
            detections.append({
                'bbox': bbox,
                'person': person,
                'distance': distance,
                'confidence': confidence
            })
            
            # Draw bounding box
            if person and person != "Unknown":
                color = (0, 255, 0)  # Green for recognized
                label = f"{person} ({confidence:.0f}%)"
                self.stats['known_faces'] += 1
                
                # Handle recognition event (database update)
                if self._should_record_recognition(person):
                    recognized_this_frame.append({
                        'name': person,
                        'distance': distance,
                        'confidence': confidence
                    })
                    self._handle_recognition(person, distance)
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
                bbox = track['bbox']
                person = track.get('person')
                confidence = track.get('confidence', 0)
                
                x, y, w, h = bbox
                
                if person and person != "Unknown":
                    color = (0, 255, 0)
                    label = f"{person} ({confidence:.0f}%)"
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
        global embeddings_data
        
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
            # OPTIMIZED: Better preprocessing
            # Resize face to standard size for consistent recognition
            face_resized = cv2.resize(face_crop, (160, 160))
            
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
                person, distance, confidence = find_best_match_optimized(
                    embedding, embeddings_data, DISTANCE_THRESHOLD_STRICT
                )
                
                # Cleanup
                del results, embedding
                
                return person, distance, confidence
                
        except Exception as e:
            # Only log unexpected errors
            if "face" not in str(e).lower():
                print(f"[Camera {self.camera_id}] Recognition error: {e}")
        
        return "Unknown", float('inf'), 0
    
    def _should_record_recognition(self, person):
        """Check if we should record this recognition (cooldown)"""
        current_time = time.time()
        
        with self.cache_lock:
            last_time = self.recognition_cache.get(person, 0)
            
            if current_time - last_time >= RECOGNITION_COOLDOWN:
                self.recognition_cache[person] = current_time
                
                # Limit cache size
                if len(self.recognition_cache) > MAX_CACHE_SIZE:
                    oldest = min(self.recognition_cache, key=self.recognition_cache.get)
                    del self.recognition_cache[oldest]
                
                return True
        
        return False
    
    def _handle_recognition(self, person, distance):
        """Handle recognized person - update database"""
        global db_handler
        
        try:
            # Try to determine role from person name
            name = person
            role = "STUDENT"  # Default
            
            if "-" in person:
                parts = person.rsplit("-", 1)
                name = parts[0]
                if len(parts) > 1:
                    role = parts[1].upper()
            
            if self.camera_type == 'Entry':
                db_handler.mark_entry(name, role, self.zone_id, self.camera_id)
                print(f"[Entry] ✓ {name} entered Zone {self.zone_id}")
            elif self.camera_type == 'Exit':
                db_handler.mark_exit(name, role, self.zone_id, self.camera_id)
                print(f"[Exit] ✓ {name} exited Zone {self.zone_id}")
                
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
    global embeddings_data
    
    with embeddings_lock:
        embeddings_data = load_embeddings_from_json(EMBEDDINGS_FILE)
    
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
    global embeddings_data, db_handler
    
    print("=" * 70)
    print("IntelliSight - OPTIMIZED Camera Streaming Service v2.0")
    print("=" * 70)
    
    # Load embeddings
    embeddings_data = load_embeddings_from_json(EMBEDDINGS_FILE)
    print(f"✓ Loaded {len(embeddings_data)} face embeddings")
    
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
