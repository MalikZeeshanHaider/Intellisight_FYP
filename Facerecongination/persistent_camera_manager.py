"""
IntelliSight - Persistent Camera Manager
Continuously runs in the background, manages all cameras independently of frontend
Features:
- Auto-starts cameras on service startup
- Auto-reconnection on camera failure
- Continuous person detection with confidence thresholding
- Deduplication to avoid repeated detections
- Health monitoring and logging
"""

import cv2
import numpy as np
import json
import time
import threading
import logging
from datetime import datetime, timedelta
from collections import defaultdict
from deepface import DeepFace
import psycopg2
from psycopg2.extras import RealDictCursor

from config import DB_CONFIG, MODEL_NAME, DISTANCE_THRESHOLD, MIN_FACE_SIZE
from utils import load_embeddings_from_json, find_best_match, FPSCounter
from database_handler import DatabaseHandler

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('logs/camera_manager.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger('CameraManager')

# Configuration
CONFIDENCE_THRESHOLD = 0.6  # Recognition confidence threshold
DEDUPLICATION_WINDOW = 10  # Seconds to prevent duplicate detections of same person
AUTO_RECONNECT_DELAY = 5  # Seconds to wait before reconnecting
MAX_RECONNECT_ATTEMPTS = 5  # Max attempts before marking camera as failed
FRAME_PROCESS_INTERVAL = 3  # Process every Nth frame for detection
HEALTH_CHECK_INTERVAL = 30  # Seconds between health checks


class PersistentCamera:
    """
    Manages a single camera with persistent connection and auto-recovery
    """
    
    def __init__(self, camera_id, camera_url, camera_type, zone_id, embeddings_data, db_handler):
        self.camera_id = camera_id
        self.camera_url = camera_url
        self.camera_type = camera_type
        self.zone_id = zone_id
        self.embeddings_data = embeddings_data
        self.db_handler = db_handler
        
        # Connection state
        self.cap = None
        self.is_running = False
        self.is_connected = False
        self.reconnect_attempts = 0
        self.last_frame_time = None
        
        # Detection state
        self.fps_counter = FPSCounter()
        self.frame_count = 0
        self.detection_history = defaultdict(lambda: None)  # {person_name: last_detection_time}
        
        # Face detector
        self.face_cascade = cv2.CascadeClassifier(
            cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
        )
        
        # Threading
        self.capture_thread = None
        self.lock = threading.Lock()
        
        logger.info(f"[Camera {camera_id}] Initialized for Zone {zone_id} ({camera_type})")
    
    def start(self):
        """Start camera capture"""
        if self.is_running:
            logger.warning(f"[Camera {self.camera_id}] Already running")
            return False
        
        self.is_running = True
        self.capture_thread = threading.Thread(target=self._run, daemon=True)
        self.capture_thread.start()
        return True
    
    def stop(self):
        """Stop camera capture"""
        logger.info(f"[Camera {self.camera_id}] Stopping...")
        self.is_running = False
        
        if self.capture_thread:
            self.capture_thread.join(timeout=5)
        
        if self.cap:
            self.cap.release()
            self.cap = None
        
        self.is_connected = False
        logger.info(f"[Camera {self.camera_id}] Stopped")
    
    def _connect(self):
        """Connect to camera with retry logic"""
        try:
            logger.info(f"[Camera {self.camera_id}] Connecting to {self.camera_url}...")
            
            self.cap = cv2.VideoCapture(self.camera_url)
            
            # Set buffer size to reduce latency
            self.cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
            
            if self.cap.isOpened():
                # Test read
                ret, frame = self.cap.read()
                if ret and frame is not None:
                    self.is_connected = True
                    self.reconnect_attempts = 0
                    self.last_frame_time = time.time()
                    logger.info(f"[Camera {self.camera_id}] ✓ Connected successfully")
                    return True
            
            logger.error(f"[Camera {self.camera_id}] ✗ Failed to connect")
            return False
            
        except Exception as e:
            logger.error(f"[Camera {self.camera_id}] Connection error: {e}")
            return False
    
    def _run(self):
        """Main camera loop - runs continuously"""
        logger.info(f"[Camera {self.camera_id}] Starting capture loop...")
        
        while self.is_running:
            try:
                # Connect if not connected
                if not self.is_connected:
                    if self.reconnect_attempts >= MAX_RECONNECT_ATTEMPTS:
                        logger.error(f"[Camera {self.camera_id}] Max reconnection attempts reached. Waiting...")
                        time.sleep(60)  # Wait 1 minute before retrying
                        self.reconnect_attempts = 0
                    
                    self.reconnect_attempts += 1
                    if self._connect():
                        continue
                    else:
                        time.sleep(AUTO_RECONNECT_DELAY)
                        continue
                
                # Read frame
                ret, frame = self.cap.read()
                
                if not ret or frame is None:
                    logger.warning(f"[Camera {self.camera_id}] Failed to read frame. Reconnecting...")
                    self.is_connected = False
                    if self.cap:
                        self.cap.release()
                        self.cap = None
                    continue
                
                # Update frame time
                self.last_frame_time = time.time()
                self.frame_count += 1
                self.fps_counter.update()
                
                # Process detection on every Nth frame
                if self.frame_count % FRAME_PROCESS_INTERVAL == 0:
                    self._process_detection(frame)
                
                # Small delay to prevent CPU overload
                time.sleep(0.01)
                
            except Exception as e:
                logger.error(f"[Camera {self.camera_id}] Error in capture loop: {e}")
                self.is_connected = False
                time.sleep(1)
    
    def _process_detection(self, frame):
        """Process frame for person detection"""
        try:
            h, w = frame.shape[:2]
            
            # Resize for faster detection
            scale = 0.5
            small_frame = cv2.resize(frame, (int(w * scale), int(h * scale)))
            gray = cv2.cvtColor(small_frame, cv2.COLOR_BGR2GRAY)
            
            # Detect faces
            faces = self.face_cascade.detectMultiScale(
                gray,
                scaleFactor=1.2,
                minNeighbors=4,  # Balance between speed and accuracy
                minSize=(30, 30)
            )
            
            if len(faces) == 0:
                return
            
            # Process each face
            for (x, y, w_face, h_face) in faces:
                # Scale back to original size
                x = int(x / scale)
                y = int(y / scale)
                w_face = int(w_face / scale)
                h_face = int(h_face / scale)
                
                # Extract face with margin
                margin = 20
                y1 = max(0, y - margin)
                y2 = min(h, y + h_face + margin)
                x1 = max(0, x - margin)
                x2 = min(w, x + w_face + margin)
                
                face_crop = frame[y1:y2, x1:x2]
                
                # Skip if face too small
                if face_crop.shape[0] < 50 or face_crop.shape[1] < 50:
                    continue
                
                # Recognize face
                person, distance = self._recognize_face(face_crop)
                
                if person and distance is not None:
                    # Apply confidence threshold
                    confidence = 1 - (distance / 1.0)  # Convert distance to confidence
                    
                    if confidence >= CONFIDENCE_THRESHOLD:
                        # Check deduplication
                        if self._should_process_detection(person):
                            self._handle_detection(person, distance, confidence)
                    
        except Exception as e:
            logger.error(f"[Camera {self.camera_id}] Detection error: {e}")
    
    def _recognize_face(self, face_crop):
        """Recognize a face using DeepFace"""
        try:
            results = DeepFace.represent(
                img_path=face_crop,
                model_name=MODEL_NAME,
                detector_backend="skip",
                enforce_detection=False,
                align=False
            )
            
            if results and len(results) > 0:
                embedding = results[0]["embedding"]
                person, distance = find_best_match(
                    embedding, 
                    self.embeddings_data, 
                    DISTANCE_THRESHOLD
                )
                return person, distance
        
        except Exception as e:
            # Silent fail - face recognition errors are common
            pass
        
        return None, None
    
    def _should_process_detection(self, person):
        """Check if detection should be processed (deduplication)"""
        last_detection = self.detection_history[person]
        
        if last_detection is None:
            return True
        
        time_since_last = time.time() - last_detection
        return time_since_last >= DEDUPLICATION_WINDOW
    
    def _handle_detection(self, person, distance, confidence):
        """Handle a valid person detection"""
        try:
            # Update detection history
            self.detection_history[person] = time.time()
            
            # Parse person name (format: "Name-ROLE")
            parts = person.split('-')
            name = parts[0]
            role = parts[1] if len(parts) > 1 else "STUDENT"
            
            logger.info(
                f"[Camera {self.camera_id}] Detected: {name} "
                f"(confidence: {confidence:.2%}, distance: {distance:.3f})"
            )
            
            # Update database based on camera type
            if self.camera_type == 'Entry':
                self.db_handler.mark_entry(name, role, self.zone_id, self.camera_id)
                logger.info(f"[Entry] {name} entered Zone {self.zone_id}")
                
            elif self.camera_type == 'Exit':
                self.db_handler.mark_exit(name, role, self.zone_id, self.camera_id)
                logger.info(f"[Exit] {name} left Zone {self.zone_id}")
            
        except Exception as e:
            logger.error(f"[Camera {self.camera_id}] Error handling detection: {e}")
    
    def get_status(self):
        """Get camera status information"""
        return {
            'camera_id': self.camera_id,
            'camera_type': self.camera_type,
            'zone_id': self.zone_id,
            'is_running': self.is_running,
            'is_connected': self.is_connected,
            'reconnect_attempts': self.reconnect_attempts,
            'fps': self.fps_counter.get_fps(),
            'frames_processed': self.frame_count,
            'last_frame_time': self.last_frame_time,
            'detections_count': len(self.detection_history)
        }


class CameraManager:
    """
    Manages all cameras - auto-starts cameras on initialization
    """
    
    def __init__(self):
        self.cameras = {}  # {camera_id: PersistentCamera}
        self.embeddings_data = []
        self.db_handler = None
        self.is_running = False
        
        # Health monitoring thread
        self.health_thread = None
        
        logger.info("="*70)
        logger.info("IntelliSight - Persistent Camera Manager")
        logger.info("="*70)
    
    def initialize(self):
        """Initialize the manager - load embeddings and database"""
        try:
            # Load face embeddings
            from config import EMBEDDINGS_FILE
            self.embeddings_data = load_embeddings_from_json(EMBEDDINGS_FILE)
            logger.info(f"Loaded {len(self.embeddings_data)} face embeddings")
            
            # Initialize database handler
            self.db_handler = DatabaseHandler()
            logger.info("Database connected")
            
            # Auto-start all configured cameras
            self._auto_start_cameras()
            
            # Start health monitoring
            self.is_running = True
            self.health_thread = threading.Thread(target=self._health_monitor, daemon=True)
            self.health_thread.start()
            
            logger.info("="*70)
            logger.info("Camera Manager initialized and running!")
            logger.info("="*70)
            
        except Exception as e:
            logger.error(f"Initialization error: {e}")
            raise
    
    def _auto_start_cameras(self):
        """Auto-start all cameras from database"""
        try:
            # Get all cameras from database
            conn = psycopg2.connect(**DB_CONFIG)
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            
            cursor.execute("""
                SELECT c.*, z.Zone_Name
                FROM "Camara" c
                JOIN "Zone" z ON c."Zone_id" = z."Zone_id"
                WHERE c."Camera_Type" IN ('Entry', 'Exit')
                ORDER BY c."Zone_id", c."Camera_Type"
            """)
            
            cameras = cursor.fetchall()
            cursor.close()
            conn.close()
            
            logger.info(f"Found {len(cameras)} cameras to start")
            
            for camera_data in cameras:
                camera_id = camera_data['Camara_Id']
                camera_url = camera_data['Camera_URL']
                camera_type = camera_data['Camera_Type']
                zone_id = camera_data['Zone_id']
                
                # Skip if already running
                if camera_id in self.cameras:
                    continue
                
                # Create and start camera
                camera = PersistentCamera(
                    camera_id,
                    camera_url,
                    camera_type,
                    zone_id,
                    self.embeddings_data,
                    self.db_handler
                )
                
                if camera.start():
                    self.cameras[camera_id] = camera
                    logger.info(f"Started camera {camera_id} for Zone {zone_id} ({camera_type})")
                else:
                    logger.error(f"Failed to start camera {camera_id}")
            
            logger.info(f"Successfully started {len(self.cameras)} cameras")
            
        except Exception as e:
            logger.error(f"Error auto-starting cameras: {e}")
    
    def _health_monitor(self):
        """Monitor camera health and log status"""
        while self.is_running:
            try:
                time.sleep(HEALTH_CHECK_INTERVAL)
                
                logger.info("="*70)
                logger.info("HEALTH CHECK")
                logger.info("="*70)
                
                for camera_id, camera in self.cameras.items():
                    status = camera.get_status()
                    
                    status_icon = "✓" if status['is_connected'] else "✗"
                    logger.info(
                        f"[{status_icon}] Camera {camera_id} | "
                        f"Zone {status['zone_id']} | "
                        f"{status['camera_type']} | "
                        f"FPS: {status['fps']:.1f} | "
                        f"Frames: {status['frames_processed']} | "
                        f"Detections: {status['detections_count']}"
                    )
                
                logger.info("="*70)
                
            except Exception as e:
                logger.error(f"Health monitor error: {e}")
    
    def get_all_status(self):
        """Get status of all cameras"""
        return {
            camera_id: camera.get_status()
            for camera_id, camera in self.cameras.items()
        }
    
    def stop_all(self):
        """Stop all cameras"""
        logger.info("Stopping all cameras...")
        self.is_running = False
        
        for camera in self.cameras.values():
            camera.stop()
        
        self.cameras.clear()
        logger.info("All cameras stopped")


# Singleton instance
manager = CameraManager()


def main():
    """Main entry point"""
    try:
        manager.initialize()
        
        # Keep running
        while True:
            time.sleep(1)
            
    except KeyboardInterrupt:
        logger.info("\nReceived interrupt signal, shutting down...")
        manager.stop_all()
    except Exception as e:
        logger.error(f"Fatal error: {e}")
        manager.stop_all()


if __name__ == '__main__':
    main()
