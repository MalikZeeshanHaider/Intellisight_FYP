"""
Incremental Face Recognition Training (DeepFace Version)
Uses DeepFace with FaceNet for face embedding generation
Only trains NEW images that are not already in the embeddings file
Syncs embeddings to PostgreSQL database
"""

import os
import sys
import json

# Fix Windows console encoding
if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except:
        pass

# Force CPU-only mode to avoid GPU errors
import os
os.environ['CUDA_VISIBLE_DEVICES'] = '-1'
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2'  # Suppress TensorFlow warnings

try:
    import tensorflow as tf
    # Force TensorFlow to use CPU only
    tf.config.set_visible_devices([], 'GPU')
except:
    pass

try:
    import cv2
    import numpy as np
except ImportError:
    print("[ERROR] OpenCV not installed. Run: pip install opencv-python numpy")
    sys.exit(1)

try:
    from deepface import DeepFace
    DEEPFACE_AVAILABLE = True
except ImportError:
    print("[WARNING] DeepFace not installed. Using simple embeddings.")
    DEEPFACE_AVAILABLE = False

try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
except ImportError:
    print("[WARNING] psycopg2 not installed. Database sync will be skipped.")
    psycopg2 = None

# Configuration
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
IMAGES_FOLDER = os.path.join(BASE_DIR, "images")
EMBEDDINGS_FOLDER = os.path.join(BASE_DIR, "embeddings")
EMBEDDINGS_FILE = os.path.join(EMBEDDINGS_FOLDER, "representations_facenet.json")

# Database configuration
DB_CONFIG = {
    'host': 'localhost',
    'port': 5000,
    'database': 'FYP_Intellisight',
    'user': 'postgres',
    'password': 'ozair'
}

# DeepFace configuration (must match recognition_live.py)
MODEL_NAME = "Facenet"
DETECTOR_BACKEND = "opencv"


def load_existing_embeddings():
    """Load existing embeddings from file"""
    if os.path.exists(EMBEDDINGS_FILE):
        try:
            with open(EMBEDDINGS_FILE, 'r') as f:
                return json.load(f)
        except:
            return []
    return []


def get_trained_images(embeddings):
    """Get set of already trained image paths"""
    trained = set()
    for item in embeddings:
        # Store just the person/image combination
        trained.add(f"{item['person']}/{item['image']}")
    return trained


def find_new_images(trained_set):
    """Find images that haven't been trained yet"""
    new_images = []
    
    if not os.path.exists(IMAGES_FOLDER):
        print(f"[ERROR] Images folder not found: {IMAGES_FOLDER}")
        return new_images
    
    for person_name in os.listdir(IMAGES_FOLDER):
        person_path = os.path.join(IMAGES_FOLDER, person_name)
        
        if not os.path.isdir(person_path):
            continue
        
        for image_file in os.listdir(person_path):
            if not image_file.lower().endswith(('.jpg', '.jpeg', '.png')):
                continue
            
            key = f"{person_name}/{image_file}"
            if key not in trained_set:
                new_images.append({
                    'person': person_name,
                    'image': image_file,
                    'path': os.path.join(person_path, image_file)
                })
    
    return new_images


def extract_face_embedding(image_path):
    """
    Extract face embedding from an image using DeepFace FaceNet
    This matches the embedding format used in recognition_live.py
    """
    try:
        if not DEEPFACE_AVAILABLE:
            print("  [ERROR] DeepFace not available")
            return None
        
        # Use DeepFace to generate embedding
        results = DeepFace.represent(
            img_path=image_path,
            model_name=MODEL_NAME,
            detector_backend=DETECTOR_BACKEND,
            enforce_detection=False,  # Don't fail if face detection fails
            align=True  # Align face for better results
        )
        
        if results and len(results) > 0:
            embedding = results[0]["embedding"]
            return embedding
        else:
            print("  [WARNING] No face detected in image")
            return None
        
    except Exception as e:
        print(f"  [ERROR] {str(e)[:50]}")
        return None


def save_embeddings(embeddings):
    """Save embeddings to JSON file"""
    os.makedirs(EMBEDDINGS_FOLDER, exist_ok=True)
    
    with open(EMBEDDINGS_FILE, 'w') as f:
        json.dump(embeddings, f, indent=2)


def main():
    print("\n" + "="*50)
    print("INCREMENTAL FACE TRAINING")
    print("="*50)
    
    # Load existing embeddings
    existing_embeddings = load_existing_embeddings()
    trained_set = get_trained_images(existing_embeddings)
    
    print(f"[INFO] Existing embeddings: {len(existing_embeddings)}")
    
    # Find new images
    new_images = find_new_images(trained_set)
    
    if len(new_images) == 0:
        print("[OK] No new images to train")
        print("="*50 + "\n")
        return
    
    print(f"[INFO] New images to train: {len(new_images)}")
    print("-"*50)
    
    # Train new images
    new_embeddings = []
    for img_info in new_images:
        print(f"Training: {img_info['person']}/{img_info['image']}", end=" ")
        
        embedding = extract_face_embedding(img_info['path'])
        
        if embedding is not None:
            new_embeddings.append({
                'person': img_info['person'],
                'image': img_info['image'],
                'image_path': img_info['path'],
                'embedding': embedding
            })
            print("[OK]")
        else:
            print("[SKIP]")
    
    # Merge with existing embeddings
    if len(new_embeddings) > 0:
        all_embeddings = existing_embeddings + new_embeddings
        save_embeddings(all_embeddings)
        
        print("-"*50)
        print(f"[OK] Added {len(new_embeddings)} new embeddings")
        print(f"[OK] Total embeddings: {len(all_embeddings)}")
        
        # Sync to database
        sync_embeddings_to_database(all_embeddings)
    else:
        print("[WARN] No new embeddings generated")
    
    print("="*50 + "\n")


def sync_embeddings_to_database(embeddings_data):
    """
    Sync embeddings to the PostgreSQL database FaceEmbeddings table.
    Links embeddings to Students or Teachers based on folder name matching.
    """
    if psycopg2 is None:
        print("[WARN] psycopg2 not available, skipping database sync")
        return
    
    print("\n" + "-"*50)
    print("SYNCING TO DATABASE")
    print("-"*50)
    
    conn = None
    synced_count = 0
    
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        print("[DB] Connected successfully")
        
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Clear old embeddings from FaceEmbeddings table
            cur.execute('DELETE FROM "FaceEmbeddings"')
            
            # Get all students and teachers
            cur.execute('SELECT "Student_ID", "Name" FROM "Students"')
            students = {row['Name'].lower().strip(): row for row in cur.fetchall() if row['Name']}
            
            cur.execute('SELECT "Teacher_ID", "Name" FROM "Teacher"')
            teachers = {row['Name'].lower().strip(): row for row in cur.fetchall() if row['Name']}
            
            print(f"[DB] Found {len(students)} students, {len(teachers)} teachers")
            
            for item in embeddings_data:
                person_name = item["person"]
                person_name_lower = person_name.lower().strip()
                embedding = item["embedding"]
                image_path = item.get("image_path", "")
                
                embedding_json = json.dumps(embedding)
                embedding_bytes = embedding_json.encode('utf-8')
                
                # Match with student or teacher
                person_type = None
                person_id = None
                
                if person_name_lower in students:
                    person_type = "Student"
                    person_id = students[person_name_lower]['Student_ID']
                elif person_name_lower in teachers:
                    person_type = "Teacher"
                    person_id = teachers[person_name_lower]['Teacher_ID']
                else:
                    # Try partial matching
                    for name, s in students.items():
                        if person_name_lower in name or name in person_name_lower:
                            person_type = "Student"
                            person_id = s['Student_ID']
                            break
                    if not person_type:
                        for name, t in teachers.items():
                            if person_name_lower in name or name in person_name_lower:
                                person_type = "Teacher"
                                person_id = t['Teacher_ID']
                                break
                
                if person_type:
                    if person_type == "Student":
                        cur.execute("""
                            INSERT INTO "FaceEmbeddings" 
                            ("PersonType", "Student_ID", "PersonName", "ImagePath", "Embedding", "EmbeddingJson", "CreatedAt", "UpdatedAt")
                            VALUES (%s, %s, %s, %s, %s, %s, NOW(), NOW())
                        """, (person_type, person_id, person_name, image_path, embedding_bytes, embedding_json))
                    else:
                        cur.execute("""
                            INSERT INTO "FaceEmbeddings" 
                            ("PersonType", "Teacher_ID", "PersonName", "ImagePath", "Embedding", "EmbeddingJson", "CreatedAt", "UpdatedAt")
                            VALUES (%s, %s, %s, %s, %s, %s, NOW(), NOW())
                        """, (person_type, person_id, person_name, image_path, embedding_bytes, embedding_json))
                    synced_count += 1
                else:
                    # Save without linking
                    cur.execute("""
                        INSERT INTO "FaceEmbeddings" 
                        ("PersonType", "PersonName", "ImagePath", "Embedding", "EmbeddingJson", "CreatedAt", "UpdatedAt")
                        VALUES (%s, %s, %s, %s, %s, NOW(), NOW())
                    """, ("Unknown", person_name, image_path, embedding_bytes, embedding_json))
            
            conn.commit()
            print(f"[DB] Synced {synced_count} embeddings to database")
            
    except Exception as e:
        if conn:
            conn.rollback()
        print(f"[DB ERROR] {e}")
    finally:
        if conn:
            conn.close()


if __name__ == "__main__":
    main()
