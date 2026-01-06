"""
IntelliSight - Camera Recognition Service (v2.0)
Flask-based REST API for camera management and face recognition
Port: 5001

Features:
- Entry camera: Detect faces, match with embeddings, add to ActivePresence
- Exit camera: Remove from ActivePresence, log to AttendanceLog with duration
- Real-time status updates
- Webcam and IP camera support
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
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('CameraService')

app = Flask(__name__)
CORS(app, resources={
    r"/*": {
        "origins": ["http://localhost:3001", "http://localhost:3000", "http://localhost:5173", "*"],
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"]
    }
})

# Database config
DB_CONFIG = {
    'host': '127.0.0.1',
    'port': 5000,
    'database': 'FYP_Intellisight',
    'user': 'postgres',
    'password': 'ozair'
}

# Global state
active_cameras = {}
camera_lock = threading.Lock()
embeddings_cache = {}
service_start_time = datetime.now()

# Face detection
face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')

# DeepFace lazy loading
deepface_loaded = False
DeepFace = None


def lazy_load_deepface():
    """Lazy load DeepFace for face recognition"""
    global deepface_loaded, DeepFace
    
    if deepface_loaded:
        return True
    
    try:
        logger.info("🔄 Loading DeepFace...")
        from deepface import DeepFace as DF
        DeepFace = DF
        deepface_loaded = True
        logger.info("✅ DeepFace loaded successfully")
        return True
    except Exception as e:
        logger.error(f"❌ Failed to load DeepFace: {e}")
        return False


def get_db_connection():
    """Get database connection"""
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        return conn
    except Exception as e:
        logger.error(f"❌ Database connection error: {e}")
        return None


def load_embeddings_from_db():
    """Load face embeddings from database"""
    global embeddings_cache
    
    conn = get_db_connection()
    if not conn:
        return {}
    
    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # Load from FaceEmbeddings table
        cursor.execute("""
            SELECT "PersonType", "Student_ID", "Teacher_ID", "PersonName", "EmbeddingJson"
            FROM "FaceEmbeddings"
            WHERE "EmbeddingJson" IS NOT NULL
        """)
        
        rows = cursor.fetchall()
        embeddings = {}
        
        for row in rows:
            try:
                person_name = row['PersonName'] or 'Unknown'
                person_key = person_name.lower()
                embedding = json.loads(row['EmbeddingJson']) if row['EmbeddingJson'] else None
                
                if embedding:
                    if person_key not in embeddings:
                        embeddings[person_key] = {
                            'id': row['Student_ID'] or row['Teacher_ID'],
                            'name': person_name,
                            'type': row['PersonType'],
                            'embeddings': []
                        }
                    embeddings[person_key]['embeddings'].append(embedding)
            except Exception as e:
                logger.error(f"Error parsing embedding: {e}")
        
        embeddings_cache = embeddings
        logger.info(f"✅ Loaded {len(embeddings)} persons from database")
        return embeddings
        
    except Exception as e:
        logger.error(f"❌ Error loading embeddings: {e}")
        return {}
    finally:
        conn.close()


def find_best_match(embedding, threshold=0.6):
    """Find best matching person for an embedding"""
    if not embeddings_cache:
        load_embeddings_from_db()
    
    best_match = None
    best_distance = float('inf')
    
    for person_key, person_data in embeddings_cache.items():
        for known_embedding in person_data['embeddings']:
            # Calculate Euclidean distance
            distance = np.linalg.norm(np.array(embedding) - np.array(known_embedding))
            
            if distance < best_distance:
                best_distance = distance
                best_match = person_data
    
    if best_distance < threshold:
        return best_match, best_distance
    
    return None, best_distance


def add_to_active_presence(person_id, person_type, zone_id):
    """Add person to ActivePresence (Entry detection)"""
    conn = get_db_connection()
    if not conn:
        return False
    
    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # Check if already in zone
        id_field = "Student_ID" if person_type == 'Student' else "Teacher_ID"
        cursor.execute(f"""
            SELECT "Presence_ID" FROM "ActivePresence" 
            WHERE "{id_field}" = %s AND "Zone_id" = %s
        """, (person_id, zone_id))
        
        if cursor.fetchone():
            logger.info(f"⏭️ {person_type} {person_id} already in Zone {zone_id}")
            return True  # Already present, not an error
        
        # Insert new presence
        if person_type == 'Student':
            cursor.execute("""
                INSERT INTO "ActivePresence" 
                ("PersonType", "Student_ID", "Zone_id", "EntryTime")
                VALUES (%s, %s, %s, NOW())
            """, ('Student', person_id, zone_id))
        else:
            cursor.execute("""
                INSERT INTO "ActivePresence" 
                ("PersonType", "Teacher_ID", "Zone_id", "EntryTime")
                VALUES (%s, %s, %s, NOW())
            """, ('Teacher', person_id, zone_id))
        
        conn.commit()
        logger.info(f"✅ [ENTRY] {person_type} {person_id} entered Zone {zone_id}")
        return True
        
    except Exception as e:
        logger.error(f"❌ Error adding to ActivePresence: {e}")
        conn.rollback()
        return False
    finally:
        conn.close()


def remove_from_active_presence(person_id, person_type, zone_id):
    """Remove person from ActivePresence and log to AttendanceLog (Exit detection)"""
    conn = get_db_connection()
    if not conn:
        return False
    
    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # Find active presence record
        id_field = "Student_ID" if person_type == 'Student' else "Teacher_ID"
        cursor.execute(f"""
            SELECT "Presence_ID", "EntryTime" FROM "ActivePresence" 
            WHERE "{id_field}" = %s AND "Zone_id" = %s
        """, (person_id, zone_id))
        
        presence = cursor.fetchone()
        if not presence:
            logger.info(f"⏭️ {person_type} {person_id} not in Zone {zone_id}")
            return False
        
        entry_time = presence['EntryTime']
        exit_time = datetime.now()
        duration = int((exit_time - entry_time).total_seconds())
        
        # Log to AttendanceLog
        if person_type == 'Student':
            cursor.execute("""
                INSERT INTO "AttendanceLog" 
                ("PersonType", "Student_ID", "Zone_id", "EntryTime", "ExitTime", "Duration")
                VALUES (%s, %s, %s, %s, %s, %s)
            """, ('Student', person_id, zone_id, entry_time, exit_time, duration))
        else:
            cursor.execute("""
                INSERT INTO "AttendanceLog" 
                ("PersonType", "Teacher_ID", "Zone_id", "EntryTime", "ExitTime", "Duration")
                VALUES (%s, %s, %s, %s, %s, %s)
            """, ('Teacher', person_id, zone_id, entry_time, exit_time, duration))
        
        # Remove from ActivePresence
        cursor.execute("""
            DELETE FROM "ActivePresence" WHERE "Presence_ID" = %s
        """, (presence['Presence_ID'],))
        
        conn.commit()
        logger.info(f"✅ [EXIT] {person_type} {person_id} left Zone {zone_id} (Duration: {duration}s)")
        return True
        
    except Exception as e:
        logger.error(f"❌ Error removing from ActivePresence: {e}")
        conn.rollback()
        return False
    finally:
        conn.close()


def detect_faces_opencv(frame):
    """Detect faces using OpenCV Haar Cascade"""
    try:
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        faces = face_cascade.detectMultiScale(
            gray,
            scaleFactor=1.1,
            minNeighbors=5,
            minSize=(50, 50)
        )
        
        return [{'x': int(x), 'y': int(y), 'width': int(w), 'height': int(h)} 
                for (x, y, w, h) in faces]
    except Exception as e:
        logger.error(f"Face detection error: {e}")
        return []


def recognize_face(face_crop):
    """Recognize a face using DeepFace"""
    try:
        if not lazy_load_deepface():
            return None, 1.0
        
        # Generate embedding
        results = DeepFace.represent(
            img_path=face_crop,
            model_name='Facenet',
            detector_backend='skip',  # Already cropped
            enforce_detection=False
        )
        
        if results and len(results) > 0:
            embedding = results[0]['embedding']
            return find_best_match(embedding)
        
    except Exception as e:
        logger.debug(f"Recognition error: {e}")
    
    return None, 1.0


# ==================== API ENDPOINTS ====================

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint - returns 'ok' status for frontend compatibility"""
    uptime = (datetime.now() - service_start_time).total_seconds()
    
    return jsonify({
        'status': 'ok',  # Frontend expects 'ok'
        'service': 'IntelliSight Camera Service',
        'version': '2.0',
        'uptime': int(uptime),
        'deepface_loaded': deepface_loaded,
        'active_cameras': len(active_cameras),
        'embeddings_loaded': len(embeddings_cache),
        'timestamp': datetime.now().isoformat()
    })


@app.route('/cameras/status', methods=['GET'])
def get_cameras_status():
    """Get status of all cameras"""
    return jsonify({
        'success': True,
        'cameras': {
            cam_id: {
                'camera_id': cam_id,
                'zone_id': cam_data.get('zone_id'),
                'camera_type': cam_data.get('camera_type'),
                'is_connected': cam_data.get('is_connected', False),
                'fps': cam_data.get('fps', 0),
                'last_detection': cam_data.get('last_detection')
            }
            for cam_id, cam_data in active_cameras.items()
        },
        'count': len(active_cameras)
    })


@app.route('/cameras/start/<int:camera_id>', methods=['POST'])
def start_camera(camera_id):
    """Start a specific camera"""
    try:
        data = request.json or {}
        camera_url = data.get('camera_url', '0')  # Default to webcam
        camera_type = data.get('camera_type', 'Entry')
        zone_id = data.get('zone_id', 1)
        
        # Parse camera URL
        try:
            camera_source = int(camera_url)  # Webcam index
        except ValueError:
            camera_source = camera_url  # IP camera URL
        
        with camera_lock:
            if camera_id in active_cameras:
                return jsonify({
                    'success': False,
                    'message': f'Camera {camera_id} already running'
                }), 400
            
            # Initialize camera
            cap = cv2.VideoCapture(camera_source)
            if not cap.isOpened():
                return jsonify({
                    'success': False,
                    'message': f'Failed to open camera: {camera_source}'
                }), 500
            
            active_cameras[camera_id] = {
                'cap': cap,
                'camera_url': camera_url,
                'camera_type': camera_type,
                'zone_id': zone_id,
                'is_connected': True,
                'fps': 0,
                'last_detection': None,
                'start_time': datetime.now().isoformat()
            }
        
        logger.info(f"✅ Started camera {camera_id} for Zone {zone_id} ({camera_type})")
        
        return jsonify({
            'success': True,
            'message': f'Camera {camera_id} started',
            'camera_id': camera_id,
            'camera_type': camera_type,
            'zone_id': zone_id
        })
        
    except Exception as e:
        logger.error(f"Error starting camera: {e}")
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500


@app.route('/cameras/stop/<int:camera_id>', methods=['POST'])
def stop_camera(camera_id):
    """Stop a specific camera"""
    try:
        with camera_lock:
            if camera_id not in active_cameras:
                return jsonify({
                    'success': False,
                    'message': f'Camera {camera_id} not running'
                }), 404
            
            cam_data = active_cameras.pop(camera_id)
            if cam_data.get('cap'):
                cam_data['cap'].release()
        
        logger.info(f"✅ Stopped camera {camera_id}")
        
        return jsonify({
            'success': True,
            'message': f'Camera {camera_id} stopped'
        })
        
    except Exception as e:
        logger.error(f"Error stopping camera: {e}")
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500


@app.route('/detect', methods=['POST'])
def detect_faces():
    """Detect faces in uploaded image"""
    try:
        if 'image' not in request.files:
            # Try base64 from JSON
            data = request.json or {}
            if 'image' in data:
                img_data = base64.b64decode(data['image'].split(',')[-1])
                nparr = np.frombuffer(img_data, np.uint8)
                frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            else:
                return jsonify({'error': 'No image provided'}), 400
        else:
            file = request.files['image']
            img_bytes = file.read()
            nparr = np.frombuffer(img_bytes, np.uint8)
            frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if frame is None:
            return jsonify({'error': 'Invalid image'}), 400
        
        faces = detect_faces_opencv(frame)
        
        return jsonify({
            'success': True,
            'faces': faces,
            'count': len(faces)
        })
        
    except Exception as e:
        logger.error(f"Detection error: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/recognize', methods=['POST'])
def recognize_faces():
    """Detect and recognize faces, handle entry/exit based on camera type"""
    try:
        data = request.json or {}
        zone_id = data.get('zone_id', 1)
        camera_type = data.get('camera_type', 'Entry')
        camera_id = data.get('camera_id', 1)
        
        # Get image
        if 'image' not in data:
            return jsonify({'error': 'No image provided'}), 400
        
        # Decode base64 image
        img_data = base64.b64decode(data['image'].split(',')[-1])
        nparr = np.frombuffer(img_data, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if frame is None:
            return jsonify({'error': 'Invalid image'}), 400
        
        # Detect faces
        faces = detect_faces_opencv(frame)
        results = []
        
        for face in faces:
            x, y, w, h = face['x'], face['y'], face['width'], face['height']
            
            # Add margin
            margin = 20
            y1 = max(0, y - margin)
            y2 = min(frame.shape[0], y + h + margin)
            x1 = max(0, x - margin)
            x2 = min(frame.shape[1], x + w + margin)
            
            face_crop = frame[y1:y2, x1:x2]
            
            # Recognize
            person, distance = recognize_face(face_crop)
            
            if person:
                confidence = 1.0 - distance
                
                # Handle entry/exit based on camera type
                if camera_type == 'Entry':
                    success = add_to_active_presence(
                        person['id'], 
                        person['type'], 
                        zone_id
                    )
                elif camera_type == 'Exit':
                    success = remove_from_active_presence(
                        person['id'], 
                        person['type'], 
                        zone_id
                    )
                else:
                    success = False
                
                results.append({
                    'face': face,
                    'person': {
                        'id': person['id'],
                        'name': person['name'],
                        'type': person['type']
                    },
                    'confidence': confidence,
                    'action': camera_type,
                    'success': success
                })
            else:
                results.append({
                    'face': face,
                    'person': None,
                    'confidence': 0,
                    'action': None,
                    'success': False
                })
        
        return jsonify({
            'success': True,
            'results': results,
            'faces_detected': len(faces),
            'faces_recognized': len([r for r in results if r['person']])
        })
        
    except Exception as e:
        logger.error(f"Recognition error: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/embeddings/reload', methods=['POST'])
def reload_embeddings():
    """Reload face embeddings from database"""
    try:
        embeddings = load_embeddings_from_db()
        return jsonify({
            'success': True,
            'message': f'Loaded {len(embeddings)} persons',
            'count': len(embeddings)
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500


@app.route('/active-presence/<int:zone_id>', methods=['GET'])
def get_active_presence(zone_id):
    """Get current persons in a zone"""
    conn = get_db_connection()
    if not conn:
        return jsonify({'error': 'Database connection failed'}), 500
    
    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute("""
            SELECT 
                ap.*,
                s."Name" as "StudentName",
                s."Email" as "StudentEmail",
                t."Name" as "TeacherName",
                t."Email" as "TeacherEmail"
            FROM "ActivePresence" ap
            LEFT JOIN "Students" s ON ap."Student_ID" = s."Student_ID"
            LEFT JOIN "Teacher" t ON ap."Teacher_ID" = t."Teacher_ID"
            WHERE ap."Zone_id" = %s
            ORDER BY ap."EntryTime" DESC
        """, (zone_id,))
        
        presence = cursor.fetchall()
        
        return jsonify({
            'success': True,
            'data': presence,
            'count': len(presence)
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()


@app.route('/attendance-logs', methods=['GET'])
def get_attendance_logs():
    """Get recent attendance logs"""
    limit = request.args.get('limit', 50, type=int)
    zone_id = request.args.get('zone_id', type=int)
    
    conn = get_db_connection()
    if not conn:
        return jsonify({'error': 'Database connection failed'}), 500
    
    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        query = """
            SELECT 
                al.*,
                s."Name" as "StudentName",
                t."Name" as "TeacherName",
                z."Zone_Name"
            FROM "AttendanceLog" al
            LEFT JOIN "Students" s ON al."Student_ID" = s."Student_ID"
            LEFT JOIN "Teacher" t ON al."Teacher_ID" = t."Teacher_ID"
            LEFT JOIN "Zone" z ON al."Zone_id" = z."Zone_id"
        """
        
        if zone_id:
            query += f" WHERE al.\"Zone_id\" = {zone_id}"
        
        query += " ORDER BY al.\"EntryTime\" DESC LIMIT %s"
        
        cursor.execute(query, (limit,))
        logs = cursor.fetchall()
        
        return jsonify({
            'success': True,
            'data': logs,
            'count': len(logs)
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()


def generate_camera_frames(camera_id):
    """Generator for streaming camera frames with face detection"""
    while camera_id in active_cameras:
        cam_data = active_cameras.get(camera_id)
        if not cam_data or not cam_data.get('cap'):
            break
        
        cap = cam_data['cap']
        ret, frame = cap.read()
        
        if not ret:
            # Try to reconnect
            logger.warning(f"Camera {camera_id} frame read failed, retrying...")
            time.sleep(0.5)
            continue
        
        # Detect faces and draw rectangles
        faces = detect_faces_opencv(frame)
        for face in faces:
            x, y, w, h = face['x'], face['y'], face['width'], face['height']
            cv2.rectangle(frame, (x, y), (x + w, y + h), (0, 255, 0), 2)
        
        # Add timestamp
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        cv2.putText(frame, timestamp, (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
        
        # Add camera type label
        camera_type = cam_data.get('camera_type', 'Unknown')
        label_color = (0, 255, 0) if camera_type == 'Entry' else (0, 0, 255)
        cv2.putText(frame, f"{camera_type} Camera", (10, 60), cv2.FONT_HERSHEY_SIMPLEX, 0.7, label_color, 2)
        
        # Encode as JPEG
        ret, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 70])
        if ret:
            frame_bytes = buffer.tobytes()
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
        
        time.sleep(0.033)  # ~30 FPS


@app.route('/stream/<int:camera_id>')
def stream_camera(camera_id):
    """Stream camera feed as MJPEG"""
    if camera_id not in active_cameras:
        # Return a placeholder image or error
        return jsonify({'error': f'Camera {camera_id} not found'}), 404
    
    return Response(
        generate_camera_frames(camera_id),
        mimetype='multipart/x-mixed-replace; boundary=frame'
    )


@app.route('/cameras/start-all', methods=['POST'])
def start_all_cameras():
    """Auto-start all cameras from database"""
    conn = get_db_connection()
    if not conn:
        return jsonify({'error': 'Database connection failed'}), 500
    
    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute("""
            SELECT c.*, z."Zone_Name"
            FROM "Camara" c
            LEFT JOIN "Zone" z ON c."Zone_id" = z."Zone_id"
            WHERE c."Camera_URL" IS NOT NULL
        """)
        
        cameras = cursor.fetchall()
        started = []
        failed = []
        
        for cam in cameras:
            camera_id = cam['Camara_Id']
            camera_url = cam['Camera_URL']
            camera_type = cam['Camera_Type']
            zone_id = cam['Zone_id']
            
            # Parse camera URL
            try:
                camera_source = int(camera_url)  # Webcam index
            except ValueError:
                camera_source = camera_url  # IP camera URL
            
            with camera_lock:
                if camera_id in active_cameras:
                    started.append({'id': camera_id, 'status': 'already_running'})
                    continue
                
                # Initialize camera
                cap = cv2.VideoCapture(camera_source)
                if cap.isOpened():
                    active_cameras[camera_id] = {
                        'cap': cap,
                        'camera_url': camera_url,
                        'camera_type': camera_type,
                        'zone_id': zone_id,
                        'is_connected': True,
                        'fps': 0,
                        'last_detection': None,
                        'start_time': datetime.now().isoformat()
                    }
                    started.append({'id': camera_id, 'status': 'started'})
                    logger.info(f"✅ Started camera {camera_id} ({camera_type}) for Zone {zone_id}")
                else:
                    failed.append({'id': camera_id, 'error': 'Failed to open camera'})
                    logger.error(f"❌ Failed to start camera {camera_id}")
        
        return jsonify({
            'success': True,
            'started': started,
            'failed': failed,
            'total_cameras': len(cameras)
        })
        
    except Exception as e:
        logger.error(f"Error starting all cameras: {e}")
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()


@app.route('/cameras/stop-all', methods=['POST'])
def stop_all_cameras():
    """Stop all active cameras"""
    stopped = []
    
    with camera_lock:
        for camera_id in list(active_cameras.keys()):
            cam_data = active_cameras.pop(camera_id)
            if cam_data.get('cap'):
                cam_data['cap'].release()
            stopped.append(camera_id)
            logger.info(f"✅ Stopped camera {camera_id}")
    
    return jsonify({
        'success': True,
        'stopped': stopped,
        'count': len(stopped)
    })


# ==================== MAIN ====================

if __name__ == '__main__':
    print("=" * 60)
    print("🚀 IntelliSight Camera Recognition Service v2.0")
    print("=" * 60)
    print(f"📡 Starting server on http://localhost:5001")
    print(f"📊 Database: {DB_CONFIG['host']}:{DB_CONFIG['port']}/{DB_CONFIG['database']}")
    print("=" * 60)
    
    # Pre-load embeddings
    load_embeddings_from_db()
    
    # Run Flask app
    app.run(
        host='0.0.0.0',
        port=5001,
        debug=False,
        threaded=True
    )
