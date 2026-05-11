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
    Extract face embedding from an image, using the SAME pipeline as
    camera_streaming_service._get_raw_embedding and enrollment._extract_embedding.

    Canonical pipeline (do not diverge):
      1. Read raw BGR image from disk
      2. Run face detector on the RAW frame to get a tight crop
      3. CLAHE the crop (preprocess_face_crop) — NOT the full frame
      4. Resize the crop to 112×112 (ArcFace canonical input)
      5. DeepFace.represent(detector_backend='skip', align=False)

    Earlier this function applied CLAHE to the WHOLE frame first and then asked
    DeepFace to detect a face inside the CLAHE-enhanced image. That produced
    embeddings from a different image than the live recognition path (which
    detects on raw frames and CLAHEs only the crop), so enrolled embeddings
    drifted from query embeddings — the direct cause of "known users → Unknown".

    We now delegate to enrollment.py's helpers so all training paths
    (full enroll, incremental, folder-based train.py) share one implementation.
    """
    try:
        if not DEEPFACE_AVAILABLE:
            print("  [ERROR] DeepFace not available")
            return None

        image = cv2.imread(image_path)
        if image is None:
            print("  [ERROR] Cannot read image file")
            return None

        # Reuse the enrollment quality gate + crop extractor.  Returns the tight
        # BGR uint8 face crop and a rejection reason string ('' on success).
        from enrollment import score_enrollment_image, _extract_embedding

        score, face_crop, _conf, reject_reason, _metrics = score_enrollment_image(image)
        if reject_reason or face_crop is None:
            print(f"  [WARNING] image rejected: {reject_reason or 'no_crop'}")
            return None

        # Canonical embedding pipeline — CLAHE + resize 112×112 + ArcFace(skip)
        return _extract_embedding(face_crop)

    except Exception as e:
        print(f"  [ERROR] {str(e)[:80]}")
        return None


def save_embeddings(embeddings):
    """Save embeddings to JSON file"""
    os.makedirs(EMBEDDINGS_FOLDER, exist_ok=True)
    
    with open(EMBEDDINGS_FILE, 'w') as f:
        json.dump(embeddings, f, indent=2)


def _person_key_for(item):
    """Return the canonical person folder name for a JSON item, regardless of
    whether it was written by train_incremental ('person') or enrollment ('name')."""
    return item.get('person') or item.get('name') or ''


def main():
    print("\n" + "="*50)
    print("INCREMENTAL FACE TRAINING (per-person regeneration)")
    print("="*50)

    # Load existing embeddings from JSON
    existing_embeddings = load_existing_embeddings()
    trained_set         = get_trained_images(existing_embeddings)

    print(f"[INFO] Existing embeddings: {len(existing_embeddings)}")

    # Find images that aren't in the trained set
    new_images = find_new_images(trained_set)

    if len(new_images) == 0:
        print("[OK] No new images to train")
        print("="*50 + "\n")
        return

    # ── Per-person regeneration ────────────────────────────────────────────────
    # Earlier this script appended new embeddings to the JSON and re-synced the
    # whole list to FaceEmbeddings, so any person who had new images re-uploaded
    # (or renamed files, or re-trained multiple times) ended up with duplicate
    # rows.  One user accumulated 46 embeddings for 5 photos.
    #
    # New behaviour: if a person has ANY new image, we treat their entire image
    # folder as the source of truth and regenerate embeddings for ALL of their
    # on-disk images in one go.  The JSON entries for that person are dropped
    # first, so the result is exactly N embeddings per person where N = number
    # of valid images in their folder.
    persons_to_retrain = {img['person'] for img in new_images}
    print(f"[INFO] Persons needing re-training: {sorted(persons_to_retrain)}")

    # Keep JSON entries for persons NOT affected by this run
    kept_existing = [
        item for item in existing_embeddings
        if _person_key_for(item) not in persons_to_retrain
    ]
    dropped = len(existing_embeddings) - len(kept_existing)
    if dropped:
        print(f"[INFO] Dropped {dropped} stale entries for retrained persons")
    print("-"*50)

    # Re-train every on-disk image for each affected person
    new_embeddings = []
    for person in sorted(persons_to_retrain):
        person_dir = os.path.join(IMAGES_FOLDER, person)
        if not os.path.isdir(person_dir):
            continue

        image_files = [
            f for f in sorted(os.listdir(person_dir))
            if f.lower().endswith(('.jpg', '.jpeg', '.png'))
        ]
        for image_file in image_files:
            image_path = os.path.join(person_dir, image_file)
            print(f"Training: {person}/{image_file}", end=" ")
            embedding = extract_face_embedding(image_path)
            if embedding is not None:
                new_embeddings.append({
                    'person':     person,
                    'image':      image_file,
                    'image_path': image_path,
                    'embedding':  embedding,
                })
                print("[OK]")
            else:
                print("[SKIP]")

    if len(new_embeddings) == 0:
        print("[WARN] No embeddings generated (all images failed quality gates)")
        print("="*50 + "\n")
        return

    all_embeddings = kept_existing + new_embeddings
    save_embeddings(all_embeddings)

    print("-"*50)
    print(f"[OK] Regenerated {len(new_embeddings)} embedding(s) "
          f"for {len(persons_to_retrain)} person(s)")
    print(f"[OK] Total embeddings in JSON: {len(all_embeddings)}")

    sync_embeddings_to_database(all_embeddings)
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
