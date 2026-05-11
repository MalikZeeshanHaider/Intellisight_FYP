"""
Face Recognition Attendance System - Training Module
This script generates FaceNet embeddings from images in the images/ folder
Uses DeepFace library with FaceNet model for high-accuracy face recognition
Syncs embeddings to the PostgreSQL database
"""

import os
import gc
import json
import sys
import cv2
import psycopg2
from psycopg2.extras import RealDictCursor
from deepface import DeepFace

# Fix Windows console encoding
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

# Import configuration — fail loudly if config or required env vars are missing
try:
    from config import IMAGES_FOLDER, EMBEDDINGS_FOLDER, EMBEDDINGS_FILE, MODEL_NAME, DETECTOR_BACKEND, DB_CONFIG
except (ImportError, RuntimeError) as e:
    print(f"[FATAL] Could not load config: {e}")
    print("[FATAL] Ensure config.py exists and all required environment variables are set in .env")
    sys.exit(1)

from utils import build_person_key, preprocess_face_crop


def create_folders():
    """
    TODO: Create project folders if they don't exist
    This ensures the embeddings folder is ready for storing data
    """
    if not os.path.exists(EMBEDDINGS_FOLDER):
        os.makedirs(EMBEDDINGS_FOLDER)
        print(f"[OK] Created folder: {EMBEDDINGS_FOLDER}")
    else:
        print(f"[OK] Folder already exists: {EMBEDDINGS_FOLDER}")


def validate_images_folder():
    """
    TODO: Check if images folder exists and contains person folders
    Returns True if valid, False otherwise
    """
    if not os.path.exists(IMAGES_FOLDER):
        print(f"[ERROR] '{IMAGES_FOLDER}' folder not found!")
        print(f"  Please create the folder and add subfolders with person names.")
        return False
    
    # TODO: Check if there are person folders inside images/
    person_folders = [f for f in os.listdir(IMAGES_FOLDER) 
                      if os.path.isdir(os.path.join(IMAGES_FOLDER, f))]
    
    if len(person_folders) == 0:
        print(f"[ERROR] No person folders found in '{IMAGES_FOLDER}'!")
        print(f"  Please create subfolders like: images/Moiz/, images/Ali/")
        return False
    
    print(f"[OK] Found {len(person_folders)} person folder(s): {', '.join(person_folders)}")
    return True


def count_images():
    """
    TODO: Count total images for each person
    Provides feedback on dataset size
    """
    print("\n" + "="*60)
    print("DATASET OVERVIEW")
    print("="*60)
    
    total_images = 0
    
    # TODO: Scan each person folder and count images
    for person_name in os.listdir(IMAGES_FOLDER):
        person_path = os.path.join(IMAGES_FOLDER, person_name)
        
        if os.path.isdir(person_path):
            # TODO: Count image files (jpg, jpeg, png)
            images = [f for f in os.listdir(person_path) 
                     if f.lower().endswith(('.jpg', '.jpeg', '.png'))]
            total_images += len(images)
            print(f"  {person_name}: {len(images)} image(s)")
    
    print(f"\n  Total images: {total_images}")
    print("="*60 + "\n")
    
    return total_images


def generate_embeddings():
    """
    TODO: Generate FaceNet embeddings for all images using DeepFace
    This is the core training function that processes all faces
    """
    print("Starting embedding generation with FaceNet model...\n")
    
    embeddings_data = []
    processed_count = 0
    error_count = 0
    
    # TODO: Loop through each person folder in images/
    for person_name in os.listdir(IMAGES_FOLDER):
        person_path = os.path.join(IMAGES_FOLDER, person_name)
        
        if not os.path.isdir(person_path):
            continue
        
        print(f"Processing: {person_name}")
        
        # TODO: Process each image in the person's folder
        for image_file in os.listdir(person_path):
            if not image_file.lower().endswith(('.jpg', '.jpeg', '.png')):
                continue
            
            image_path = os.path.join(person_path, image_file)
            
            try:
                # Read image and apply the EXACT pipeline used during recognition.
                # Pipeline must match _get_raw_embedding in camera_streaming_service.py
                # and _extract_embedding in enrollment.py:
                #   detect+crop → preprocess_face_crop (CLAHE) → resize 112×112 → represent(skip)
                #
                # 112×112 is ArcFace's canonical input size.  Previously this code
                # resized to 160×160 which forced DeepFace to internally rescale to
                # 112×112 with a different interpolation, producing embeddings in a
                # subtly different feature space than the live recognition path —
                # a direct cause of "known users → Unknown".
                #
                # detector_backend='skip' embeds the image as-is without re-running a
                # face detector. This is critical: the recognition path already has the
                # face crop extracted by yunet; asking yunet to re-detect inside the crop
                # often fails (tight crop, low confidence) and produces an unaligned
                # embedding. Using 'skip' in both training and recognition ensures they
                # occupy the same embedding space.
                image = cv2.imread(image_path)
                if image is None:
                    print(f"  [FAIL] {image_file} - Cannot read image file")
                    error_count += 1
                    continue

                # Detect + crop the face (same as enrollment.py and recognition pipeline)
                from enrollment import _detect_and_crop_face
                image = _detect_and_crop_face(image)
                image = preprocess_face_crop(image)
                image = cv2.resize(image, (112, 112), interpolation=cv2.INTER_LINEAR)

                embedding_objs = DeepFace.represent(
                    img_path=image,
                    model_name=MODEL_NAME,
                    detector_backend='skip',
                    enforce_detection=False,
                    align=False,
                )
                
                # TODO: DeepFace.represent returns a list, get the first face
                if len(embedding_objs) > 0:
                    embedding = embedding_objs[0]["embedding"]
                    
                    # TODO: Store embedding with metadata
                    embeddings_data.append({
                        "person": person_name,
                        "image": image_file,
                        "embedding": embedding,
                        "image_path": image_path
                    })
                    
                    processed_count += 1
                    print(f"  [OK] {image_file}")
                    
                    # TODO: Clean up large objects to prevent memory buildup
                    del embedding_objs, embedding
                else:
                    print(f"  [FAIL] {image_file} - No face detected")
                    error_count += 1
                    
            except Exception as e:
                # TODO: Handle errors gracefully and continue processing
                print(f"  [FAIL] {image_file} - Error: {str(e)}")
                error_count += 1
            
            # TODO: Periodic garbage collection during training
            if processed_count % 5 == 0:
                gc.collect()
        
        print()  # Empty line after each person
    
    return embeddings_data, processed_count, error_count


def save_embeddings(embeddings_data):
    """
    TODO: Save embeddings to JSON file in embeddings/ folder
    Converts numpy arrays to lists for JSON serialization
    """
    # TODO: Convert numpy arrays to lists for JSON compatibility
    serializable_data = []
    for item in embeddings_data:
        serializable_item = {
            "person": item["person"],
            "image": item["image"],
            "image_path": item["image_path"],
            "embedding": item["embedding"] if isinstance(item["embedding"], list) 
                        else item["embedding"].tolist()
        }
        serializable_data.append(serializable_item)
    
    # TODO: Write to JSON file
    with open(EMBEDDINGS_FILE, 'w') as f:
        json.dump(serializable_data, f, indent=2)
    
    print(f"[OK] Embeddings saved to: {EMBEDDINGS_FILE}")


def sync_embeddings_to_database(embeddings_data):
    """
    Sync embeddings to the FaceEmbeddings table and rewrite the JSON file.

    After matching each embedding's folder name to a real Student/Teacher row,
    this function:
      1. Inserts the embedding into the FaceEmbeddings table with person_id, type, name.
      2. Enriches each item in embeddings_data in-place with the canonical fields
         (person_key, person_id, role, name) so the JSON file becomes the authoritative
         source of truth for future recognition runs — even without a DB connection.

    Returns:
        (synced_count, skipped_count)
    """
    print("\n" + "="*60)
    print("SYNCING EMBEDDINGS TO DATABASE")
    print("="*60 + "\n")

    conn = None
    synced_count   = 0
    skipped_count  = 0

    try:
        conn = psycopg2.connect(**DB_CONFIG)
        print("[DB] Connected successfully")

        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Clear old embeddings so the table stays in sync with the JSON file
            cur.execute('DELETE FROM "FaceEmbeddings"')
            print("[DB] Cleared old embeddings from FaceEmbeddings table")

            # Build lookup maps: lowercase name → DB row
            cur.execute('SELECT "Student_ID", "Name" FROM "Students"')
            students = {row['Name'].lower().strip(): row for row in cur.fetchall() if row['Name']}

            cur.execute('SELECT "Teacher_ID", "Name" FROM "Teacher"')
            teachers = {row['Name'].lower().strip(): row for row in cur.fetchall() if row['Name']}

            print(f"[DB] Found {len(students)} students and {len(teachers)} teachers in database")

            for item in embeddings_data:
                # folder_person is whatever folder name was used (e.g. "Ali_Khan", "ali khan")
                folder_person      = item.get("person", "")
                folder_person_norm = folder_person.lower().strip().replace("_", " ")
                embedding          = item["embedding"]
                image_path         = item.get("image_path", "")

                embedding_list  = embedding if isinstance(embedding, list) else list(embedding)
                embedding_json  = json.dumps(embedding_list)
                embedding_bytes = embedding_json.encode('utf-8')

                person_type = None
                person_id   = None
                db_name     = None   # exact name as stored in DB

                # ── Exact match (normalise underscores → spaces for comparison) ──
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
                    # ── Partial / substring match ─────────────────────────────
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

                    # ── Insert into FaceEmbeddings table ──────────────────────
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

                    # ── Enrich the in-memory item (will be rewritten to JSON) ─
                    item["person_key"] = person_key
                    item["person_id"]  = person_id
                    item["role"]       = role
                    item["name"]       = db_name

                    synced_count += 1
                    print(f"  [SYNCED]   {folder_person!r} → {person_key}")
                else:
                    # No DB match — keep as unlinked but still store in table
                    cur.execute("""
                        INSERT INTO "FaceEmbeddings"
                            ("PersonType", "PersonName", "ImagePath",
                             "Embedding", "EmbeddingJson", "CreatedAt", "UpdatedAt")
                        VALUES (%s, %s, %s, %s, %s, NOW(), NOW())
                    """, ("Unknown", folder_person, image_path,
                          embedding_bytes, embedding_json))
                    skipped_count += 1
                    print(f"  [UNLINKED] {folder_person!r} — no matching student/teacher found in DB")

            conn.commit()
            print(f"\n[DB] Sync complete: {synced_count} synced, {skipped_count} unlinked")

    except Exception as e:
        if conn:
            conn.rollback()
        print(f"[DB ERROR] Failed to sync embeddings: {e}")
        import traceback
        traceback.print_exc()
    finally:
        if conn:
            conn.close()
            print("[DB] Connection closed")

    # ── Rewrite JSON file with enriched (person_key) data ────────────────────
    # Do this even if some items are unlinked — the linked ones now carry full
    # identity info so the JSON fallback path works correctly.
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
            with open(EMBEDDINGS_FILE, 'w') as f:
                json.dump(serializable, f, indent=2)
            print(f"[JSON] Embeddings file rewritten with canonical person_key format")
        except Exception as e:
            print(f"[WARNING] Could not rewrite embeddings JSON: {e}")

    return synced_count, skipped_count


def main():
    """
    TODO: Main function to orchestrate the training process
    """
    print("\n" + "="*60)
    print("FACE RECOGNITION TRAINING - FaceNet Model")
    print("="*60 + "\n")

    # Always start with a clean slate so stale embeddings from a previous
    # (possibly inconsistent) run are never mixed with the new ones.
    # The DB table is purged inside sync_embeddings_to_database(); the JSON
    # file is purged here so a partial failure cannot leave an old file behind.
    if os.path.exists(EMBEDDINGS_FILE):
        os.remove(EMBEDDINGS_FILE)
        print(f"[REBUILD] Cleared old embeddings file: {EMBEDDINGS_FILE}")

    # TODO: Step 1 - Create necessary folders
    create_folders()
    
    # TODO: Step 2 - Validate images folder exists
    if not validate_images_folder():
        return
    
    # TODO: Step 3 - Count and display dataset information
    total_images = count_images()
    
    if total_images == 0:
        print("[ERROR] No images found! Please add images to train the system.")
        return
    
    # TODO: Step 4 - Generate embeddings using FaceNet
    embeddings_data, processed_count, error_count = generate_embeddings()
    
    # TODO: Step 5 - Save embeddings to file
    if len(embeddings_data) > 0:
        save_embeddings(embeddings_data)
        
        # TODO: Step 6 - Sync embeddings to database
        synced, unlinked = sync_embeddings_to_database(embeddings_data)
        
        # TODO: Print summary
        print("\n" + "="*60)
        print("TRAINING COMPLETE")
        print("="*60)
        print(f"  Total images processed: {processed_count}")
        print(f"  Failed images: {error_count}")
        print(f"  Embeddings saved to file: {len(embeddings_data)}")
        print(f"  Embeddings synced to DB: {synced}")
        print(f"  Embeddings unlinked: {unlinked}")
        print("="*60 + "\n")
        print("[OK] You can now run recognize.py for real-time recognition!")
        
        # TODO: Final memory cleanup
        gc.collect()
    else:
        print("\n[ERROR] No embeddings generated. Please check your images.")
        gc.collect()


# TODO: Run the training process when script is executed
if __name__ == "__main__":
    main()
