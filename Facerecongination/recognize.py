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

from config import MODEL_NAME, DISTANCE_THRESHOLD, DETECTOR_BACKEND, FRAME_SKIP, EMBEDDINGS_FILE
from utils import preprocess_face_crop, EmbeddingIndex

# Constants
ATTENDANCE_FILE = "attendance.csv"
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
    
    persons = set([d.get('name') or d.get('person', 'Unknown') for d in data])
    print(f"Loaded {len(data)} embeddings for: {', '.join(sorted(persons))}")
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


def main():
    print("\n" + "=" * 60)
    print("  FACE RECOGNITION ATTENDANCE SYSTEM")
    print("  Multi-Face Detection - Up to 10 faces simultaneously")
    print("=" * 60 + "\n")
    
    # Load embeddings and build vectorized index once at startup
    embeddings_data = load_embeddings()
    if not embeddings_data:
        return
    embedding_index = EmbeddingIndex(embeddings_data)
    print(f"  Index ready: {len(embedding_index)} embedding vectors\n")

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

        # Use RetinaFace via DeepFace.represent() to detect all faces and embed in one call
        deepface_results = []
        if frame_count % FRAME_SKIP == 0:
            try:
                deepface_results = DeepFace.represent(
                    img_path=preprocess_face_crop(frame),
                    model_name=MODEL_NAME,
                    detector_backend=DETECTOR_BACKEND,
                    enforce_detection=False,
                    align=True
                )
            except Exception as e:
                pass

        # Build faces list from DeepFace results (sorted largest first, limited)
        faces = []
        for r in deepface_results:
            fa = r.get('facial_area', {})
            faces.append((fa.get('x', 0), fa.get('y', 0), fa.get('w', 0), fa.get('h', 0)))

        faces = sorted(faces, key=lambda f: f[2] * f[3], reverse=True)[:MAX_FACES]
        num_faces = len(faces)

        # Process recognition for this frame's results
        if deepface_results and frame_count % FRAME_SKIP == 0:
            print(f"\nFrame {frame_count}: Processing {len(deepface_results)} face(s)...")
            recognized_faces.clear()

            for idx, result in enumerate(deepface_results[:MAX_FACES]):
                fa        = result.get('facial_area', {})
                x, y, w, h = fa.get('x', 0), fa.get('y', 0), fa.get('w', 0), fa.get('h', 0)
                embedding = result.get('embedding')

                if not embedding:
                    continue

                person_dict, distance = embedding_index.search(embedding, DISTANCE_THRESHOLD)

                if distance is not None:
                    recognized_faces[idx] = (person_dict, distance)

                    if person_dict is not None:
                        name = person_dict['name']
                        print(f"  Face {idx+1}: {name} [{person_dict['role']}] (distance: {distance:.2f})")

                        if name not in attendance_marked:
                            if mark_attendance(name):
                                attendance_marked.add(name)
                    else:
                        print(f"  Face {idx+1}: UNKNOWN (distance: {distance:.2f})")

        # Draw rectangles and labels for all detected faces
        for idx, (x, y, w, h) in enumerate(faces):
            if idx in recognized_faces:
                person_dict, distance = recognized_faces[idx]

                if person_dict is None:
                    # Red rectangle for unknown person
                    color = (0, 0, 255)
                    label = f"Unknown ({distance:.1f})"
                else:
                    # Green rectangle for recognized person
                    color = (0, 255, 0)
                    label = f"{person_dict['name']} ({distance:.1f})"
                
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
            known_count = sum(1 for p, d in recognized_faces.values() if p is not None)
            unknown_count = sum(1 for p, d in recognized_faces.values() if p is None)
            
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
