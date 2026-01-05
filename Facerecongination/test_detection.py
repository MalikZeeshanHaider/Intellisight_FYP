"""
Test Face Detection - Using Same Model as Webcam (face-api.js uses MTCNN/SSD)
This script tests if face detection is working properly
"""

import cv2
import numpy as np
from deepface import DeepFace
import time

# Test with a sample frame from webcam
def test_webcam_detection():
    print("="*60)
    print("Testing Face Detection - DeepFace")
    print("="*60)
    
    # Open webcam
    cap = cv2.VideoCapture(0)
    
    if not cap.isOpened():
        print("Could not open webcam, testing with RTSP camera...")
        cap = cv2.VideoCapture("rtsp://admin:ozair123@192.168.10.2/cam/realmonitor?channel=1&subtype=0", cv2.CAP_FFMPEG)
    
    if not cap.isOpened():
        print("Could not open any camera!")
        return
    
    print("\nCamera opened. Press 'q' to quit, 's' to test detection.\n")
    
    detectors = ['opencv', 'ssd', 'mtcnn', 'retinaface']
    current_detector = 0
    
    while True:
        ret, frame = cap.read()
        if not ret:
            print("Failed to read frame")
            break
        
        # Display frame
        cv2.imshow("Press 's' to test detection, 'n' to change detector", frame)
        
        key = cv2.waitKey(1) & 0xFF
        
        if key == ord('q'):
            break
        elif key == ord('n'):
            current_detector = (current_detector + 1) % len(detectors)
            print(f"\nSwitched to detector: {detectors[current_detector]}")
        elif key == ord('s'):
            detector = detectors[current_detector]
            print(f"\n--- Testing {detector} detector ---")
            
            try:
                start = time.time()
                
                # Test DeepFace extract_faces
                faces = DeepFace.extract_faces(
                    img_path=frame,
                    detector_backend=detector,
                    enforce_detection=False,
                    align=True
                )
                
                elapsed = time.time() - start
                print(f"Detection time: {elapsed:.3f}s")
                print(f"Faces found: {len(faces)}")
                
                # Draw detections
                display = frame.copy()
                for i, face in enumerate(faces):
                    area = face.get('facial_area', {})
                    x, y, w, h = area.get('x', 0), area.get('y', 0), area.get('w', 0), area.get('h', 0)
                    conf = face.get('confidence', 0)
                    
                    print(f"  Face {i+1}: ({x},{y}) {w}x{h}, confidence: {conf:.3f}")
                    
                    cv2.rectangle(display, (x, y), (x+w, y+h), (0, 255, 0), 2)
                    cv2.putText(display, f"{conf:.2f}", (x, y-10), 
                               cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)
                
                cv2.imshow("Detected Faces", display)
                cv2.waitKey(2000)
                cv2.destroyWindow("Detected Faces")
                
            except Exception as e:
                print(f"Error with {detector}: {e}")
    
    cap.release()
    cv2.destroyAllWindows()


def test_haar_cascade(frame=None):
    """Test OpenCV Haar Cascade detection"""
    print("\n--- Testing Haar Cascade ---")
    
    if frame is None:
        cap = cv2.VideoCapture(0)
        ret, frame = cap.read()
        cap.release()
        
        if not ret:
            print("Could not capture frame")
            return
    
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    
    # Try different Haar cascades
    cascades = [
        'haarcascade_frontalface_default.xml',
        'haarcascade_frontalface_alt.xml',
        'haarcascade_frontalface_alt2.xml',
        'haarcascade_profileface.xml'
    ]
    
    for cascade_name in cascades:
        try:
            cascade = cv2.CascadeClassifier(cv2.data.haarcascades + cascade_name)
            faces = cascade.detectMultiScale(
                gray, 
                scaleFactor=1.05,  # More sensitive
                minNeighbors=3,   # Less strict
                minSize=(30, 30)
            )
            print(f"  {cascade_name}: {len(faces)} faces detected")
        except Exception as e:
            print(f"  {cascade_name}: Error - {e}")


def test_dnn_face_detector(frame=None):
    """Test OpenCV DNN face detector (same as face-api.js SSD)"""
    print("\n--- Testing DNN Face Detector (Like face-api.js) ---")
    
    if frame is None:
        cap = cv2.VideoCapture(0)
        ret, frame = cap.read()
        cap.release()
        
        if not ret:
            print("Could not capture frame")
            return
    
    try:
        # DNN model paths
        modelFile = cv2.data.haarcascades + "../dnn/opencv_face_detector.caffemodel"
        configFile = cv2.data.haarcascades + "../dnn/opencv_face_detector.prototxt"
        
        net = cv2.dnn.readNetFromCaffe(configFile, modelFile)
        
        h, w = frame.shape[:2]
        blob = cv2.dnn.blobFromImage(frame, 1.0, (300, 300), (104.0, 177.0, 123.0))
        net.setInput(blob)
        detections = net.forward()
        
        count = 0
        for i in range(detections.shape[2]):
            confidence = detections[0, 0, i, 2]
            if confidence > 0.5:
                count += 1
        
        print(f"  DNN detector found: {count} faces")
        
    except Exception as e:
        print(f"  DNN detector error: {e}")


if __name__ == "__main__":
    print("Face Detection Test Tool")
    print("This uses the same models as face-api.js\n")
    
    # Run webcam test
    test_webcam_detection()
