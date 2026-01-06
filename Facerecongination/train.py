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
import psycopg2
from psycopg2.extras import RealDictCursor
from deepface import DeepFace
import numpy as np

# Fix Windows console encoding
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

# Import configuration
try:
    from config import IMAGES_FOLDER, EMBEDDINGS_FOLDER, EMBEDDINGS_FILE, MODEL_NAME, DETECTOR_BACKEND, DB_CONFIG
except ImportError:
    # Fallback to defaults if config not available
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    IMAGES_FOLDER = os.path.join(BASE_DIR, "images")
    EMBEDDINGS_FOLDER = os.path.join(BASE_DIR, "embeddings")
    EMBEDDINGS_FILE = os.path.join(EMBEDDINGS_FOLDER, "representations_facenet.json")
    MODEL_NAME = "Facenet"
    DETECTOR_BACKEND = "retinaface"
    DB_CONFIG = {
        'host': 'localhost',
        'port': 5432,
        'database': 'FYP_Intellisight',
        'user': 'postgres',
        'password': 'zeeshan'
    }


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
                # TODO: Generate embedding using DeepFace with FaceNet model
                # Use opencv detector for better stability
                # enforce_detection=True ensures only clear faces are processed
                # align=True improves accuracy by aligning face geometry
                embedding_objs = DeepFace.represent(
                    img_path=image_path,
                    model_name=MODEL_NAME,
                    detector_backend="opencv",  # More stable detector
                    enforce_detection=False,  # Allow processing even if face detection is uncertain
                    align=True  # Align faces for better accuracy
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
    Sync embeddings to the PostgreSQL database FaceEmbeddings table.
    Links embeddings to Students or Teachers based on folder name matching.
    """
    print("\n" + "="*60)
    print("SYNCING EMBEDDINGS TO DATABASE")
    print("="*60 + "\n")
    
    conn = None
    synced_count = 0
    skipped_count = 0
    
    try:
        # Connect to database
        conn = psycopg2.connect(**DB_CONFIG)
        print("[DB] Connected successfully")
        
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # First, clear old embeddings
            cur.execute('DELETE FROM "FaceEmbeddings"')
            print("[DB] Cleared old embeddings from database")
            
            # Get all students and teachers for matching
            cur.execute('SELECT "Student_ID", "Name" FROM "Students"')
            students = {row['Name'].lower().strip(): row for row in cur.fetchall() if row['Name']}
            
            cur.execute('SELECT "Teacher_ID", "Name" FROM "Teacher"')
            teachers = {row['Name'].lower().strip(): row for row in cur.fetchall() if row['Name']}
            
            print(f"[DB] Found {len(students)} students and {len(teachers)} teachers in database")
            
            # Process each embedding
            for item in embeddings_data:
                person_name = item["person"]
                person_name_lower = person_name.lower().strip()
                embedding = item["embedding"]
                image_path = item.get("image_path", "")
                
                # Convert embedding to JSON string
                embedding_list = embedding if isinstance(embedding, list) else embedding.tolist()
                embedding_json = json.dumps(embedding_list)
                embedding_bytes = bytes(json.dumps(embedding_list), 'utf-8')
                
                # Try to match with student
                student = None
                teacher = None
                person_type = None
                person_id = None
                
                # Check exact match first
                if person_name_lower in students:
                    student = students[person_name_lower]
                    person_type = "Student"
                    person_id = student['Student_ID']
                elif person_name_lower in teachers:
                    teacher = teachers[person_name_lower]
                    person_type = "Teacher"
                    person_id = teacher['Teacher_ID']
                else:
                    # Try partial matching
                    for name, s in students.items():
                        if person_name_lower in name or name in person_name_lower:
                            student = s
                            person_type = "Student"
                            person_id = s['Student_ID']
                            break
                    
                    if not student:
                        for name, t in teachers.items():
                            if person_name_lower in name or name in person_name_lower:
                                teacher = t
                                person_type = "Teacher"
                                person_id = t['Teacher_ID']
                                break
                
                if person_type:
                    # Insert into FaceEmbeddings table
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
                    print(f"  [SYNCED] {person_name} -> {person_type} (ID: {person_id})")
                else:
                    # Insert without linking to student/teacher
                    cur.execute("""
                        INSERT INTO "FaceEmbeddings" 
                        ("PersonType", "PersonName", "ImagePath", "Embedding", "EmbeddingJson", "CreatedAt", "UpdatedAt")
                        VALUES (%s, %s, %s, %s, %s, NOW(), NOW())
                    """, ("Unknown", person_name, image_path, embedding_bytes, embedding_json))
                    skipped_count += 1
                    print(f"  [UNLINKED] {person_name} - No matching student/teacher found in DB")
            
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
    
    return synced_count, skipped_count


def main():
    """
    TODO: Main function to orchestrate the training process
    """
    print("\n" + "="*60)
    print("FACE RECOGNITION TRAINING - FaceNet Model")
    print("="*60 + "\n")
    
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
