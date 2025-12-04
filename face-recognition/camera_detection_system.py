"""
IntelliSight - Advanced Camera Detection System
Real-time face detection with Entry/Exit tracking and database persistence

Features:
- Dual camera support (Entry and Exit cameras)
- Real-time face detection using DeepFace + OpenCV
- Automatic database updates for ActivePresence and AttendanceLog
- Support for both Students and Teachers
- Timestamp tracking for all detections
- Zone-based tracking
"""

import cv2
import numpy as np
import time
import requests
from datetime import datetime
from typing import Dict, List, Tuple, Optional
from pathlib import Path
import psycopg2
from psycopg2.extras import RealDictCursor
import pickle
import json
from collections import defaultdict

# DeepFace for advanced face recognition
try:
    from deepface import DeepFace
    DEEPFACE_AVAILABLE = True
except ImportError:
    DEEPFACE_AVAILABLE = False
    print("[WARNING] DeepFace not available. Using face_recognition fallback.")

import face_recognition
from config import DB_CONFIG
from utils import setup_logging

logger = setup_logging()


class CameraDetectionSystem:
    """Advanced camera detection system with entry/exit tracking"""
    
    def __init__(
        self,
        zone_id: int = 1,
        entry_camera_source: int = 0,
        exit_camera_source: int = 1,
        backend_url: str = "http://localhost:3000/api",
        use_deepface: bool = True
    ):
        """
        Initialize camera detection system
        
        Args:
            zone_id: Zone ID for tracking
            entry_camera_source: Camera source for entry (0=webcam, URL for IP camera)
            exit_camera_source: Camera source for exit (set to None for entry-only)
            backend_url: Backend API URL
            use_deepface: Use DeepFace for recognition (fallback to face_recognition)
        """
        self.zone_id = zone_id
        self.backend_url = backend_url
        self.use_deepface = use_deepface and DEEPFACE_AVAILABLE
        
        logger.info(f"🎬 Initializing Camera Detection System for Zone {zone_id}")
        logger.info(f"🔍 Using {'DeepFace' if self.use_deepface else 'face_recognition'}")
        
        # Database connection
        self.db_conn = None
        self.connect_database()
        
        # Load known faces from database
        self.known_faces = self.load_known_faces()
        logger.info(f"👥 Loaded {len(self.known_faces)} known faces")
        
        # Camera setup
        self.entry_camera = self.init_camera(entry_camera_source, "Entry")
        self.exit_camera = self.init_camera(exit_camera_source, "Exit") if exit_camera_source else None
        
        # Tracking state
        self.last_detection: Dict[str, Dict] = defaultdict(dict)  # camera_type -> person_key -> last_time
        self.detection_cooldown = 5.0  # Seconds between same person detections
        self.confidence_threshold = 0.6
        
        # Performance metrics
        self.frame_count = 0
        self.process_every_n_frames = 2
        self.fps_start = time.time()
        
    def connect_database(self):
        """Connect to PostgreSQL database"""
        try:
            self.db_conn = psycopg2.connect(**DB_CONFIG)
            logger.info("✅ Database connected")
        except Exception as e:
            logger.error(f"❌ Database connection failed: {e}")
            raise
    
    def init_camera(self, source, camera_type: str) -> cv2.VideoCapture:
        """Initialize camera capture"""
        try:
            cap = cv2.VideoCapture(source)
            cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
            cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
            cap.set(cv2.CAP_PROP_FPS, 30)
            
            if cap.isOpened():
                logger.info(f"✅ {camera_type} camera initialized (source: {source})")
                return cap
            else:
                logger.error(f"❌ Failed to open {camera_type} camera")
                return None
        except Exception as e:
            logger.error(f"❌ Camera initialization error: {e}")
            return None
    
    def load_known_faces(self) -> Dict:
        """
        Load known faces from database with embeddings
        
        Returns:
            Dict mapping person_key to person data
        """
        known_faces = {}
        
        try:
            with self.db_conn.cursor(cursor_factory=RealDictCursor) as cur:
                # Load students
                cur.execute("""
                    SELECT "Student_ID", "Name", "Email", "Department", 
                           "RollNumber", "Face_Embeddings", "Gender"
                    FROM "Students" 
                    WHERE "Face_Embeddings" IS NOT NULL
                """)
                
                for row in cur.fetchall():
                    try:
                        encodings = pickle.loads(row['Face_Embeddings'])
                        person_key = f"Student_{row['Student_ID']}"
                        known_faces[person_key] = {
                            'id': row['Student_ID'],
                            'name': row['Name'],
                            'type': 'Student',
                            'encodings': encodings,
                            'email': row['Email'],
                            'department': row['Department'],
                            'roll_number': row['RollNumber'],
                            'gender': row['Gender']
                        }
                    except Exception as e:
                        logger.error(f"Failed to load student {row['Student_ID']}: {e}")
                
                # Load teachers
                cur.execute("""
                    SELECT "Teacher_ID", "Name", "Email", "Department", 
                           "Face_Embeddings", "Gender", "Faculty_Type"
                    FROM "Teacher" 
                    WHERE "Face_Embeddings" IS NOT NULL
                """)
                
                for row in cur.fetchall():
                    try:
                        encodings = pickle.loads(row['Face_Embeddings'])
                        person_key = f"Teacher_{row['Teacher_ID']}"
                        known_faces[person_key] = {
                            'id': row['Teacher_ID'],
                            'name': row['Name'],
                            'type': 'Teacher',
                            'encodings': encodings,
                            'email': row['Email'],
                            'department': row['Department'],
                            'faculty_type': row['Faculty_Type'],
                            'gender': row['Gender']
                        }
                    except Exception as e:
                        logger.error(f"Failed to load teacher {row['Teacher_ID']}: {e}")
        
        except Exception as e:
            logger.error(f"Error loading known faces: {e}")
        
        return known_faces
    
    def detect_faces(self, frame: np.ndarray) -> List[Tuple]:
        """
        Detect faces in frame
        
        Returns:
            List of (top, right, bottom, left) coordinates
        """
        # Convert to RGB for face_recognition
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        
        # Resize for faster detection
        small_frame = cv2.resize(rgb_frame, (0, 0), fx=0.25, fy=0.25)
        
        # Detect face locations
        face_locations = face_recognition.face_locations(small_frame, model="hog")
        
        # Scale back up
        face_locations = [(top*4, right*4, bottom*4, left*4) 
                         for (top, right, bottom, left) in face_locations]
        
        return face_locations
    
    def recognize_face(self, frame: np.ndarray, face_location: Tuple) -> Optional[Dict]:
        """
        Recognize face using face_recognition library
        
        Returns:
            Dict with person info and confidence, or None if unknown
        """
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        
        # Get face encoding
        face_encodings = face_recognition.face_encodings(rgb_frame, [face_location])
        
        if not face_encodings:
            return None
        
        face_encoding = face_encodings[0]
        
        # Compare with known faces
        best_match = None
        best_distance = 1.0
        
        for person_key, person_data in self.known_faces.items():
            if not person_data['encodings']:
                continue
            
            # Compare with all stored encodings for this person
            distances = face_recognition.face_distance(
                person_data['encodings'], 
                face_encoding
            )
            min_distance = min(distances) if len(distances) > 0 else 1.0
            
            if min_distance < best_distance and min_distance < self.confidence_threshold:
                best_distance = min_distance
                best_match = {
                    'person_key': person_key,
                    'person_id': person_data['id'],
                    'person_type': person_data['type'],
                    'name': person_data['name'],
                    'confidence': 1.0 - min_distance,
                    'email': person_data.get('email'),
                    'department': person_data.get('department')
                }
        
        return best_match
    
    def record_entry(self, person_id: int, person_type: str) -> bool:
        """
        Record entry to zone (Entry camera detection)
        
        Creates entries in:
        - ActivePresence: Current presence in zone
        - AttendanceLog: Historical log with EntryTime (ExitTime = NULL)
        - Logs: Individual person detection record (ExitTime = NULL)
        
        Returns:
            True if successful, False if person already in zone
        """
        try:
            logger.info(f"📝 record_entry called: {person_type} {person_id}")
            
            # Check database connection
            if not self.db_conn or self.db_conn.closed:
                logger.error("❌ Database connection is closed!")
                self.connect_database()
            
            with self.db_conn.cursor() as cur:
                # Check if already in zone - skip if present
                id_field = '"Student_ID"' if person_type == 'Student' else '"Teacher_ID"'
                logger.info(f"🔍 Checking ActivePresence for {person_type} {person_id}")
                
                cur.execute(f"""
                    SELECT "Presence_ID" FROM "ActivePresence" 
                    WHERE {id_field} = %s AND "Zone_id" = %s
                """, (person_id, self.zone_id))
                
                existing = cur.fetchone()
                if existing:
                    logger.info(f"⏭️ {person_type} {person_id} already in zone (Presence_ID: {existing[0]}) - skipping")
                    return False
                
                # Also check for open attendance log (no exit time)
                logger.info(f"🔍 Checking for open AttendanceLog for {person_type} {person_id}")
                cur.execute(f"""
                    SELECT "Log_ID" FROM "AttendanceLog" 
                    WHERE {id_field} = %s AND "Zone_id" = %s AND "ExitTime" IS NULL
                """, (person_id, self.zone_id))
                
                open_log = cur.fetchone()
                if open_log:
                    logger.info(f"⏭️ {person_type} {person_id} has open attendance log (Log_ID: {open_log[0]}) - skipping duplicate")
                    return False
                
                logger.info(f"✅ Person not in zone, creating entry records...")
                entry_time = datetime.now()
                
                # Add to ActivePresence
                if person_type == 'Student':
                    cur.execute("""
                        INSERT INTO "ActivePresence" 
                        ("Zone_id", "Student_ID", "PersonType", "EntryTime")
                        VALUES (%s, %s, %s, %s)
                        ON CONFLICT DO NOTHING
                        RETURNING "Presence_ID"
                    """, (self.zone_id, person_id, person_type, entry_time))
                else:
                    cur.execute("""
                        INSERT INTO "ActivePresence" 
                        ("Zone_id", "Teacher_ID", "PersonType", "EntryTime")
                        VALUES (%s, %s, %s, %s)
                        ON CONFLICT DO NOTHING
                        RETURNING "Presence_ID"
                    """, (self.zone_id, person_id, person_type, entry_time))
                
                presence_result = cur.fetchone()
                presence_id = presence_result[0] if presence_result else None
                
                # Add to AttendanceLog
                if person_type == 'Student':
                    cur.execute("""
                        INSERT INTO "AttendanceLog" 
                        ("Zone_id", "Student_ID", "PersonType", "EntryTime", "ExitTime", "Duration")
                        VALUES (%s, %s, %s, %s, NULL, NULL)
                        RETURNING "Log_ID"
                    """, (self.zone_id, person_id, person_type, entry_time))
                else:
                    cur.execute("""
                        INSERT INTO "AttendanceLog" 
                        ("Zone_id", "Teacher_ID", "PersonType", "EntryTime", "ExitTime", "Duration")
                        VALUES (%s, %s, %s, %s, NULL, NULL)
                        RETURNING "Log_ID"
                    """, (self.zone_id, person_id, person_type, entry_time))
                
                log_id = cur.fetchone()[0]
                
                # Create entry in Logs table for tracking
                if person_type == 'Student':
                    cur.execute("""
                        INSERT INTO "Logs" 
                        ("EntryTime", "PersonType", "Student_ID", "Zone_id")
                        VALUES (%s, %s, %s, %s)
                        RETURNING "Logs_ID"
                    """, (entry_time, person_type, person_id, self.zone_id))
                else:
                    cur.execute("""
                        INSERT INTO "Logs" 
                        ("EntryTime", "PersonType", "Teacher_ID", "Zone_id")
                        VALUES (%s, %s, %s, %s)
                        RETURNING "Logs_ID"
                    """, (entry_time, person_type, person_id, self.zone_id))
                
                logs_entry_id = cur.fetchone()[0]
                
                self.db_conn.commit()
                
                logger.info(f"✅ ENTRY: {person_type} {person_id} → Zone {self.zone_id}")
                if presence_id:
                    logger.info(f"   ├─ ActivePresence ID: {presence_id}")
                logger.info(f"   ├─ AttendanceLog ID: {log_id}")
                logger.info(f"   └─ Logs Entry ID: {logs_entry_id}")
                
                # Send to backend API
                self.notify_backend(person_id, person_type, 'Entry')
                
                return True
                
        except Exception as e:
            logger.error(f"❌ Entry record error: {e}")
            logger.error(f"   Error details: {str(e)}")
            self.db_conn.rollback()
            return False
    
    def record_exit(self, person_id: int, person_type: str) -> bool:
        """
        Record exit from zone (Exit camera detection)
        
        Updates:
        - AttendanceLog: Sets ExitTime and calculates Duration
        - Deletes from ActivePresence
        
        Returns:
            True if successful, False otherwise
        """
        try:
            with self.db_conn.cursor(cursor_factory=RealDictCursor) as cur:
                id_field = '"Student_ID"' if person_type == 'Student' else '"Teacher_ID"'
                
                # Find active presence
                cur.execute(f"""
                    SELECT "Presence_ID", "EntryTime" 
                    FROM "ActivePresence" 
                    WHERE {id_field} = %s AND "Zone_id" = %s
                """, (person_id, self.zone_id))
                
                active = cur.fetchone()
                if not active:
                    logger.warning(f"⚠️ {person_type} {person_id} not in zone (no exit to record)")
                    return False
                
                exit_time = datetime.now()
                entry_time = active['EntryTime']
                duration_minutes = int((exit_time - entry_time).total_seconds() / 60)
                
                # Update AttendanceLog
                cur.execute(f"""
                    UPDATE "AttendanceLog"
                    SET "ExitTime" = %s, "Duration" = %s
                    WHERE {id_field} = %s 
                      AND "Zone_id" = %s 
                      AND "ExitTime" IS NULL
                    ORDER BY "EntryTime" DESC
                    LIMIT 1
                    RETURNING "Log_ID"
                """, (exit_time, duration_minutes, person_id, self.zone_id))
                
                result = cur.fetchone()
                if result:
                    log_id = result['Log_ID']
                else:
                    logger.warning(f"⚠️ No open attendance log found for {person_type} {person_id}")
                    log_id = None
                
                # Delete from ActivePresence
                cur.execute(f"""
                    DELETE FROM "ActivePresence" 
                    WHERE "Presence_ID" = %s
                """, (active['Presence_ID'],))
                
                # Update Logs table with exit time
                cur.execute(f"""
                    UPDATE "Logs"
                    SET "ExitTime" = %s
                    WHERE {id_field} = %s 
                      AND "Zone_id" = %s 
                      AND "ExitTime" IS NULL
                    ORDER BY "EntryTime" DESC
                    LIMIT 1
                    RETURNING "Logs_ID"
                """, (exit_time, person_id, self.zone_id))
                
                logs_result = cur.fetchone()
                logs_id = logs_result[0] if logs_result else None
                
                self.db_conn.commit()
                
                logger.info(f"🚪 EXIT: {person_type} {person_id} ← Zone {self.zone_id}")
                logger.info(f"   ├─ Duration: {duration_minutes} minutes")
                if log_id:
                    logger.info(f"   ├─ AttendanceLog ID: {log_id}")
                if logs_id:
                    logger.info(f"   └─ Logs Exit ID: {logs_id}")
                
                # Send to backend API
                self.notify_backend(person_id, person_type, 'Exit', duration_minutes)
                
                return True
                
        except Exception as e:
            logger.error(f"❌ Exit record error: {e}")
            self.db_conn.rollback()
            return False
    
    def notify_backend(self, person_id: int, person_type: str, camera_type: str, duration: int = None):
        """Send notification to backend API"""
        try:
            endpoint = f"{self.backend_url}/zones/{self.zone_id}/recognize"
            payload = {
                'personId': person_id,
                'personType': person_type,
                'cameraType': camera_type,
                'confidence': 0.95,
                'timestamp': datetime.now().isoformat()
            }
            
            if duration is not None:
                payload['duration'] = duration
            
            response = requests.post(endpoint, json=payload, timeout=5)
            
            if response.status_code in [200, 201]:
                logger.debug(f"📡 Backend notified: {camera_type} - {person_type} {person_id}")
            else:
                logger.warning(f"⚠️ Backend response: {response.status_code}")
                
        except Exception as e:
            logger.warning(f"⚠️ Backend notification failed: {e}")
    
    def save_unknown_face(self, frame: np.ndarray, face_location: Tuple):
        """Save unknown face to database"""
        try:
            top, right, bottom, left = face_location
            
            # Extract face region
            face_img = frame[top:bottom, left:right]
            
            # Encode to bytes
            _, buffer = cv2.imencode('.jpg', face_img)
            img_bytes = buffer.tobytes()
            
            with self.db_conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO "UnknownFaces" 
                    ("Captured_Image", "Zone_id", "DetectedTime", "Status", "Confidence")
                    VALUES (%s, %s, %s, %s, %s)
                    RETURNING "Unknown_ID"
                """, (img_bytes, self.zone_id, datetime.now(), 'PENDING', 0.0))
                
                unknown_id = cur.fetchone()[0]
                self.db_conn.commit()
                
                logger.info(f"❓ Unknown face saved (ID: {unknown_id})")
                
        except Exception as e:
            logger.error(f"❌ Error saving unknown face: {e}")
    
    def process_frame(self, frame: np.ndarray, camera_type: str) -> np.ndarray:
        """
        Process single frame for face detection and recognition
        
        Args:
            frame: Input frame
            camera_type: 'Entry' or 'Exit'
            
        Returns:
            Annotated frame
        """
        current_time = time.time()
        
        # Detect faces
        face_locations = self.detect_faces(frame)
        
        for face_location in face_locations:
            top, right, bottom, left = face_location
            
            # Recognize face
            match = self.recognize_face(frame, face_location)
            
            if match:
                person_key = match['person_key']
                person_id = match['person_id']
                person_type = match['person_type']
                name = match['name']
                confidence = match['confidence']
                
                # Check cooldown
                last_time = self.last_detection[camera_type].get(person_key, 0)
                
                if current_time - last_time > self.detection_cooldown:
                    # Record entry or exit
                    logger.info(f"🔄 Attempting to record {camera_type} for {person_type} {person_id}")
                    
                    if camera_type == 'Entry':
                        success = self.record_entry(person_id, person_type)
                        if success:
                            logger.info(f"✅ Entry recorded successfully")
                        else:
                            logger.info(f"⏭️ Entry skipped (person already in zone)")
                    elif camera_type == 'Exit':
                        success = self.record_exit(person_id, person_type)
                        if success:
                            logger.info(f"✅ Exit recorded successfully")
                        else:
                            logger.info(f"⏭️ Exit skipped (person not in zone)")
                    
                    self.last_detection[camera_type][person_key] = current_time
                else:
                    time_remaining = self.detection_cooldown - (current_time - last_time)
                    logger.debug(f"⏳ Cooldown active: {time_remaining:.1f}s remaining for {person_type} {person_id}")
                
                # Draw bounding box
                cv2.rectangle(frame, (left, top), (right, bottom), (0, 255, 0), 2)
                
                # Draw label
                label = f"{name} ({confidence*100:.0f}%)"
                cv2.rectangle(frame, (left, bottom - 35), (right, bottom), (0, 255, 0), cv2.FILLED)
                cv2.putText(frame, label, (left + 6, bottom - 6), 
                           cv2.FONT_HERSHEY_DUPLEX, 0.6, (255, 255, 255), 1)
                
                # Draw person type
                cv2.putText(frame, person_type.upper(), (left + 6, top - 6),
                           cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)
            else:
                # Unknown face
                if np.random.random() < 0.1:  # Save 10% of unknown faces
                    self.save_unknown_face(frame, face_location)
                
                # Draw bounding box
                cv2.rectangle(frame, (left, top), (right, bottom), (0, 0, 255), 2)
                cv2.putText(frame, "UNKNOWN", (left + 6, bottom - 6),
                           cv2.FONT_HERSHEY_DUPLEX, 0.6, (0, 0, 255), 1)
        
        # Draw camera type and timestamp
        cv2.putText(frame, f"{camera_type} Camera", (10, 30),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
        cv2.putText(frame, datetime.now().strftime("%Y-%m-%d %H:%M:%S"), (10, 60),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
        cv2.putText(frame, f"Zone {self.zone_id}", (10, 85),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
        
        return frame
    
    def run(self):
        """Main loop - process camera feeds"""
        logger.info("🚀 Starting camera detection system...")
        logger.info("Press 'q' to quit, 'e' for Entry view, 'x' for Exit view, 'b' for both")
        
        view_mode = 'both'  # 'entry', 'exit', 'both'
        
        try:
            while True:
                frames = {}
                
                # Read entry camera
                if self.entry_camera and self.entry_camera.isOpened():
                    ret, frame = self.entry_camera.read()
                    if ret:
                        self.frame_count += 1
                        
                        # Process every Nth frame
                        if self.frame_count % self.process_every_n_frames == 0:
                            frames['entry'] = self.process_frame(frame, 'Entry')
                        else:
                            frames['entry'] = frame
                
                # Read exit camera
                if self.exit_camera and self.exit_camera.isOpened():
                    ret, frame = self.exit_camera.read()
                    if ret:
                        frames['exit'] = self.process_frame(frame, 'Exit')
                
                # Display frames based on view mode
                if view_mode == 'both' and 'entry' in frames and 'exit' in frames:
                    combined = np.hstack([frames['entry'], frames['exit']])
                    cv2.imshow('IntelliSight - Entry | Exit', combined)
                elif view_mode == 'entry' and 'entry' in frames:
                    cv2.imshow('IntelliSight - Entry Camera', frames['entry'])
                elif view_mode == 'exit' and 'exit' in frames:
                    cv2.imshow('IntelliSight - Exit Camera', frames['exit'])
                
                # Calculate FPS
                if self.frame_count % 30 == 0:
                    fps = 30 / (time.time() - self.fps_start)
                    logger.debug(f"FPS: {fps:.1f}")
                    self.fps_start = time.time()
                
                # Handle keyboard input
                key = cv2.waitKey(1) & 0xFF
                if key == ord('q'):
                    break
                elif key == ord('e'):
                    view_mode = 'entry'
                    logger.info("📹 Viewing: Entry camera only")
                elif key == ord('x'):
                    view_mode = 'exit'
                    logger.info("📹 Viewing: Exit camera only")
                elif key == ord('b'):
                    view_mode = 'both'
                    logger.info("📹 Viewing: Both cameras")
        
        except KeyboardInterrupt:
            logger.info("\n⚠️ Detection stopped by user")
        except Exception as e:
            logger.error(f"❌ Detection error: {e}")
        finally:
            self.cleanup()
    
    def cleanup(self):
        """Clean up resources"""
        if self.entry_camera:
            self.entry_camera.release()
        if self.exit_camera:
            self.exit_camera.release()
        cv2.destroyAllWindows()
        if self.db_conn:
            self.db_conn.close()
        
        logger.info("✅ Cleanup complete")


def main():
    """Main entry point"""
    import argparse
    
    parser = argparse.ArgumentParser(description='IntelliSight Camera Detection System')
    parser.add_argument('--zone', type=int, default=1, help='Zone ID')
    parser.add_argument('--entry-camera', type=int, default=0, help='Entry camera source')
    parser.add_argument('--exit-camera', type=int, default=None, help='Exit camera source (optional)')
    parser.add_argument('--backend', default='http://localhost:3000/api', help='Backend API URL')
    parser.add_argument('--no-deepface', action='store_true', help='Disable DeepFace')
    
    args = parser.parse_args()
    
    system = CameraDetectionSystem(
        zone_id=args.zone,
        entry_camera_source=args.entry_camera,
        exit_camera_source=args.exit_camera,
        backend_url=args.backend,
        use_deepface=not args.no_deepface
    )
    
    system.run()


if __name__ == "__main__":
    main()
