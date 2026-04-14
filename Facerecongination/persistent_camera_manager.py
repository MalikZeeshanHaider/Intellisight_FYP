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

from config import DB_CONFIG, MODEL_NAME, DISTANCE_THRESHOLD, MIN_FACE_SIZE, RECOGNITION_CONFIDENCE_THRESHOLD, DETECTOR_BACKEND, FRAME_SKIP
from utils import load_embeddings_from_json, FPSCounter, preprocess_face_crop, EmbeddingIndex, FaceTracker
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
# CONFIDENCE_THRESHOLD is imported from config as RECOGNITION_CONFIDENCE_THRESHOLD
DEDUPLICATION_WINDOW   = 10   # Seconds to prevent duplicate detections of same person
RECONNECT_BASE_DELAY   = 2    # Starting backoff delay (seconds)
RECONNECT_MAX_DELAY    = 60   # Maximum backoff delay (seconds)
MAX_RECONNECT_ATTEMPTS = 5    # Attempt count at which delay reaches its maximum
FRAME_PROCESS_INTERVAL = FRAME_SKIP  # From config — process every Nth frame
HEALTH_CHECK_INTERVAL  = 30   # Seconds between health checks


class PersistentCamera:
    """
    Manages a single camera with persistent connection and auto-recovery
    """
    
    def __init__(self, camera_id, camera_url, camera_type, zone_id, embedding_index, db_handler):
        self.camera_id      = camera_id
        self.camera_url     = camera_url
        self.camera_type    = camera_type
        self.zone_id        = zone_id
        self.embedding_index = embedding_index  # EmbeddingIndex — pre-built at startup
        self.db_handler     = db_handler
        
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

        # Face tracker — caches identity for 2 s to skip repeated recognition
        self.face_tracker = FaceTracker(max_age_seconds=2.0)

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
        """
        Open (or re-open) the camera stream.

        For RTSP URLs, configures FFMPEG with TCP transport and sensible
        timeouts before calling VideoCapture.  Any stale handle is released
        first to avoid resource leaks.

        Returns:
            True on success, False otherwise.
        """
        import os

        # Release any stale handle before attempting a fresh connection
        if self.cap:
            self.cap.release()
            self.cap = None

        url = self.camera_url
        logger.info(f"[Camera {self.camera_id}] Connecting to {url}...")

        try:
            # RTSP streams need TCP transport and explicit timeouts
            if isinstance(url, str) and url.lower().startswith('rtsp'):
                os.environ['OPENCV_FFMPEG_CAPTURE_OPTIONS'] = (
                    'rtsp_transport;tcp|'
                    'rtsp_flags;prefer_tcp|'
                    'stimeout;5000000|'
                    'max_delay;500000|'
                    'reorder_queue_size;0'
                )
                self.cap = cv2.VideoCapture(url, cv2.CAP_FFMPEG)
                self.cap.set(cv2.CAP_PROP_OPEN_TIMEOUT_MSEC, 10000)
                self.cap.set(cv2.CAP_PROP_READ_TIMEOUT_MSEC,  5000)
            else:
                self.cap = cv2.VideoCapture(url)

            self.cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)

            if self.cap.isOpened():
                ret, frame = self.cap.read()
                if ret and frame is not None:
                    self.is_connected = True
                    self.reconnect_attempts = 0
                    self.last_frame_time = time.time()
                    logger.info(f"[Camera {self.camera_id}] ✓ Connected successfully")
                    return True

            if self.cap:
                self.cap.release()
                self.cap = None
            logger.warning(f"[Camera {self.camera_id}] ✗ Failed to connect")
            return False

        except Exception as e:
            logger.error(f"[Camera {self.camera_id}] Connection error: {e}")
            if self.cap:
                self.cap.release()
                self.cap = None
            return False
    
    def _run(self):
        """Main camera loop - runs continuously"""
        logger.info(f"[Camera {self.camera_id}] Starting capture loop...")
        
        while self.is_running:
            try:
                # Connect if not connected — exponential backoff, never permanent stop
                if not self.is_connected:
                    delay = min(
                        RECONNECT_BASE_DELAY * (2 ** min(self.reconnect_attempts, MAX_RECONNECT_ATTEMPTS)),
                        RECONNECT_MAX_DELAY
                    )
                    logger.info(
                        f"[Camera {self.camera_id}] Reconnect attempt {self.reconnect_attempts + 1} "
                        f"— waiting {delay:.0f}s before retry..."
                    )
                    time.sleep(delay)
                    self.reconnect_attempts += 1
                    self._connect()
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
        """
        Detect and identify faces in a frame using a two-phase pipeline.

        Phase 1 — Detection (always runs):
            DeepFace.extract_faces() locates all faces and returns aligned crops.

        Phase 2 — Recognition (tracker-gated):
            The FaceTracker is checked first.  If a cached identity exists (IoU
            ≥ 0.5, age < 2 s) it is reused without embedding extraction.  Only
            new or tracking-lost faces run DeepFace.represent() + index search.
        """
        fh, fw = frame.shape[:2]
        detections = []   # fed into face_tracker.update() at end

        # ── Phase 1: detect faces ─────────────────────────────────────────────
        try:
            face_list = DeepFace.extract_faces(
                img_path=preprocess_face_crop(frame),
                detector_backend=DETECTOR_BACKEND,
                enforce_detection=False,
                align=True
            )
        except Exception as e:
            logger.debug(f"[Camera {self.camera_id}] Detection error: {e}")
            return

        # ── Phase 2: identify each face ───────────────────────────────────────
        for face_obj in face_list:
            fa = face_obj.get('facial_area', {})
            x, y, w, h = fa.get('x', 0), fa.get('y', 0), fa.get('w', 0), fa.get('h', 0)

            if w < MIN_FACE_SIZE or h < MIN_FACE_SIZE:
                continue

            bbox = (x, y, w, h)

            # Check tracker cache — skip embedding if identity is still fresh
            cached_person, cached_dist, cached_conf = self.face_tracker.get_person_for_bbox(bbox)

            if cached_person is not None:
                person_dict = cached_person
                distance    = cached_dist
                confidence  = cached_conf
            else:
                # Full recognition: embed aligned crop, search index
                face_crop = face_obj.get('face')
                if face_crop is None or (hasattr(face_crop, 'size') and face_crop.size == 0):
                    m = 20
                    face_crop = frame[max(0, y - m):min(fh, y + h + m),
                                      max(0, x - m):min(fw, x + w + m)]

                face_crop    = preprocess_face_crop(face_crop)
                face_resized = cv2.resize(face_crop, (160, 160))

                person_dict = distance = None
                try:
                    results = DeepFace.represent(
                        img_path=face_resized,
                        model_name=MODEL_NAME,
                        detector_backend="skip",   # already cropped + aligned
                        enforce_detection=False,
                        align=True
                    )
                    if results:
                        person_dict, distance = self.embedding_index.search(
                            results[0]["embedding"], DISTANCE_THRESHOLD
                        )
                except Exception as e:
                    logger.debug(f"[Camera {self.camera_id}] Recognition error: {e}")

                confidence = (max(0.0, 1.0 - (distance / DISTANCE_THRESHOLD))
                              if distance is not None else 0.0)

            detections.append({
                'bbox':       bbox,
                'person':     person_dict,
                'distance':   distance or 0,
                'confidence': confidence,
            })

            # Fire database event only when confidence is high enough
            if person_dict is not None and distance is not None:
                if confidence >= RECOGNITION_CONFIDENCE_THRESHOLD:
                    if self._should_process_detection(person_dict):
                        self._handle_detection(person_dict, distance, confidence)

        # ── Update tracker ────────────────────────────────────────────────────
        self.face_tracker.update(detections, self.frame_count)

    def _should_process_detection(self, person_dict):
        """Check if detection should be processed (deduplication)"""
        dedup_key = f"{person_dict.get('person_id')}|{person_dict.get('role', '')}"
        last_detection = self.detection_history[dedup_key]

        if last_detection is None:
            return True

        return time.time() - last_detection >= DEDUPLICATION_WINDOW

    def _handle_detection(self, person_dict, distance, confidence):
        """
        Handle a confirmed person detection.

        Args:
            person_dict : dict with person_id, role, name, person_key — as returned
                          by EmbeddingIndex.search(); no string parsing needed.
            distance    : euclidean distance from the matched embedding
            confidence  : 0-1 confidence score
        """
        try:
            person_id   = person_dict['person_id']
            role        = person_dict['role']
            name        = person_dict['name']

            if person_id is None or role not in ('STUDENT', 'TEACHER'):
                logger.warning(
                    f"[Camera {self.camera_id}] Invalid identity in person dict: {person_dict!r}"
                )
                return

            # Update deduplication timestamp
            dedup_key = f"{person_id}|{role}"
            self.detection_history[dedup_key] = time.time()

            person_type = 'Student' if role == 'STUDENT' else 'Teacher'

            logger.info(
                f"[Camera {self.camera_id}] Detected: {name} ({role}) | "
                f"confidence: {confidence:.2%} | distance: {distance:.3f}"
            )

            if self.camera_type == 'Entry':
                self.db_handler.mark_entry(person_id, person_type, self.zone_id, self.camera_id)
                logger.info(f"[Entry] {name} entered Zone {self.zone_id}")

            elif self.camera_type == 'Exit':
                self.db_handler.mark_exit(person_id, person_type, self.zone_id, self.camera_id)
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
        self.cameras         = {}  # {camera_id: PersistentCamera}
        self.embeddings_data = []
        self.embedding_index = None  # Built once in initialize()
        self.db_handler      = None
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
            self.embedding_index = EmbeddingIndex(self.embeddings_data)
            logger.info(f"Loaded {len(self.embeddings_data)} face embeddings "
                        f"({len(self.embedding_index)} vectors in index)")
            
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
                    self.embedding_index,
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
