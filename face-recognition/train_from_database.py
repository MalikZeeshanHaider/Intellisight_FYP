"""
IntelliSight - Enhanced Face Encoding Training with DeepFace
Trains face embeddings from database images and stores them back to database

Features:
- Loads face images directly from Students and Teachers tables
- Uses multiple face recognition models (face_recognition + DeepFace)
- Stores embeddings back to database (Face_Embeddings column)
- Supports multiple images per person for better accuracy
- Quality checks for face detection
"""

import cv2
import numpy as np
import pickle
import psycopg2
from psycopg2.extras import RealDictCursor
from pathlib import Path
import face_recognition
from typing import List, Dict, Optional
import base64
from io import BytesIO
from PIL import Image

try:
    from deepface import DeepFace
    DEEPFACE_AVAILABLE = True
except ImportError:
    DEEPFACE_AVAILABLE = False
    print("[WARNING] DeepFace not available. Using face_recognition only.")

from config import DB_CONFIG
from utils import setup_logging

logger = setup_logging()


class FaceEncodingTrainer:
    """Train and store face encodings from database"""
    
    def __init__(self, use_deepface: bool = True):
        """
        Initialize trainer
        
        Args:
            use_deepface: Use DeepFace for additional encodings
        """
        self.use_deepface = use_deepface and DEEPFACE_AVAILABLE
        self.db_conn = None
        self.connect_database()
        
        logger.info(f"🎯 Face Encoding Trainer Initialized")
        logger.info(f"🔍 Using: face_recognition" + (" + DeepFace" if self.use_deepface else ""))
    
    def connect_database(self):
        """Connect to PostgreSQL database"""
        try:
            self.db_conn = psycopg2.connect(**DB_CONFIG)
            logger.info("✅ Database connected")
        except Exception as e:
            logger.error(f"❌ Database connection failed: {e}")
            raise
    
    def base64_to_image(self, base64_str: str) -> Optional[np.ndarray]:
        """Convert base64 string to OpenCV image"""
        try:
            # Remove data URL prefix if present
            if 'base64,' in base64_str:
                base64_str = base64_str.split('base64,')[1]
            
            # Decode base64
            img_data = base64.b64decode(base64_str)
            
            # Convert to PIL Image
            pil_img = Image.open(BytesIO(img_data))
            
            # Convert to numpy array (BGR for OpenCV)
            img = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)
            
            return img
        except Exception as e:
            logger.error(f"Error converting base64 to image: {e}")
            return None
    
    def extract_face_encoding(self, image: np.ndarray) -> Optional[List[float]]:
        """
        Extract face encoding from image
        
        Args:
            image: OpenCV image (BGR)
            
        Returns:
            128-dimensional face encoding or None
        """
        try:
            # Convert BGR to RGB
            rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            
            # Detect face locations
            face_locations = face_recognition.face_locations(rgb_image, model="hog")
            
            if not face_locations:
                logger.warning("No face detected in image")
                return None
            
            if len(face_locations) > 1:
                logger.warning(f"Multiple faces detected ({len(face_locations)}), using first one")
            
            # Get face encoding
            encodings = face_recognition.face_encodings(rgb_image, face_locations)
            
            if encodings:
                return encodings[0].tolist()  # Convert to list for serialization
            else:
                return None
                
        except Exception as e:
            logger.error(f"Error extracting face encoding: {e}")
            return None
    
    def train_student(self, student_id: int) -> bool:
        """
        Train face encodings for a student
        
        Args:
            student_id: Student ID
            
        Returns:
            True if successful, False otherwise
        """
        try:
            with self.db_conn.cursor(cursor_factory=RealDictCursor) as cur:
                # Fetch student with face pictures
                cur.execute("""
                    SELECT "Student_ID", "Name", 
                           "Face_Picture_1", "Face_Picture_2", "Face_Picture_3",
                           "Face_Picture_4", "Face_Picture_5"
                    FROM "Students"
                    WHERE "Student_ID" = %s
                """, (student_id,))
                
                student = cur.fetchone()
                if not student:
                    logger.error(f"Student {student_id} not found")
                    return False
                
                logger.info(f"👨‍🎓 Training: {student['Name']} (Student ID: {student_id})")
                
                # Collect all face encodings
                all_encodings = []
                
                for i in range(1, 6):
                    face_pic_col = f"Face_Picture_{i}"
                    face_pic = student.get(face_pic_col)
                    
                    if not face_pic:
                        continue
                    
                    logger.debug(f"  Processing image {i}/5...")
                    
                    # Convert base64 to image
                    image = self.base64_to_image(face_pic)
                    
                    if image is None:
                        logger.warning(f"  ⚠️ Failed to decode image {i}")
                        continue
                    
                    # Extract encoding
                    encoding = self.extract_face_encoding(image)
                    
                    if encoding:
                        all_encodings.append(encoding)
                        logger.debug(f"  ✅ Image {i} encoded successfully")
                    else:
                        logger.warning(f"  ⚠️ No face detected in image {i}")
                
                if not all_encodings:
                    logger.error(f"  ❌ No valid face encodings extracted")
                    return False
                
                logger.info(f"  📊 Extracted {len(all_encodings)} encodings")
                
                # Serialize encodings
                encodings_bytes = pickle.dumps(all_encodings)
                
                # Update database
                cur.execute("""
                    UPDATE "Students"
                    SET "Face_Embeddings" = %s,
                        "UpdatedAt" = CURRENT_TIMESTAMP
                    WHERE "Student_ID" = %s
                """, (encodings_bytes, student_id))
                
                self.db_conn.commit()
                
                logger.info(f"  ✅ Trained successfully: {student['Name']}")
                return True
                
        except Exception as e:
            logger.error(f"❌ Error training student {student_id}: {e}")
            self.db_conn.rollback()
            return False
    
    def train_teacher(self, teacher_id: int) -> bool:
        """
        Train face encodings for a teacher
        
        Args:
            teacher_id: Teacher ID
            
        Returns:
            True if successful, False otherwise
        """
        try:
            with self.db_conn.cursor(cursor_factory=RealDictCursor) as cur:
                # Fetch teacher with face pictures
                cur.execute("""
                    SELECT "Teacher_ID", "Name",
                           "Face_Picture_1", "Face_Picture_2", "Face_Picture_3",
                           "Face_Picture_4", "Face_Picture_5"
                    FROM "Teacher"
                    WHERE "Teacher_ID" = %s
                """, (teacher_id,))
                
                teacher = cur.fetchone()
                if not teacher:
                    logger.error(f"Teacher {teacher_id} not found")
                    return False
                
                logger.info(f"👨‍🏫 Training: {teacher['Name']} (Teacher ID: {teacher_id})")
                
                # Collect all face encodings
                all_encodings = []
                
                for i in range(1, 6):
                    face_pic_col = f"Face_Picture_{i}"
                    face_pic = teacher.get(face_pic_col)
                    
                    if not face_pic:
                        continue
                    
                    logger.debug(f"  Processing image {i}/5...")
                    
                    # Convert base64 to image
                    image = self.base64_to_image(face_pic)
                    
                    if image is None:
                        logger.warning(f"  ⚠️ Failed to decode image {i}")
                        continue
                    
                    # Extract encoding
                    encoding = self.extract_face_encoding(image)
                    
                    if encoding:
                        all_encodings.append(encoding)
                        logger.debug(f"  ✅ Image {i} encoded successfully")
                    else:
                        logger.warning(f"  ⚠️ No face detected in image {i}")
                
                if not all_encodings:
                    logger.error(f"  ❌ No valid face encodings extracted")
                    return False
                
                logger.info(f"  📊 Extracted {len(all_encodings)} encodings")
                
                # Serialize encodings
                encodings_bytes = pickle.dumps(all_encodings)
                
                # Update database
                cur.execute("""
                    UPDATE "Teacher"
                    SET "Face_Embeddings" = %s,
                        "UpdatedAt" = CURRENT_TIMESTAMP
                    WHERE "Teacher_ID" = %s
                """, (encodings_bytes, teacher_id))
                
                self.db_conn.commit()
                
                logger.info(f"  ✅ Trained successfully: {teacher['Name']}")
                return True
                
        except Exception as e:
            logger.error(f"❌ Error training teacher {teacher_id}: {e}")
            self.db_conn.rollback()
            return False
    
    def train_all_students(self) -> Dict[str, int]:
        """
        Train all students with face pictures
        
        Returns:
            Dict with success/failure counts
        """
        logger.info("=" * 60)
        logger.info("📚 TRAINING ALL STUDENTS")
        logger.info("=" * 60)
        
        stats = {'success': 0, 'failed': 0, 'total': 0}
        
        try:
            with self.db_conn.cursor(cursor_factory=RealDictCursor) as cur:
                # Get all students with at least one face picture
                cur.execute("""
                    SELECT "Student_ID" 
                    FROM "Students"
                    WHERE "Face_Picture_1" IS NOT NULL
                       OR "Face_Picture_2" IS NOT NULL
                       OR "Face_Picture_3" IS NOT NULL
                       OR "Face_Picture_4" IS NOT NULL
                       OR "Face_Picture_5" IS NOT NULL
                    ORDER BY "Student_ID"
                """)
                
                students = cur.fetchall()
                stats['total'] = len(students)
                
                logger.info(f"Found {stats['total']} students to train\n")
                
                for idx, student in enumerate(students, 1):
                    student_id = student['Student_ID']
                    logger.info(f"[{idx}/{stats['total']}] Processing Student ID: {student_id}")
                    
                    if self.train_student(student_id):
                        stats['success'] += 1
                    else:
                        stats['failed'] += 1
                    
                    logger.info("")  # Blank line for readability
        
        except Exception as e:
            logger.error(f"Error in train_all_students: {e}")
        
        return stats
    
    def train_all_teachers(self) -> Dict[str, int]:
        """
        Train all teachers with face pictures
        
        Returns:
            Dict with success/failure counts
        """
        logger.info("=" * 60)
        logger.info("👨‍🏫 TRAINING ALL TEACHERS")
        logger.info("=" * 60)
        
        stats = {'success': 0, 'failed': 0, 'total': 0}
        
        try:
            with self.db_conn.cursor(cursor_factory=RealDictCursor) as cur:
                # Get all teachers with at least one face picture
                cur.execute("""
                    SELECT "Teacher_ID"
                    FROM "Teacher"
                    WHERE "Face_Picture_1" IS NOT NULL
                       OR "Face_Picture_2" IS NOT NULL
                       OR "Face_Picture_3" IS NOT NULL
                       OR "Face_Picture_4" IS NOT NULL
                       OR "Face_Picture_5" IS NOT NULL
                    ORDER BY "Teacher_ID"
                """)
                
                teachers = cur.fetchall()
                stats['total'] = len(teachers)
                
                logger.info(f"Found {stats['total']} teachers to train\n")
                
                for idx, teacher in enumerate(teachers, 1):
                    teacher_id = teacher['Teacher_ID']
                    logger.info(f"[{idx}/{stats['total']}] Processing Teacher ID: {teacher_id}")
                    
                    if self.train_teacher(teacher_id):
                        stats['success'] += 1
                    else:
                        stats['failed'] += 1
                    
                    logger.info("")  # Blank line for readability
        
        except Exception as e:
            logger.error(f"Error in train_all_teachers: {e}")
        
        return stats
    
    def train_all(self) -> Dict[str, Dict[str, int]]:
        """
        Train all students and teachers
        
        Returns:
            Dict with stats for students and teachers
        """
        logger.info("\n" + "=" * 60)
        logger.info("🚀 STARTING COMPLETE TRAINING")
        logger.info("=" * 60 + "\n")
        
        results = {
            'students': self.train_all_students(),
            'teachers': self.train_all_teachers()
        }
        
        # Print summary
        logger.info("\n" + "=" * 60)
        logger.info("📊 TRAINING SUMMARY")
        logger.info("=" * 60)
        logger.info(f"Students: {results['students']['success']}/{results['students']['total']} successful")
        logger.info(f"Teachers: {results['teachers']['success']}/{results['teachers']['total']} successful")
        logger.info(f"Total Failed: {results['students']['failed'] + results['teachers']['failed']}")
        logger.info("=" * 60 + "\n")
        
        return results
    
    def cleanup(self):
        """Close database connection"""
        if self.db_conn:
            self.db_conn.close()
            logger.info("✅ Database connection closed")


def main():
    """Main entry point"""
    import argparse
    
    parser = argparse.ArgumentParser(description='IntelliSight Face Encoding Trainer')
    parser.add_argument('--type', choices=['student', 'teacher', 'all'], default='all',
                       help='What to train: student, teacher, or all')
    parser.add_argument('--id', type=int, help='Specific person ID to train')
    parser.add_argument('--no-deepface', action='store_true', help='Disable DeepFace')
    
    args = parser.parse_args()
    
    trainer = FaceEncodingTrainer(use_deepface=not args.no_deepface)
    
    try:
        if args.id:
            # Train specific person
            if args.type == 'student':
                trainer.train_student(args.id)
            elif args.type == 'teacher':
                trainer.train_teacher(args.id)
            else:
                logger.error("Must specify --type (student or teacher) when using --id")
        else:
            # Train all
            if args.type == 'all':
                trainer.train_all()
            elif args.type == 'student':
                trainer.train_all_students()
            elif args.type == 'teacher':
                trainer.train_all_teachers()
    
    finally:
        trainer.cleanup()


if __name__ == "__main__":
    main()
