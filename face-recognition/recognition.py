"""
Dual Camera Face Recognition System
------------------------------------
Monitors entry and exit cameras for a zone.
- Entry camera: Adds detected persons to ActivePresence
- Exit camera: Removes from ActivePresence and logs to AttendanceLog

Usage:
    python recognition.py --zone 1
"""

import cv2
import face_recognition
import numpy as np
import time
import os
import argparse
from database_handler import DatabaseHandler
from config import (
    RECOGNITION_TOLERANCE, MIN_FACE_SIZE, CONSECUTIVE_MATCHES, 
    FRAME_SKIP, UNIDENTIFIED_CONSECUTIVE, UNIDENTIFIED_COOLDOWN,
    UNIDENTIFIED_SAVE_PATH, KNOWN_FACES_CACHE, MAX_FACE_DISTANCE,
    MIN_DETECTION_CONFIDENCE, FACE_DETECTION_MODEL
)
import pickle

class DualCameraRecognizer:
    def __init__(self, zone_id):
        self.zone_id = zone_id
        self.db_handler = DatabaseHandler()
        self.zone_name = self.db_handler.get_zone_name(zone_id)
        
        # Load known faces
        self.known_persons = {}
        self.known_encodings = []
        self.load_known_faces()
        
        # Get cameras
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
        self.unknown_counts = {}
        self.unknown_encodings = []  # Store encodings of already detected unknowns
        self.unknown_detection_times = {}  # {encoding_hash: timestamp}
        self.last_unknown_time = 0
        self.frame_count = 0
        
        # Create unidentified images directory
        os.makedirs(UNIDENTIFIED_SAVE_PATH, exist_ok=True)
        
        print(f"\n{'='*60}")
        print(f"DUAL CAMERA RECOGNITION SYSTEM")
        print(f"Zone: {self.zone_name} (ID: {zone_id})")
        print(f"Known Persons: {len(self.known_persons)}")
        print(f"Entry Camera: {'✓' if self.entry_cap else '✗'}")
        print(f"Exit Camera: {'✓' if self.exit_cap else '✗'}")
        print(f"{'='*60}\n")

    def parse_camera_source(self, camera_url):
        """Parse camera URL/index"""
        if not camera_url:
            return 0
        
        # If numeric, treat as device index
        try:
            return int(camera_url)
        except ValueError:
            # Otherwise treat as RTSP URL
            return camera_url

    def load_known_faces(self):
        """Load known faces from cache or database"""
        # Try cache first
        if os.path.exists(KNOWN_FACES_CACHE):
            try:
                with open(KNOWN_FACES_CACHE, 'rb') as f:
                    self.known_persons = pickle.load(f)
                print(f"[CACHE] Loaded {len(self.known_persons)} known persons")
            except Exception as e:
                print(f"[CACHE ERROR] {e}, loading from database...")
                self.load_from_database()
        else:
            self.load_from_database()
        
        # Prepare flat encoding list for comparison
        for person_key, data in self.known_persons.items():
            for encoding in data['encodings']:
                self.known_encodings.append((encoding, person_key, data['name'], data['type'], data['id']))
        
        print(f"[LOADED] {len(self.known_encodings)} face encodings ready")

    def load_from_database(self):
        """Load known faces from database and cache them"""
        self.known_persons = self.db_handler.fetch_all_persons()
        
        # Save to cache
        with open(KNOWN_FACES_CACHE, 'wb') as f:
            pickle.dump(self.known_persons, f)
        print(f"[DATABASE] Loaded and cached {len(self.known_persons)} persons")

    def process_frame(self, frame, camera_type):
        """
        Process a single frame from entry or exit camera.
        camera_type: 'entry' or 'exit'
        """
        # Resize for faster processing while maintaining quality
        small_frame = cv2.resize(frame, (0, 0), fx=0.5, fy=0.5)
        rgb_frame = cv2.cvtColor(small_frame, cv2.COLOR_BGR2RGB)
        
        # Detect faces using configured model
        face_locations = face_recognition.face_locations(rgb_frame, model=FACE_DETECTION_MODEL)
        face_encodings = face_recognition.face_encodings(rgb_frame, face_locations)
        
        for (top, right, bottom, left), face_encoding in zip(face_locations, face_encodings):
            # Scale back to original size
            top *= 2
            right *= 2
            bottom *= 2
            left *= 2
            
            # Enhanced quality filter
            face_width = right - left
            face_height = bottom - top
            if face_width < MIN_FACE_SIZE or face_height < MIN_FACE_SIZE:
                cv2.rectangle(frame, (left, top), (right, bottom), (128, 128, 128), 1)
                cv2.putText(frame, "Too Small", (left, top - 10), 
                           cv2.FONT_HERSHEY_SIMPLEX, 0.5, (128, 128, 128), 1)
                continue
            
            # Compare with known faces
            if not self.known_encodings:
                self.handle_unknown(frame, left, top, right, bottom, camera_type, face_encoding)
                continue
            
            # Calculate face distances for all known faces
            face_distances = face_recognition.face_distance(
                [enc[0] for enc in self.known_encodings], 
                face_encoding
            )
            
            best_match_idx = np.argmin(face_distances) if len(face_distances) > 0 else -1
            best_distance = face_distances[best_match_idx] if best_match_idx >= 0 else 1.0
            
            # Check if match meets both tolerance and max distance criteria
            if best_match_idx >= 0 and best_distance < RECOGNITION_TOLERANCE and best_distance < MAX_FACE_DISTANCE:
                # Known person detected
                _, person_key, name, person_type, person_id = self.known_encodings[best_match_idx]
                confidence = 1 - best_distance
                
                # Only proceed if confidence is high enough
                if confidence >= MIN_DETECTION_CONFIDENCE:
                    self.handle_known_person(
                        person_key, person_id, person_type, name, 
                        camera_type, frame, left, top, right, bottom, confidence
                    )
                else:
                    # Low confidence - mark as uncertain
                    cv2.rectangle(frame, (left, top), (right, bottom), (255, 165, 0), 2)
                    cv2.putText(frame, f"Low Confidence: {confidence:.2f}", (left, top - 10), 
                               cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 165, 0), 2)
            else:
                # Unknown person - pass encoding for duplicate detection
                self.handle_unknown(frame, left, top, right, bottom, camera_type, face_encoding)
        
        return frame

    def handle_known_person(self, person_key, person_id, person_type, name, camera_type, frame, left, top, right, bottom, confidence):
        """Handle detection of known person with confidence score"""
        match_counts = self.entry_match_counts if camera_type == 'entry' else self.exit_match_counts
        
        # Increment match count
        if person_key not in match_counts:
            match_counts[person_key] = 0
        match_counts[person_key] += 1
        
        # Draw box with confidence
        color = (0, 255, 0) if camera_type == 'entry' else (0, 165, 255)  # Green for entry, Orange for exit
        cv2.rectangle(frame, (left, top), (right, bottom), color, 2)
        
        # Display name, match count, and confidence
        text = f"{name} ({match_counts[person_key]}/{CONSECUTIVE_MATCHES})"
        cv2.putText(frame, text, (left, top - 30), 
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2)
        conf_text = f"Conf: {confidence:.2%}"
        cv2.putText(frame, conf_text, (left, top - 10), 
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)
        
        # Log to database after consecutive matches
        if match_counts[person_key] >= CONSECUTIVE_MATCHES:
            if camera_type == 'entry':
                if self.db_handler.add_to_active_presence(person_id, person_type, self.zone_id):
                    print(f"[ENTRY] ✓ {name} ({person_type}) entered {self.zone_name} | Confidence: {confidence:.2%}")
            else:  # exit
                if self.db_handler.remove_from_active_presence(person_id, person_type, self.zone_id):
                    print(f"[EXIT] ✓ {name} ({person_type}) exited {self.zone_name} | Confidence: {confidence:.2%}")
            
            # Reset count
            match_counts[person_key] = 0

    def handle_unknown(self, frame, left, top, right, bottom, camera_type, face_encoding):
        """Handle detection of unknown person with duplicate prevention"""
        current_time = time.time()
        
        # Check if this unknown person was already detected
        is_duplicate = False
        if len(self.unknown_encodings) > 0:
            # Compare with previously detected unknowns
            distances = face_recognition.face_distance(self.unknown_encodings, face_encoding)
            min_distance = np.min(distances) if len(distances) > 0 else 1.0
            
            # If similar to a previously detected unknown (within tolerance)
            if min_distance < RECOGNITION_TOLERANCE:
                is_duplicate = True
                # Get the index of the matching unknown
                match_idx = np.argmin(distances)
                
                # Check if cooldown period has passed for this specific unknown
                encoding_hash = str(match_idx)
                last_detection = self.unknown_detection_times.get(encoding_hash, 0)
                
                if (current_time - last_detection) > UNIDENTIFIED_COOLDOWN:
                    # Update detection time but don't save again
                    self.unknown_detection_times[encoding_hash] = current_time
                    # Draw box with "Known Unknown" label
                    cv2.rectangle(frame, (left, top), (right, bottom), (128, 0, 128), 2)
                    cv2.putText(frame, "Unknown (Seen)", (left, top - 10), 
                               cv2.FONT_HERSHEY_SIMPLEX, 0.6, (128, 0, 128), 2)
                else:
                    # Still in cooldown
                    cv2.rectangle(frame, (left, top), (right, bottom), (128, 128, 128), 2)
                    cv2.putText(frame, "Unknown (Recent)", (left, top - 10), 
                               cv2.FONT_HERSHEY_SIMPLEX, 0.6, (128, 128, 128), 2)
                return
        
        # New unknown person - draw red box
        cv2.rectangle(frame, (left, top), (right, bottom), (0, 0, 255), 2)
        cv2.putText(frame, "Unknown - New", (left, top - 10), 
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 255), 2)
        
        # Save unknown face with consecutive frame requirement
        face_key = f"unknown_{len(self.unknown_encodings)}"
        if face_key not in self.unknown_counts:
            self.unknown_counts[face_key] = 0
        self.unknown_counts[face_key] += 1
        
        if self.unknown_counts[face_key] >= UNIDENTIFIED_CONSECUTIVE:
            # Crop and save face image
            face_image = frame[top:bottom, left:right]
            timestamp = time.strftime("%Y%m%d_%H%M%S")
            filename = f"unknown_{camera_type}_{timestamp}.jpg"
            filepath = os.path.join(UNIDENTIFIED_SAVE_PATH, filename)
            cv2.imwrite(filepath, face_image)
            
            # Store encoding to prevent future duplicates
            self.unknown_encodings.append(face_encoding)
            encoding_hash = str(len(self.unknown_encodings) - 1)
            self.unknown_detection_times[encoding_hash] = current_time
            
            # Log to database
            self.db_handler.log_unknown_face(self.zone_id, filepath)
            print(f"[{camera_type.upper()}] ⚠ NEW Unknown face detected and saved: {filename}")
            
            self.last_unknown_time = current_time
            self.unknown_counts[face_key] = 0

    def run(self):
        """Main recognition loop"""
        print(f"[STARTED] Recognition for {self.zone_name}. Press 'q' to quit.\n")
        
        try:
            while True:
                self.frame_count += 1
                
                # Process entry camera
                if self.entry_cap and self.entry_cap.isOpened():
                    ret, frame = self.entry_cap.read()
                    if ret and self.frame_count % FRAME_SKIP == 0:
                        frame = self.process_frame(frame, 'entry')
                        cv2.imshow(f'{self.zone_name} - ENTRY', frame)
                
                # Process exit camera
                if self.exit_cap and self.exit_cap.isOpened():
                    ret, frame = self.exit_cap.read()
                    if ret and self.frame_count % FRAME_SKIP == 0:
                        frame = self.process_frame(frame, 'exit')
                        cv2.imshow(f'{self.zone_name} - EXIT', frame)
                
                # Check for quit
                if cv2.waitKey(1) & 0xFF == ord('q'):
                    break
        
        except KeyboardInterrupt:
            print("\n[STOPPED] Recognition interrupted by user")
        finally:
            self.cleanup()

    def cleanup(self):
        """Release resources"""
        if self.entry_cap:
            self.entry_cap.release()
        if self.exit_cap:
            self.exit_cap.release()
        cv2.destroyAllWindows()
        self.db_handler.close()
        print("[CLEANUP] Resources released")

def main():
    parser = argparse.ArgumentParser(description='Dual Camera Face Recognition System')
    parser.add_argument('--zone', type=int, required=True, help='Zone ID to monitor')
    
    args = parser.parse_args()
    
    try:
        recognizer = DualCameraRecognizer(args.zone)
        recognizer.run()
    except Exception as e:
        print(f"[ERROR] {e}")

if __name__ == "__main__":
    main()
