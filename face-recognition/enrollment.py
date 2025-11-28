"""
Face Enrollment Script
----------------------
Processes face images for students and teachers, generates embeddings,
and stores them in the database.

Usage:
    python enrollment.py --type student --id 1
    python enrollment.py --type teacher --id 2
    python enrollment.py --all  # Process all persons
"""

import face_recognition
import numpy as np
import base64
from io import BytesIO
from PIL import Image
import argparse
from database_handler import DatabaseHandler
import psycopg2
from psycopg2.extras import RealDictCursor

def decode_base64_image(base64_string):
    """Decode base64 image string to numpy array"""
    try:
        # Remove data:image prefix if present
        if ',' in base64_string:
            base64_string = base64_string.split(',')[1]
        
        image_bytes = base64.b64decode(base64_string)
        image = Image.open(BytesIO(image_bytes))
        return np.array(image)
    except Exception as e:
        print(f"[ERROR] decode_base64_image: {e}")
        return None

def generate_face_encodings(face_pictures):
    """
    Generate face encodings from multiple face pictures.
    Returns list of 128D encodings.
    """
    all_encodings = []
    
    for idx, picture in enumerate(face_pictures, 1):
        if not picture:
            continue
        
        print(f"  Processing picture {idx}...", end=" ")
        image = decode_base64_image(picture)
        
        if image is None:
            print("❌ Failed to decode")
            continue
        
        # Detect faces and generate encodings
        face_locations = face_recognition.face_locations(image)
        if not face_locations:
            print("❌ No face detected")
            continue
        
        encodings = face_recognition.face_encodings(image, face_locations)
        if not encodings:
            print("❌ No encoding generated")
            continue
        
        all_encodings.extend(encodings)
        print(f"✓ {len(encodings)} face(s) encoded")
    
    return all_encodings

def enroll_person(person_id, person_type, db_handler):
    """Enroll a single person (student or teacher)"""
    table = '"Teacher"' if person_type == 'Teacher' else '"Students"'
    id_field = '"Teacher_ID"' if person_type == 'Teacher' else '"Student_ID"'
    
    try:
        with db_handler.conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Fetch person data
            cur.execute(f"""
                SELECT {id_field}, "Name", 
                       "Face_Picture_1", "Face_Picture_2", "Face_Picture_3", 
                       "Face_Picture_4", "Face_Picture_5"
                FROM {table}
                WHERE {id_field} = %s
            """, (person_id,))
            
            person = cur.fetchone()
            if not person:
                print(f"[ERROR] {person_type} {person_id} not found")
                return False
            
            print(f"\n[ENROLLING] {person['Name']} ({person_type} {person_id})")
            
            # Collect face pictures
            face_pictures = [
                person.get('Face_Picture_1'),
                person.get('Face_Picture_2'),
                person.get('Face_Picture_3'),
                person.get('Face_Picture_4'),
                person.get('Face_Picture_5')
            ]
            
            # Generate encodings
            encodings = generate_face_encodings(face_pictures)
            
            if not encodings:
                print(f"[ERROR] No valid face encodings generated for {person['Name']}")
                return False
            
            print(f"[SUCCESS] Generated {len(encodings)} face encodings")
            
            # Save to database
            return db_handler.save_face_embeddings(person_id, person_type, encodings)
            
    except Exception as e:
        print(f"[ERROR] enroll_person: {e}")
        return False

def enroll_all(db_handler):
    """Enroll all students and teachers without embeddings"""
    enrolled_count = 0
    
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
        
        for student in students:
            if enroll_person(student['Student_ID'], 'Student', db_handler):
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
        
        for teacher in teachers:
            if enroll_person(teacher['Teacher_ID'], 'Teacher', db_handler):
                enrolled_count += 1
    
    print("\n" + "="*50)
    print(f"ENROLLMENT COMPLETE: {enrolled_count} person(s) enrolled")
    print("="*50)

def main():
    parser = argparse.ArgumentParser(description='Face Recognition Enrollment System')
    parser.add_argument('--type', choices=['student', 'teacher'], help='Person type to enroll')
    parser.add_argument('--id', type=int, help='Person ID to enroll')
    parser.add_argument('--all', action='store_true', help='Enroll all persons without embeddings')
    
    args = parser.parse_args()
    
    db_handler = DatabaseHandler()
    
    try:
        if args.all:
            enroll_all(db_handler)
        elif args.type and args.id:
            person_type = 'Teacher' if args.type == 'teacher' else 'Student'
            enroll_person(args.id, person_type, db_handler)
        else:
            parser.print_help()
    finally:
        db_handler.close()

if __name__ == "__main__":
    main()
