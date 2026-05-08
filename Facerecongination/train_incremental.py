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

# Import configuration — fail loudly if config or required env vars are missing
try:
    from config import (
        BASE_DIR, IMAGES_FOLDER, EMBEDDINGS_FOLDER, EMBEDDINGS_FILE,
        MODEL_NAME, DETECTOR_BACKEND, DB_CONFIG
    )
except (ImportError, RuntimeError) as e:
    print(f"[FATAL] Could not load config: {e}")
    print("[FATAL] Ensure config.py exists and all required environment variables are set in .env")
    sys.exit(1)

from utils import build_person_key, preprocess_face_crop


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
    """Get set of already trained image paths.

    Handles two formats:
      - train_incremental format: {'person': 'Ali', 'image': 'img1.jpg', ...}
      - enrollment format:        {'person_key': '1|TEACHER|Ali', 'name': 'Ali', 'image': '', ...}
    """
    trained = set()
    for item in embeddings:
        person = item.get('person') or item.get('name') or ''
        image  = item.get('image', '')
        if person and image:
            trained.add(f"{person}/{image}")
        # enrollment items have image='' — they don't correspond to on-disk images
        # so we intentionally skip them (they won't collide with folder scan keys)
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

        # Apply the same preprocessing used during recognition so that
        # incremental embeddings are consistent with the full training run.
        image = cv2.imread(image_path)
        if image is None:
            print("  [ERROR] Cannot read image file")
            return None
        image = preprocess_face_crop(image)

        # Use DeepFace to generate embedding
        results = DeepFace.represent(
            img_path=image,
            model_name=MODEL_NAME,
            detector_backend=DETECTOR_BACKEND,
            enforce_detection=True,
            align=False   # must match enrollment.py (align=False) to keep embedding space consistent
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
    Sync embeddings to the FaceEmbeddings table and rewrite the JSON file.

    Mirrors the behaviour of train.py's sync function:
      - Matches folder name → DB student/teacher (exact then partial)
      - Inserts rows into FaceEmbeddings with person_id, type, name
      - Enriches each item in embeddings_data in-place with person_key / person_id /
        role / name fields
      - Rewrites the JSON file so the canonical format is persisted for future
        recognition runs (JSON fallback path in database_handler.fetch_all_persons)
    """
    if psycopg2 is None:
        print("[WARN] psycopg2 not available, skipping database sync")
        return

    print("\n" + "-"*50)
    print("SYNCING TO DATABASE")
    print("-"*50)

    conn          = None
    synced_count  = 0
    skipped_count = 0

    try:
        conn = psycopg2.connect(**DB_CONFIG)
        print("[DB] Connected successfully")

        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Rebuild entire table — incremental training still replaces all rows
            # so the table stays consistent with the merged JSON file
            cur.execute('DELETE FROM "FaceEmbeddings"')

            cur.execute('SELECT "Student_ID", "Name" FROM "Students"')
            students = {row['Name'].lower().strip(): row for row in cur.fetchall() if row['Name']}

            cur.execute('SELECT "Teacher_ID", "Name" FROM "Teacher"')
            teachers = {row['Name'].lower().strip(): row for row in cur.fetchall() if row['Name']}

            print(f"[DB] Found {len(students)} students, {len(teachers)} teachers")

            for item in embeddings_data:
                folder_person      = item.get("person", "")
                folder_person_norm = folder_person.lower().strip().replace("_", " ")
                embedding          = item["embedding"]
                image_path         = item.get("image_path", "")

                embedding_list  = embedding if isinstance(embedding, list) else list(embedding)
                embedding_json  = json.dumps(embedding_list)
                embedding_bytes = embedding_json.encode('utf-8')

                person_type = None
                person_id   = None
                db_name     = None

                # Exact match
                if folder_person_norm in students:
                    db_row      = students[folder_person_norm]
                    person_type = "Student"
                    person_id   = db_row['Student_ID']
                    db_name     = db_row['Name']
                elif folder_person_norm in teachers:
                    db_row      = teachers[folder_person_norm]
                    person_type = "Teacher"
                    person_id   = db_row['Teacher_ID']
                    db_name     = db_row['Name']
                else:
                    # Partial / substring match
                    for name_key, s in students.items():
                        if folder_person_norm in name_key or name_key in folder_person_norm:
                            person_type = "Student"
                            person_id   = s['Student_ID']
                            db_name     = s['Name']
                            break
                    if not person_type:
                        for name_key, t in teachers.items():
                            if folder_person_norm in name_key or name_key in folder_person_norm:
                                person_type = "Teacher"
                                person_id   = t['Teacher_ID']
                                db_name     = t['Name']
                                break

                if person_type and person_id and db_name:
                    role       = 'STUDENT' if person_type == 'Student' else 'TEACHER'
                    person_key = build_person_key(person_id, role, db_name)

                    if person_type == "Student":
                        cur.execute("""
                            INSERT INTO "FaceEmbeddings"
                                ("PersonType", "Student_ID", "PersonName",
                                 "ImagePath", "Embedding", "EmbeddingJson",
                                 "CreatedAt", "UpdatedAt")
                            VALUES (%s, %s, %s, %s, %s, %s, NOW(), NOW())
                        """, (person_type, person_id, db_name,
                              image_path, embedding_bytes, embedding_json))
                    else:
                        cur.execute("""
                            INSERT INTO "FaceEmbeddings"
                                ("PersonType", "Teacher_ID", "PersonName",
                                 "ImagePath", "Embedding", "EmbeddingJson",
                                 "CreatedAt", "UpdatedAt")
                            VALUES (%s, %s, %s, %s, %s, %s, NOW(), NOW())
                        """, (person_type, person_id, db_name,
                              image_path, embedding_bytes, embedding_json))

                    # Enrich item in-place for JSON rewrite below
                    item["person_key"] = person_key
                    item["person_id"]  = person_id
                    item["role"]       = role
                    item["name"]       = db_name

                    synced_count += 1
                    print(f"  [SYNCED]   {folder_person!r} → {person_key}")
                else:
                    cur.execute("""
                        INSERT INTO "FaceEmbeddings"
                            ("PersonType", "PersonName", "ImagePath",
                             "Embedding", "EmbeddingJson", "CreatedAt", "UpdatedAt")
                        VALUES (%s, %s, %s, %s, %s, NOW(), NOW())
                    """, ("Unknown", folder_person, image_path, embedding_bytes, embedding_json))
                    skipped_count += 1
                    print(f"  [UNLINKED] {folder_person!r} — no matching student/teacher found in DB")

            conn.commit()
            print(f"[DB] Synced {synced_count} embeddings, {skipped_count} unlinked")

    except Exception as e:
        if conn:
            conn.rollback()
        print(f"[DB ERROR] {e}")
    finally:
        if conn:
            conn.close()

    # Rewrite JSON file with enriched canonical format
    if synced_count > 0:
        try:
            serializable = []
            for item in embeddings_data:
                emb = item["embedding"]
                serializable.append({
                    "person":     item.get("person", ""),
                    "person_key": item.get("person_key", ""),
                    "person_id":  item.get("person_id"),
                    "role":       item.get("role", ""),
                    "name":       item.get("name", item.get("person", "")),
                    "image":      item.get("image", ""),
                    "image_path": item.get("image_path", ""),
                    "embedding":  emb if isinstance(emb, list) else list(emb),
                })
            os.makedirs(EMBEDDINGS_FOLDER, exist_ok=True)
            with open(EMBEDDINGS_FILE, 'w') as f:
                json.dump(serializable, f, indent=2)
            print(f"[JSON] Embeddings file rewritten with canonical person_key format")
        except Exception as e:
            print(f"[WARNING] Could not rewrite embeddings JSON: {e}")


if __name__ == "__main__":
    main()
