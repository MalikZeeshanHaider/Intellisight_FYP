"""
IntelliSight - Lightweight GPU Face Recognition Service
Optimized for WSL2 with lazy-loading of heavy dependencies
Port: 5001
"""

import os
import sys
import cv2
import numpy as np
from flask import Flask, request, jsonify, Response
from flask_cors import CORS
import threading
import time
import base64
from io import BytesIO
from PIL import Image
import json
import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime
import gc

# Configure environment BEFORE importing TensorFlow
os.environ['TF_FORCE_GPU_ALLOW_GROWTH'] = 'true'
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2'
os.environ['CUDA_VISIBLE_DEVICES'] = '0'

app = Flask(__name__)
CORS(app, resources={
    r"/*": {
        "origins": ["http://localhost:3001", "http://localhost:3000", "http://localhost:5173"],
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"]
    }
})

# Global variables
deepface_module = None
tf_module = None
gpu_available = False
active_cameras = {}
camera_lock = threading.Lock()

# Database config
DB_CONFIG = {
    'host': '127.0.0.1',
    'port': 5000,
    'database': 'FYP_Intellisight',
    'user': 'postgres',
    'password': 'ozair'
}


def lazy_load_deepface():
    """Lazy load DeepFace and TensorFlow only when needed"""
    global deepface_module, tf_module, gpu_available
    
    if deepface_module is not None:
        return True
    
    try:
        print("🔄 Loading TensorFlow and DeepFace (this may take a minute on WSL2)...")
        
        import tensorflow as tf
        tf_module = tf
        
        # Configure GPU
        gpus = tf.config.experimental.list_physical_devices('GPU')
        if gpus:
            try:
                for gpu in gpus:
                    tf.config.experimental.set_memory_growth(gpu, True)
                gpu_available = True
                print(f"✅ GPU Enabled: {len(gpus)} GPU(s) available")
            except RuntimeError as e:
                print(f"⚠️ GPU Config Error: {e}")
                gpu_available = False
        else:
            print("⚠️ No GPU found, using CPU")
            gpu_available = False
        
        from deepface import DeepFace
        deepface_module = DeepFace
        
        print("✅ DeepFace loaded successfully")
        return True
        
    except Exception as e:
        print(f"❌ Error loading DeepFace: {e}")
        return False


def get_db_connection():
    """Get database connection"""
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        return conn
    except Exception as e:
        print(f"❌ Database connection error: {e}")
        return None


def log_attendance(person_id, person_type, zone_id, camera_id, confidence, entry_time=None):
    """Log attendance to database"""
    conn = get_db_connection()
    if not conn:
        return False
    
    try:
        cursor = conn.cursor()
        
        if entry_time is None:
            entry_time = datetime.now()
        
        # Check if already logged recently (within 30 seconds)
        cursor.execute("""
            SELECT id FROM "AttendanceLog"
            WHERE person_id = %s
            AND person_type = %s
            AND zone_id = %s
            AND entry_time > NOW() - INTERVAL '30 seconds'
            ORDER BY entry_time DESC
            LIMIT 1
        """, (person_id, person_type, zone_id))
        
        if cursor.fetchone():
            print(f"⏭️ Skipping duplicate log for {person_type} {person_id}")
            return True
        
        # Insert new log
        cursor.execute("""
            INSERT INTO "AttendanceLog" (person_id, person_type, zone_id, camera_id, confidence, entry_time)
            VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING id
        """, (person_id, person_type, zone_id, camera_id, confidence, entry_time))
        
        log_id = cursor.fetchone()[0]
        conn.commit()
        
        print(f"✅ Logged attendance: {person_type} {person_id} in zone {zone_id}")
        return True
        
    except Exception as e:
        print(f"❌ Error logging attendance: {e}")
        conn.rollback()
        return False
    finally:
        conn.close()


def detect_faces_opencv(frame):
    """Fast face detection using OpenCV Haar Cascade"""
    try:
        # Load cascade if not loaded
        if not hasattr(detect_faces_opencv, 'face_cascade'):
            cascade_path = cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
            detect_faces_opencv.face_cascade = cv2.CascadeClassifier(cascade_path)
        
        # Convert to grayscale
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        
        # Detect faces
        faces = detect_faces_opencv.face_cascade.detectMultiScale(
            gray,
            scaleFactor=1.1,
            minNeighbors=5,
            minSize=(30, 30)
        )
        
        # Convert to list of dicts
        face_list = []
        for (x, y, w, h) in faces:
            face_list.append({
                'x': int(x),
                'y': int(y),
                'width': int(w),
                'height': int(h)
            })
        
        return face_list
        
    except Exception as e:
        print(f"❌ Error detecting faces: {e}")
        return []


def recognize_face_deepface(face_img, db_path='embeddings'):
    """Recognize face using DeepFace (lazy loaded)"""
    try:
        # Lazy load DeepFace
        if not lazy_load_deepface():
            return None, 0.0
        
        # Perform recognition
        result = deepface_module.find(
            img_path=face_img,
            db_path=db_path,
            model_name='Facenet',
            detector_backend='opencv',
            enforce_detection=False
        )
        
        if result and len(result) > 0 and len(result[0]) > 0:
            match = result[0].iloc[0]
            identity = match['identity']
            distance = match['distance']
            
            # Extract person info from path
            # Expected format: embeddings/student_123/image.jpg
            parts = identity.split('/')
            if len(parts) >= 2:
                person_folder = parts[-2]
                person_type, person_id = person_folder.split('_')
                
                confidence = 1.0 - distance  # Convert distance to confidence
                return {
                    'person_id': int(person_id),
                    'person_type': person_type,
                    'confidence': confidence
                }, confidence
        
        return None, 0.0
        
    except Exception as e:
        print(f"❌ Error recognizing face: {e}")
        return None, 0.0


@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'service': 'GPU Face Recognition Service',
        'gpu_available': gpu_available,
        'deepface_loaded': deepface_module is not None,
        'active_cameras': len(active_cameras),
        'port': 5001
    })


@app.route('/detect', methods=['POST'])
def detect_faces():
    """Detect faces in uploaded image"""
    try:
        # Get image from request
        if 'image' not in request.files:
            return jsonify({'error': 'No image provided'}), 400
        
        file = request.files['image']
        
        # Read image
        img_bytes = file.read()
        nparr = np.frombuffer(img_bytes, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if frame is None:
            return jsonify({'error': 'Invalid image'}), 400
        
        # Detect faces
        faces = detect_faces_opencv(frame)
        
        return jsonify({
            'success': True,
            'faces': faces,
            'count': len(faces)
        })
        
    except Exception as e:
        print(f"❌ Error in detect endpoint: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/recognize', methods=['POST'])
def recognize_faces():
    """Detect and recognize faces in uploaded image"""
    try:
        # Get image from request
        if 'image' not in request.files:
            return jsonify({'error': 'No image provided'}), 400
        
        file = request.files['image']
        zone_id = request.form.get('zone_id', 1)
        camera_id = request.form.get('camera_id', 1)
        
        # Read image
        img_bytes = file.read()
        nparr = np.frombuffer(img_bytes, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if frame is None:
            return jsonify({'error': 'Invalid image'}), 400
        
        # Detect faces
        faces = detect_faces_opencv(frame)
        
        # Recognize each face
        results = []
        for face in faces:
            try:
                # Extract face region
                x, y, w, h = face['x'], face['y'], face['width'], face['height']
                face_img = frame[y:y+h, x:x+w]
                
                # Recognize face
                person_info, confidence = recognize_face_deepface(face_img)
                
                if person_info and confidence > 0.6:
                    # Log attendance
                    log_attendance(
                        person_info['person_id'],
                        person_info['person_type'],
                        zone_id,
                        camera_id,
                        confidence
                    )
                    
                    results.append({
                        'face': face,
                        'person': person_info,
                        'confidence': confidence
                    })
                else:
                    results.append({
                        'face': face,
                        'person': None,
                        'confidence': 0.0
                    })
                    
            except Exception as e:
                print(f"❌ Error recognizing face: {e}")
                results.append({
                    'face': face,
                    'person': None,
                    'confidence': 0.0,
                    'error': str(e)
                })
        
        return jsonify({
            'success': True,
            'faces': results,
            'count': len(faces)
        })
        
    except Exception as e:
        print(f"❌ Error in recognize endpoint: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/preload', methods=['POST'])
def preload_models():
    """Preload DeepFace models"""
    try:
        if lazy_load_deepface():
            return jsonify({
                'success': True,
                'message': 'DeepFace models loaded',
                'gpu_available': gpu_available
            })
        else:
            return jsonify({
                'success': False,
                'message': 'Failed to load DeepFace models'
            }), 500
    except Exception as e:
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    print("=" * 60)
    print("🚀 IntelliSight GPU Face Recognition Service")
    print("=" * 60)
    print(f"📡 Starting server on http://localhost:5001")
    print("⚡ Using lazy-loading for optimal WSL2 performance")
    print("💡 Tip: Call /preload to load models in advance")
    print("=" * 60)
    
    # Run Flask app
    app.run(
        host='0.0.0.0',
        port=5001,
        debug=False,
        threaded=True
    )
