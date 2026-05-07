"""
IntelliSight - Face Enrollment Script using DeepFace (FaceNet)
Processes face images for students and teachers, generates embeddings,
and stores them in the database.

Usage:
    python enrollment.py --type student --id 1
    python enrollment.py --type teacher --id 2
    python enrollment.py --all  # Process all persons
    python enrollment.py --train  # Train from images folder
"""

import os
import gc
import json
import argparse
import base64
from io import BytesIO
from PIL import Image
import cv2
import numpy as np

from deepface import DeepFace
from database_handler import DatabaseHandler
from config import (
    MODEL_NAME, DETECTOR_BACKEND, 
    IMAGES_FOLDER, EMBEDDINGS_FOLDER, EMBEDDINGS_FILE
)
from utils import (
    setup_logging, decode_base64_image, save_base64_image,
    save_embeddings_to_json, create_person_folder, preprocess_face_crop
)

logger = setup_logging()


def _detect_and_crop_face(image):
    """
    Detect the largest face in *image* and return a tight BGR uint8 crop.
    Falls back to the original image if no face is found so that enrollment
    never fails silently on a good-quality face photo.

    Matches the pipeline used in recognition_live.py:
      • align=False  (same as _recognize_face in camera_streaming_service.py)
      • BGR uint8 output (DeepFace ≥0.0.79 returns float RGB — converted here)
    """
    try:
        faces = DeepFace.extract_faces(
            img_path=image,
            detector_backend=DETECTOR_BACKEND,
            enforce_detection=False,
            align=False,          # must match recognition
        )
        if faces:
            # Pick the highest-confidence face
            best = max(faces, key=lambda f: f.get('confidence', 0))
            face_arr = best.get('face')
            if face_arr is not None and face_arr.size > 0:
                # DeepFace ≥0.0.79 returns float32 [0-1] RGB
                if face_arr.dtype != np.uint8:
                    face_arr = (face_arr * 255).clip(0, 255).astype(np.uint8)
                    face_arr = cv2.cvtColor(face_arr, cv2.COLOR_RGB2BGR)
                h, w = face_arr.shape[:2]
                if h >= 20 and w >= 20:   # discard tiny artefacts
                    return face_arr
    except Exception:
        pass
    return image   # fallback: use the original image


def generate_embedding_from_base64(base64_string):
    """
    Generate FaceNet embedding from base64 image using DeepFace.

    Pipeline (matches recognition_live.py exactly):
      1. Decode base64 → BGR uint8
      2. Detect + crop the face  ← KEY: same crop domain as live recognition
      3. CLAHE contrast enhancement
      4. Resize to 160×160
      5. DeepFace.represent(skip, align=False) → 128-D embedding
    """
    try:
        image = decode_base64_image(base64_string)
        if image is None:
            return None

        # Step 2: detect + crop — produces the same tight face region
        # that recognition will embed from the live camera frame.
        image = _detect_and_crop_face(image)

        # Steps 3-4: CLAHE + resize (same as recognition pipeline)
        image = preprocess_face_crop(image)
        image = cv2.resize(image, (160, 160), interpolation=cv2.INTER_LINEAR)

        result = DeepFace.represent(
            img_path=image,
            model_name=MODEL_NAME,
            detector_backend='skip',
            enforce_detection=False,
            align=False,
        )

        if result and len(result) > 0:
            return result[0]["embedding"]
        return None

    except Exception as e:
        logger.error(f"Error generating embedding: {e}")
        return None


def generate_embeddings_from_images(image_paths):
    """
    Generate FaceNet embeddings from multiple images
    
    Args:
        image_paths: List of image file paths
        
    Returns:
        list: List of embeddings
    """
    embeddings = []
    
    for idx, path in enumerate(image_paths):
        if not os.path.exists(path):
            continue
            
        try:
            print(f"  Processing image {idx + 1}/{len(image_paths)}...", end=" ")

            image = cv2.imread(path)
            if image is None:
                print("✗ Cannot read image file")
                continue
            image = _detect_and_crop_face(image)
            image = preprocess_face_crop(image)
            image = cv2.resize(image, (160, 160), interpolation=cv2.INTER_LINEAR)

            result = DeepFace.represent(
                img_path=image,
                model_name=MODEL_NAME,
                detector_backend='skip',
                enforce_detection=False,
                align=False,
            )
            
            if result and len(result) > 0:
                embeddings.append(result[0]["embedding"])
                print("✓")
            else:
                print("✗ No face detected")
                
        except Exception as e:
            print(f"✗ Error: {str(e)[:50]}")
            
        # Memory cleanup
        if (idx + 1) % 5 == 0:
            gc.collect()
    
    return embeddings


def enroll_person_from_database(person_id, person_type, db_handler):
    """
    Enroll a single person using images from database
    
    Args:
        person_id: Person's database ID
        person_type: 'Student' or 'Teacher'
        db_handler: DatabaseHandler instance
        
    Returns:
        bool: Success status
    """
    # Get person's images from database
    person_data = db_handler.get_person_images(person_id, person_type)
    if not person_data:
        print(f"[ERROR] {person_type} {person_id} not found")
        return False
    
    print(f"\n[ENROLLING] {person_data['Name']} ({person_type} {person_id})")
    
    # Collect face pictures
    face_pictures = []
    for i in range(1, 6):
        pic = person_data.get(f'Face_Picture_{i}')
        if pic:
            face_pictures.append(pic)
    
    if not face_pictures:
        print(f"[ERROR] No face pictures found for {person_data['Name']}")
        return False
    
    # Generate embeddings from base64 images
    embeddings = []
    for idx, pic in enumerate(face_pictures, 1):
        print(f"  Processing picture {idx}...", end=" ")
        embedding = generate_embedding_from_base64(pic)
        if embedding:
            embeddings.append(embedding)
            print("✓")
        else:
            print("✗ No face detected or error")
    
    if not embeddings:
        print(f"[ERROR] No valid embeddings generated for {person_data['Name']}")
        return False

    print(f"[SUCCESS] Generated {len(embeddings)} embeddings")

    # Save to database — pass person_name so save_face_embeddings can build
    # the canonical person_key and write it to the FaceEmbeddings table.
    return db_handler.save_face_embeddings(person_id, person_type, embeddings, person_name=person_data['Name'])


def enroll_all_from_database(db_handler):
    """
    Enroll all students and teachers without embeddings
    """
    enrolled_count = 0
    
    from psycopg2.extras import RealDictCursor
    
    # Students
    print("\n" + "="*50)
    print("ENROLLING STUDENTS")
    print("="*50)
    
    with db_handler.conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute("""
            SELECT "Student_ID" 
            FROM "Students" 
            WHERE "Face_Embeddings" IS NULL 
            AND ("Face_Picture_1" IS NOT NULL OR "Face_Picture_2" IS NOT NULL 
                 OR "Face_Picture_3" IS NOT NULL OR "Face_Picture_4" IS NOT NULL 
                 OR "Face_Picture_5" IS NOT NULL)
        """)
        students = cur.fetchall()
        
        print(f"Found {len(students)} students to enroll")
        for student in students:
            if enroll_person_from_database(student['Student_ID'], 'Student', db_handler):
                enrolled_count += 1
    
    # Teachers
    print("\n" + "="*50)
    print("ENROLLING TEACHERS")
    print("="*50)
    
    with db_handler.conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute("""
            SELECT "Teacher_ID" 
            FROM "Teacher" 
            WHERE "Face_Embeddings" IS NULL 
            AND ("Face_Picture_1" IS NOT NULL OR "Face_Picture_2" IS NOT NULL 
                 OR "Face_Picture_3" IS NOT NULL OR "Face_Picture_4" IS NOT NULL 
                 OR "Face_Picture_5" IS NOT NULL)
        """)
        teachers = cur.fetchall()
        
        print(f"Found {len(teachers)} teachers to enroll")
        for teacher in teachers:
            if enroll_person_from_database(teacher['Teacher_ID'], 'Teacher', db_handler):
                enrolled_count += 1
    
    print("\n" + "="*50)
    print(f"ENROLLMENT COMPLETE: {enrolled_count} person(s) enrolled")
    print("="*50)


def train_from_images_folder():
    """
    Train embeddings from images in the images folder
    This is the main training function using the new algorithm
    """
    print("\n" + "="*60)
    print("FACE RECOGNITION TRAINING - DeepFace FaceNet Model")
    print("="*60 + "\n")
    
    # Validate images folder
    if not os.path.exists(IMAGES_FOLDER):
        print(f"✗ ERROR: '{IMAGES_FOLDER}' folder not found!")
        return False
    
    # Get person folders
    person_folders = [f for f in os.listdir(IMAGES_FOLDER) 
                      if os.path.isdir(os.path.join(IMAGES_FOLDER, f))]
    
    if not person_folders:
        print(f"✗ ERROR: No person folders found in '{IMAGES_FOLDER}'!")
        return False
    
    print(f"✓ Found {len(person_folders)} person folder(s)")
    
    # Count and display images
    print("\n" + "-"*40)
    print("DATASET OVERVIEW")
    print("-"*40)
    
    total_images = 0
    for person_name in person_folders:
        person_path = os.path.join(IMAGES_FOLDER, person_name)
        images = [f for f in os.listdir(person_path) 
                 if f.lower().endswith(('.jpg', '.jpeg', '.png'))]
        total_images += len(images)
        print(f"  {person_name}: {len(images)} image(s)")
    
    print(f"\n  Total: {total_images} images")
    print("-"*40 + "\n")
    
    if total_images == 0:
        print("✗ No images found!")
        return False
    
    # Generate embeddings
    print("Starting embedding generation with FaceNet model...\n")
    
    embeddings_data = []
    processed_count = 0
    error_count = 0
    
    for person_name in person_folders:
        person_path = os.path.join(IMAGES_FOLDER, person_name)
        print(f"Processing: {person_name}")
        
        for image_file in os.listdir(person_path):
            if not image_file.lower().endswith(('.jpg', '.jpeg', '.png')):
                continue
            
            image_path = os.path.join(person_path, image_file)
            
            try:
                image = cv2.imread(image_path)
                if image is None:
                    print(f"  ✗ {image_file} - Cannot read image file")
                    error_count += 1
                    continue
                image = _detect_and_crop_face(image)
                image = preprocess_face_crop(image)
                image = cv2.resize(image, (160, 160), interpolation=cv2.INTER_LINEAR)

                result = DeepFace.represent(
                    img_path=image,
                    model_name=MODEL_NAME,
                    detector_backend='skip',
                    enforce_detection=False,
                    align=False,
                )

                if result and len(result) > 0:
                    embedding = result[0]["embedding"]

                    embeddings_data.append({
                        "person": person_name,
                        "image": image_file,
                        "embedding": embedding,
                        "image_path": image_path
                    })

                    processed_count += 1
                    print(f"  ✓ {image_file}")

                    del result, embedding
                else:
                    print(f"  ✗ {image_file} - No face detected")
                    error_count += 1

            except Exception as e:
                print(f"  ✗ {image_file} - Error: {str(e)[:50]}")
                error_count += 1
            
            if processed_count % 5 == 0:
                gc.collect()
        
        print()
    
    # Save embeddings then sync to DB so explicit person_id/role/name fields
    # are written into the JSON file (same as train.py does).
    if embeddings_data:
        save_embeddings_to_json(embeddings_data, EMBEDDINGS_FILE)

        # Enrich JSON with explicit identity fields via DB sync
        try:
            from train import sync_embeddings_to_database
            synced, unlinked = sync_embeddings_to_database(embeddings_data)
        except Exception as e:
            print(f"[WARNING] Could not sync embeddings to database: {e}")
            synced, unlinked = 0, len(embeddings_data)

        print("\n" + "="*60)
        print("TRAINING COMPLETE")
        print("="*60)
        print(f"  Total images processed: {processed_count}")
        print(f"  Failed images: {error_count}")
        print(f"  Embeddings saved: {len(embeddings_data)}")
        print(f"  Synced to DB: {synced} | Unlinked: {unlinked}")
        print(f"  Output file: {EMBEDDINGS_FILE}")
        print("="*60 + "\n")

        gc.collect()
        return True
    else:
        print("\n✗ ERROR: No embeddings generated.")
        gc.collect()
        return False


def main():
    parser = argparse.ArgumentParser(description='Face Recognition Enrollment - DeepFace FaceNet')
    parser.add_argument('--type', choices=['student', 'teacher'], help='Person type to enroll')
    parser.add_argument('--id', type=int, help='Person ID to enroll')
    parser.add_argument('--all', action='store_true', help='Enroll all persons from database')
    parser.add_argument('--train', action='store_true', help='Train from images folder')
    
    args = parser.parse_args()
    
    if args.train:
        # Train from images folder (new algorithm)
        train_from_images_folder()
    else:
        # Enroll from database
        db_handler = DatabaseHandler()
        
        try:
            if args.all:
                enroll_all_from_database(db_handler)
            elif args.type and args.id:
                person_type = 'Teacher' if args.type == 'teacher' else 'Student'
                enroll_person_from_database(args.id, person_type, db_handler)
            else:
                parser.print_help()
        finally:
            db_handler.close()


if __name__ == "__main__":
    main()
