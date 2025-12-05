"""
IntelliSight - Dual Camera Face Recognition System using DeepFace (FaceNet)
Monitors entry and exit cameras for a zone.
- Entry camera: Adds detected persons to ActivePresence
- Exit camera: Removes from ActivePresence and logs to AttendanceLog

Usage:
    python recognition.py --zone 1
    python recognition.py --zone 1 --entry-only
    python recognition.py --zone 1 --exit-only
"""

import os
import json
import cv2
import numpy as np
import time
import argparse
from datetime import datetime
from deepface import DeepFace

from database_handler import DatabaseHandler
from config import (
    MODEL_NAME, DISTANCE_THRESHOLD, MIN_FACE_SIZE, 
    CONSECUTIVE_MATCHES, EMBEDDINGS_FILE, DETECTOR_BACKEND,
    UNIDENTIFIED_SAVE_PATH
)
from utils import (
    setup_logging, get_euclidean_distance, find_best_match,
    load_embeddings_from_json, draw_face_box, draw_info_panel, FPSCounter
)

logger = setup_logging()

# Recognition settings
PROCESS_EVERY_N_FRAMES = 10  # Process recognition every N frames
MAX_FACES = 10  # Maximum faces to process at once


class DualCameraRecognizer:
    def __init__(self, zone_id):
        self.zone_id = zone_id
        self.db_handler = DatabaseHandler()
        self.zone_name = self.db_handler.get_zone_name(zone_id)
        
        # Load known faces from embeddings file
        self.embeddings_data = self.load_embeddings()
        
        # Get cameras for zone
        cameras = self.db_handler.get_zone_cameras(zone_id)
        self.entry_camera = cameras['entry']
        self.exit_camera = cameras['exit']
        
        if not self.entry_camera and not self.exit_camera:
            raise ValueError(f"No cameras configured for Zone {zone_id}")
        
        # Initialize video captures
        self.entry_cap = None
        self.exit_cap = None
        
        if self.entry_camera:
            camera_source = self.parse_camera_source(self.entry_camera['Camera_URL'])
            self.entry_cap = cv2.VideoCapture(camera_source)
            print(f"[ENTRY CAMERA] Initialized: {camera_source}")
        
        if self.exit_camera:
            camera_source = self.parse_camera_source(self.exit_camera['Camera_URL'])
            self.exit_cap = cv2.VideoCapture(camera_source)
            print(f"[EXIT CAMERA] Initialized: {camera_source}")
        
        # Tracking variables
        self.entry_match_counts = {}  # {person_key: count}
        self.exit_match_counts = {}
        self.frame_count = 0
        self.fps_counter = FPSCounter()
        
        # Haar Cascade for fast face detection
        self.face_cascade = cv2.CascadeClassifier(
            cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
        )
        
        print(f"\n{'='*60}")
        print(f"DUAL CAMERA RECOGNITION SYSTEM - DeepFace FaceNet")
        print(f"Zone: {self.zone_name} (ID: {zone_id})")
        print(f"Known Persons: {len(self.embeddings_data)}")
        print(f"Entry Camera: {'✓' if self.entry_cap else '✗'}")
        print(f"Exit Camera: {'✓' if self.exit_cap else '✗'}")
        print(f"Distance Threshold: {DISTANCE_THRESHOLD}")
        print(f"{'='*60}\n")

    def parse_camera_source(self, camera_url):
        """Parse camera URL/index"""
        if not camera_url:
            return 0
        try:
            return int(camera_url)
        except ValueError:
            return camera_url

    def load_embeddings(self):
        """Load embeddings from JSON file"""
        embeddings_data = load_embeddings_from_json(EMBEDDINGS_FILE)
        
        if not embeddings_data:
            print(f"[WARNING] No embeddings found in {EMBEDDINGS_FILE}")
            print("[WARNING] Run 'python train.py' or 'python enrollment.py --train' first!")
            return []
        
        persons = set([d['person'] for d in embeddings_data])
        print(f"[EMBEDDINGS] Loaded {len(embeddings_data)} embeddings for: {', '.join(persons)}")
        return embeddings_data

    def recognize_face(self, face_crop):
        """
        Recognize a single face crop using DeepFace FaceNet
        
        Args:
            face_crop: OpenCV image of cropped face
            
        Returns:
            tuple: (person_name, distance) or (None, None)
        """
        try:
            # Generate embedding using DeepFace
            results = DeepFace.represent(
                img_path=face_crop,
                model_name=MODEL_NAME,
                detector_backend="opencv",  # Use opencv for speed on crops
                enforce_detection=False,
                align=False
            )
            
            if results and len(results) > 0:
                embedding = results[0]["embedding"]
                person, distance = find_best_match(embedding, self.embeddings_data, DISTANCE_THRESHOLD)
                return person, distance
                
        except Exception as e:
            logger.debug(f"Face recognition error: {e}")
        
        return None, None

    def process_frame(self, frame, camera_type):
        """
        Process a single frame for face detection and recognition
        
        Args:
            frame: OpenCV frame
            camera_type: 'entry' or 'exit'
            
        Returns:
            tuple: (display_frame, recognized_persons)
        """
        display = frame.copy()
        recognized_persons = []
        
        # Convert to grayscale for face detection
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        
        # Detect faces using Haar Cascade (fast)
        faces = self.face_cascade.detectMultiScale(
            gray,
            scaleFactor=1.1,
            minNeighbors=5,
            minSize=(MIN_FACE_SIZE, MIN_FACE_SIZE)
        )
        
        # Sort by size (largest first) and limit
        if len(faces) > 0:
            faces = sorted(faces, key=lambda f: f[2] * f[3], reverse=True)[:MAX_FACES]
        
        # Process each face
        for (x, y, w, h) in faces:
            # Add margin
            margin = 20
            y1 = max(0, y - margin)
            y2 = min(frame.shape[0], y + h + margin)
            x1 = max(0, x - margin)
            x2 = min(frame.shape[1], x + w + margin)
            
            face_crop = frame[y1:y2, x1:x2]
            
            # Recognize face
            person, distance = self.recognize_face(face_crop)
            
            if person and person != "Unknown":
                # Known person
                recognized_persons.append({
                    'name': person,
                    'distance': distance,
                    'bbox': (x, y, w, h)
                })
                
                color = (0, 255, 0)  # Green
                label = f"{person} ({distance:.1f})"
                
            elif person == "Unknown":
                color = (0, 0, 255)  # Red
                label = f"Unknown ({distance:.1f})"
            else:
                color = (0, 255, 255)  # Yellow - detecting
                label = "Detecting..."
            
            # Draw box and label
            draw_face_box(display, x, y, w, h, label, color)
        
        return display, recognized_persons

    def handle_entry_detection(self, person_name):
        """Handle person detected at entry camera"""
        match_counts = self.entry_match_counts
        
        if person_name not in match_counts:
            match_counts[person_name] = 0
        
        match_counts[person_name] += 1
        
        # Require consecutive matches
        if match_counts[person_name] >= CONSECUTIVE_MATCHES:
            # Parse person type and ID from name
            person_type, person_id = self.parse_person_info(person_name)
            
            if person_type and person_id:
                success = self.db_handler.add_to_active_presence(person_id, person_type, self.zone_id)
                if success:
                    print(f"[ENTRY] ✓ {person_name} entered {self.zone_name}")
            
            # Reset count
            match_counts[person_name] = 0

    def handle_exit_detection(self, person_name):
        """Handle person detected at exit camera"""
        match_counts = self.exit_match_counts
        
        if person_name not in match_counts:
            match_counts[person_name] = 0
        
        match_counts[person_name] += 1
        
        # Require consecutive matches
        if match_counts[person_name] >= CONSECUTIVE_MATCHES:
            # Parse person type and ID from name
            person_type, person_id = self.parse_person_info(person_name)
            
            if person_type and person_id:
                success = self.db_handler.remove_from_active_presence(person_id, person_type, self.zone_id)
                if success:
                    print(f"[EXIT] ✓ {person_name} exited {self.zone_name}")
            
            # Reset count
            match_counts[person_name] = 0

    def parse_person_info(self, person_name):
        """
        Parse person type and ID from folder/person name
        
        Expected formats:
        - "student_1" or "teacher_2" 
        - "John_Doe" (matched from database)
        
        Returns:
            tuple: (person_type, person_id) or (None, None)
        """
        name_lower = person_name.lower()
        
        if name_lower.startswith('student_'):
            try:
                person_id = int(name_lower.replace('student_', ''))
                return 'Student', person_id
            except ValueError:
                pass
        
        elif name_lower.startswith('teacher_'):
            try:
                person_id = int(name_lower.replace('teacher_', ''))
                return 'Teacher', person_id
            except ValueError:
                pass
        
        # Try to lookup by name in database
        # This requires a database lookup
        return None, None

    def run(self, entry_only=False, exit_only=False):
        """
        Main recognition loop
        
        Args:
            entry_only: Only process entry camera
            exit_only: Only process exit camera
        """
        print("\n[RECOGNITION] Starting face recognition loop...")
        print("[RECOGNITION] Press 'q' to quit\n")
        
        try:
            while True:
                self.frame_count += 1
                self.fps_counter.update()
                
                # Process entry camera
                if self.entry_cap and not exit_only:
                    ret, frame = self.entry_cap.read()
                    if ret:
                        if self.frame_count % PROCESS_EVERY_N_FRAMES == 0:
                            display, recognized = self.process_frame(frame, 'entry')
                            
                            for person in recognized:
                                self.handle_entry_detection(person['name'])
                            
                            # Show status
                            fps = self.fps_counter.get_fps()
                            info_lines = [
                                f"Zone: {self.zone_name} (Entry)",
                                f"FPS: {fps:.1f}",
                                f"Faces: {len(recognized)}"
                            ]
                            draw_info_panel(display, info_lines)
                            
                            cv2.imshow(f'Entry Camera - {self.zone_name}', display)
                        else:
                            cv2.imshow(f'Entry Camera - {self.zone_name}', frame)
                
                # Process exit camera
                if self.exit_cap and not entry_only:
                    ret, frame = self.exit_cap.read()
                    if ret:
                        if self.frame_count % PROCESS_EVERY_N_FRAMES == 0:
                            display, recognized = self.process_frame(frame, 'exit')
                            
                            for person in recognized:
                                self.handle_exit_detection(person['name'])
                            
                            # Show status
                            fps = self.fps_counter.get_fps()
                            info_lines = [
                                f"Zone: {self.zone_name} (Exit)",
                                f"FPS: {fps:.1f}",
                                f"Faces: {len(recognized)}"
                            ]
                            draw_info_panel(display, info_lines)
                            
                            cv2.imshow(f'Exit Camera - {self.zone_name}', display)
                        else:
                            cv2.imshow(f'Exit Camera - {self.zone_name}', frame)
                
                # Check for quit
                if cv2.waitKey(1) & 0xFF == ord('q'):
                    break
                    
        except KeyboardInterrupt:
            print("\n[RECOGNITION] Interrupted by user")
        finally:
            self.cleanup()

    def cleanup(self):
        """Cleanup resources"""
        if self.entry_cap:
            self.entry_cap.release()
        if self.exit_cap:
            self.exit_cap.release()
        cv2.destroyAllWindows()
        self.db_handler.close()
        print("[RECOGNITION] Cleanup complete")


def main():
    parser = argparse.ArgumentParser(description='Dual Camera Face Recognition - DeepFace FaceNet')
    parser.add_argument('--zone', type=int, required=True, help='Zone ID to monitor')
    parser.add_argument('--entry-only', action='store_true', help='Only process entry camera')
    parser.add_argument('--exit-only', action='store_true', help='Only process exit camera')
    
    args = parser.parse_args()
    
    try:
        recognizer = DualCameraRecognizer(args.zone)
        recognizer.run(entry_only=args.entry_only, exit_only=args.exit_only)
    except Exception as e:
        print(f"[ERROR] {e}")
        return 1
    
    return 0


if __name__ == "__main__":
    exit(main())
