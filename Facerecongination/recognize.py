"""
Face Recognition Attendance System - Recognition Module
MULTI-FACE DETECTION - Detects and recognizes multiple people simultaneously
Optimized for i5 U-Series CPU
"""

import os
import json
import cv2
import numpy as np
import pandas as pd
from datetime import datetime
from deepface import DeepFace

# Constants
EMBEDDINGS_FILE = os.path.join("embeddings", "representations_facenet.json")
ATTENDANCE_FILE = "attendance.csv"
MODEL_NAME = "Facenet"
DISTANCE_THRESHOLD = 10.0  # Stricter threshold - only match if distance < 10
PROCESS_EVERY_N_FRAMES = 20  # Process recognition every N frames
MAX_FACES = 10  # Maximum faces to process at once


def load_embeddings():
    """Load embeddings from JSON file"""
    if not os.path.exists(EMBEDDINGS_FILE):
        print(f"ERROR: {EMBEDDINGS_FILE} not found. Run train.py first!")
        return None
    
    with open(EMBEDDINGS_FILE, 'r') as f:
        data = json.load(f)
    
    if not data:
        print("ERROR: No embeddings found")
        return None
    
    persons = set([d['person'] for d in data])
    print(f"Loaded {len(data)} embeddings for: {', '.join(persons)}")
    return data


def init_attendance():
    """Create attendance file if not exists"""
    if not os.path.exists(ATTENDANCE_FILE):
        pd.DataFrame(columns=['name', 'date', 'time']).to_csv(ATTENDANCE_FILE, index=False)


def already_marked_today(name):
    """Check if person already marked today"""
    if not os.path.exists(ATTENDANCE_FILE):
        return False
    df = pd.read_csv(ATTENDANCE_FILE)
    if df.empty:
        return False
    today = datetime.now().strftime('%Y-%m-%d')
    return ((df['name'] == name) & (df['date'] == today)).any()


def mark_attendance(name):
    """Mark attendance for person"""
    if already_marked_today(name):
        return False
    now = datetime.now()
    row = pd.DataFrame([[name, now.strftime('%Y-%m-%d'), now.strftime('%H:%M:%S')]], 
                       columns=['name', 'date', 'time'])
    row.to_csv(ATTENDANCE_FILE, mode='a', header=False, index=False)
    print(f"*** ATTENDANCE MARKED: {name} at {now.strftime('%H:%M:%S')} ***")
    return True


def get_euclidean_distance(emb1, emb2):
    """Calculate Euclidean distance"""
    return np.linalg.norm(np.array(emb1) - np.array(emb2))


def find_best_match(embedding, embeddings_data):
    """Find the best matching person"""
    best_person = None
    min_distance = float('inf')
    
    for data in embeddings_data:
        dist = get_euclidean_distance(embedding, data['embedding'])
        if dist < min_distance:
            min_distance = dist
            best_person = data['person']
    
    return best_person, min_distance


def recognize_face(face_crop, embeddings_data):
    """
    Recognize a single face crop
    Returns (person_name, distance) or ("Unknown", distance) or (None, None)
    """
    try:
        results = DeepFace.represent(
            img_path=face_crop,
            model_name=MODEL_NAME,
            detector_backend="opencv",
            enforce_detection=False,
            align=False
        )
        
        if results and len(results) > 0:
            embedding = results[0]["embedding"]
            person, distance = find_best_match(embedding, embeddings_data)
            
            if distance <= DISTANCE_THRESHOLD:
                return person, distance
            else:
                return "Unknown", distance
                
    except Exception:
        pass
    
    return None, None


def main():
    print("\n" + "=" * 60)
    print("  FACE RECOGNITION ATTENDANCE SYSTEM")
    print("  Multi-Face Detection - Up to 10 faces simultaneously")
    print("=" * 60 + "\n")
    
    # Load embeddings
    embeddings_data = load_embeddings()
    if not embeddings_data:
        return
    
    # Init attendance file
    init_attendance()
    
    # Open webcam
    print("\nOpening webcam...")
    cap = cv2.VideoCapture(0)
    
    if not cap.isOpened():
        print("ERROR: Cannot access webcam!")
        return
    
    # Set resolution - Higher for long range detection
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
    cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
    
    print("Webcam ready! Press 'q' to quit.\n")
    
    # Load Haar Cascade for fast face detection
    face_cascade = cv2.CascadeClassifier(
        cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
    )
    
    frame_count = 0
    attendance_marked = set()
    
    # Dictionary to store recognized faces: {face_index: (name, distance)}
    recognized_faces = {}
    
    while True:
        ret, frame = cap.read()
        if not ret:
            print("Failed to grab frame")
            break
        
        frame_count += 1
        display = frame.copy()
        
        # Detect all faces using Haar Cascade - smaller minSize for long range
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        faces = face_cascade.detectMultiScale(
            gray,
            scaleFactor=1.05,
            minNeighbors=4,
            minSize=(30, 30)  # Smaller minimum to detect faces from 1-2 meters
        )
        
        num_faces = len(faces)
        
        # Sort faces by size (largest first) and limit to MAX_FACES
        if num_faces > 0:
            faces = sorted(faces, key=lambda f: f[2] * f[3], reverse=True)[:MAX_FACES]
        
        # Process recognition every N frames when faces detected
        if num_faces > 0 and frame_count % PROCESS_EVERY_N_FRAMES == 0:
            print(f"\nFrame {frame_count}: Processing {len(faces)} face(s)...")
            recognized_faces.clear()
            
            for idx, (x, y, w, h) in enumerate(faces):
                # Add margin around face
                margin = 30
                y1 = max(0, y - margin)
                y2 = min(frame.shape[0], y + h + margin)
                x1 = max(0, x - margin)
                x2 = min(frame.shape[1], x + w + margin)
                
                face_crop = frame[y1:y2, x1:x2]
                
                # Recognize this face
                person, distance = recognize_face(face_crop, embeddings_data)
                
                if person:
                    recognized_faces[idx] = (person, distance)
                    
                    if person != "Unknown":
                        print(f"  Face {idx+1}: {person} (distance: {distance:.2f})")
                        
                        # Mark attendance if not already marked
                        if person not in attendance_marked:
                            if mark_attendance(person):
                                attendance_marked.add(person)
                    else:
                        print(f"  Face {idx+1}: UNKNOWN (distance: {distance:.2f})")
        
        # Draw rectangles and labels for all detected faces
        for idx, (x, y, w, h) in enumerate(faces):
            if idx in recognized_faces:
                person, distance = recognized_faces[idx]
                
                if person == "Unknown":
                    # Red rectangle for unknown person
                    color = (0, 0, 255)
                    label = f"Unknown ({distance:.1f})"
                else:
                    # Green rectangle for recognized person
                    color = (0, 255, 0)
                    label = f"{person} ({distance:.1f})"
                
                cv2.rectangle(display, (x, y), (x+w, y+h), color, 3)
                
                # Draw label background
                label_size = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.7, 2)[0]
                cv2.rectangle(display, (x, y-25), (x + label_size[0] + 10, y), color, -1)
                cv2.putText(display, label, (x+5, y-7), 
                           cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
            else:
                # Yellow rectangle for detecting
                cv2.rectangle(display, (x, y), (x+w, y+h), (0, 255, 255), 2)
                cv2.putText(display, "Detecting...", (x, y-10),
                           cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 255), 2)
        
        # Status bar at top
        if num_faces == 0:
            status = "No faces detected - Please look at camera"
            status_color = (100, 100, 100)
        else:
            known_count = sum(1 for p, d in recognized_faces.values() if p != "Unknown")
            unknown_count = sum(1 for p, d in recognized_faces.values() if p == "Unknown")
            
            if known_count > 0 or unknown_count > 0:
                status = f"Faces: {num_faces} | Recognized: {known_count} | Unknown: {unknown_count}"
                status_color = (0, 255, 0) if known_count > 0 else (0, 255, 255)
            else:
                status = f"Faces detected: {num_faces} - Processing..."
                status_color = (0, 255, 255)
        
        # Draw status bar
        cv2.rectangle(display, (0, 0), (1280, 35), (0, 0, 0), -1)
        cv2.putText(display, status, (10, 25), 
                   cv2.FONT_HERSHEY_SIMPLEX, 0.7, status_color, 2)
        
        # Show attendance count at bottom
        if attendance_marked:
            att_text = f"Attendance: {', '.join(sorted(attendance_marked))}"
            cv2.rectangle(display, (0, 685), (1280, 720), (0, 100, 0), -1)
            cv2.putText(display, att_text, (10, 708), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
        
        # Show frame
        cv2.imshow('Face Recognition Attendance - Multi-Face', display)
        
        # Quit on 'q'
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break
    
    # Cleanup
    cap.release()
    cv2.destroyAllWindows()
    
    print("\n" + "=" * 60)
    print("SESSION ENDED")
    print(f"Total faces in session: Multiple")
    print(f"Attendance marked for: {len(attendance_marked)} person(s)")
    if attendance_marked:
        print(f"Names: {', '.join(sorted(attendance_marked))}")
    print("=" * 60 + "\n")


if __name__ == "__main__":
    main()
