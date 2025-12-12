"""
IntelliSight - Database Handler for DeepFace Face Recognition
Handles all database operations for the face recognition system
"""

import psycopg2
from psycopg2.extras import RealDictCursor
import pickle
import json
import numpy as np
from datetime import datetime
from config import DB_CONFIG, UNIDENTIFIED_SAVE_PATH, EMBEDDINGS_FILE

class DatabaseHandler:
    def __init__(self):
        self.conn = None
        self.connect()

    def connect(self):
        """Connect to PostgreSQL database"""
        try:
            self.conn = psycopg2.connect(**DB_CONFIG)
            print("[DB] Connected successfully")
        except Exception as e:
            print(f"[DB ERROR] Connection failed: {e}")
            raise

    def close(self):
        """Close database connection"""
        if self.conn:
            self.conn.close()
            print("[DB] Connection closed")

    def fetch_all_persons(self):
        """
        Fetch all students and teachers with face embeddings.
        Returns dict: {
            person_key: {
                'id': int,
                'name': str,
                'type': 'Student' or 'Teacher',
                'embedding': list (FaceNet 128D embedding)
            }
        }
        """
        persons = {}
        
        # Try to load from JSON embeddings file first (DeepFace format)
        try:
            with open(EMBEDDINGS_FILE, 'r') as f:
                embeddings_data = json.load(f)
                for item in embeddings_data:
                    person_key = item['person'].lower()
                    if person_key not in persons:
                        persons[person_key] = {
                            'name': item['person'],
                            'type': 'Unknown',  # Will be determined later
                            'embeddings': []
                        }
                    persons[person_key]['embeddings'].append(item['embedding'])
                print(f"[DB] Loaded {len(persons)} persons from embeddings file")
                return persons
        except FileNotFoundError:
            print("[DB] No embeddings file found, loading from database")
        except Exception as e:
            print(f"[DB WARNING] Error loading embeddings file: {e}")

        # Fall back to database embeddings (pickle format from old system)
        with self.conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Fetch students with embeddings
            cur.execute("""
                SELECT "Student_ID", "Name", "Face_Embeddings" 
                FROM "Students" 
                WHERE "Face_Embeddings" IS NOT NULL
            """)
            for row in cur.fetchall():
                try:
                    encodings = pickle.loads(row['Face_Embeddings'])
                    persons[f"student_{row['Student_ID']}"] = {
                        'id': row['Student_ID'],
                        'name': row['Name'],
                        'type': 'Student',
                        'embeddings': encodings if isinstance(encodings, list) else [encodings]
                    }
                except Exception as e:
                    print(f"[DB ERROR] Failed to load student {row['Student_ID']} embeddings: {e}")

            # Fetch teachers with embeddings
            cur.execute("""
                SELECT "Teacher_ID", "Name", "Face_Embeddings" 
                FROM "Teacher" 
                WHERE "Face_Embeddings" IS NOT NULL
            """)
            for row in cur.fetchall():
                try:
                    encodings = pickle.loads(row['Face_Embeddings'])
                    persons[f"teacher_{row['Teacher_ID']}"] = {
                        'id': row['Teacher_ID'],
                        'name': row['Name'],
                        'type': 'Teacher',
                        'embeddings': encodings if isinstance(encodings, list) else [encodings]
                    }
                except Exception as e:
                    print(f"[DB ERROR] Failed to load teacher {row['Teacher_ID']} embeddings: {e}")

        print(f"[DB] Loaded {len(persons)} persons with face embeddings from database")
        return persons

    def get_zone_name(self, zone_id):
        """Get zone name by ID"""
        try:
            with self.conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("""
                    SELECT "Zone_Name" FROM "Zone" WHERE "Zone_id" = %s
                """, (zone_id,))
                result = cur.fetchone()
                return result['Zone_Name'] if result else f"Zone {zone_id}"
        except Exception as e:
            print(f"[DB ERROR] get_zone_name: {e}")
            return f"Zone {zone_id}"

    def get_zone_cameras(self, zone_id):
        """Get entry and exit cameras for a zone"""
        cameras = {'entry': None, 'exit': None}
        
        try:
            with self.conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("""
                    SELECT "Camara_Id", "Camera_URL", "Camera_Type" 
                    FROM "Camara" 
                    WHERE "Zone_id" = %s
                """, (zone_id,))
                
                for row in cur.fetchall():
                    if row['Camera_Type'] == 'Entry':
                        cameras['entry'] = row
                    elif row['Camera_Type'] == 'Exit':
                        cameras['exit'] = row
        except Exception as e:
            print(f"[DB ERROR] get_zone_cameras: {e}")
        
        return cameras

    def get_zone_cameras_list(self, zone_id):
        """Get all cameras for a zone as a list"""
        try:
            with self.conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("""
                    SELECT "Camara_Id", "Camera_URL", "Camera_Type", "Zone_id"
                    FROM "Camara" 
                    WHERE "Zone_id" = %s
                """, (zone_id,))
                
                return cur.fetchall()
        except Exception as e:
            print(f"[DB ERROR] get_zone_cameras_list: {e}")
            return []

    def mark_entry(self, name, role, zone_id, camera_id):
        """Mark person entry (for streaming service)"""
        try:
            # Parse role to get person ID
            if role == 'STUDENT':
                with self.conn.cursor(cursor_factory=RealDictCursor) as cur:
                    cur.execute('SELECT "Student_ID" FROM "Students" WHERE "Name" = %s', (name,))
                    result = cur.fetchone()
                    if result:
                        return self.add_to_active_presence(result['Student_ID'], 'Student', zone_id)
            else:
                with self.conn.cursor(cursor_factory=RealDictCursor) as cur:
                    cur.execute('SELECT "Teacher_ID" FROM "Teacher" WHERE "Name" = %s', (name,))
                    result = cur.fetchone()
                    if result:
                        return self.add_to_active_presence(result['Teacher_ID'], 'Teacher', zone_id)
        except Exception as e:
            print(f"[DB ERROR] mark_entry: {e}")
            return False

    def mark_exit(self, name, role, zone_id, camera_id):
        """Mark person exit (for streaming service)"""
        try:
            # Parse role to get person ID
            if role == 'STUDENT':
                with self.conn.cursor(cursor_factory=RealDictCursor) as cur:
                    cur.execute('SELECT "Student_ID" FROM "Students" WHERE "Name" = %s', (name,))
                    result = cur.fetchone()
                    if result:
                        return self.remove_from_active_presence(result['Student_ID'], 'Student', zone_id)
            else:
                with self.conn.cursor(cursor_factory=RealDictCursor) as cur:
                    cur.execute('SELECT "Teacher_ID" FROM "Teacher" WHERE "Name" = %s', (name,))
                    result = cur.fetchone()
                    if result:
                        return self.remove_from_active_presence(result['Teacher_ID'], 'Teacher', zone_id)
        except Exception as e:
            print(f"[DB ERROR] mark_exit: {e}")
            return False

    def add_to_active_presence(self, person_id, person_type, zone_id):
        """
        Add person to ActivePresence table (entry detected).
        Checks if already present to avoid duplicates.
        """
        try:
            with self.conn.cursor() as cur:
                # Check if already in zone
                id_field = '"Student_ID"' if person_type == 'Student' else '"Teacher_ID"'
                cur.execute(f"""
                    SELECT "Presence_ID" FROM "ActivePresence" 
                    WHERE {id_field} = %s AND "Zone_id" = %s
                """, (person_id, zone_id))
                
                if cur.fetchone():
                    print(f"[DB] {person_type} {person_id} already in Zone {zone_id}")
                    return False

                # Insert new active presence
                if person_type == 'Student':
                    cur.execute("""
                        INSERT INTO "ActivePresence" 
                        ("PersonType", "Student_ID", "Zone_id", "EntryTime")
                        VALUES (%s, %s, %s, NOW())
                    """, ('Student', person_id, zone_id))
                else:
                    cur.execute("""
                        INSERT INTO "ActivePresence" 
                        ("PersonType", "Teacher_ID", "Zone_id", "EntryTime")
                        VALUES (%s, %s, %s, NOW())
                    """, ('Teacher', person_id, zone_id))
                
                self.conn.commit()
                print(f"[DB] ✓ Added {person_type} {person_id} to Zone {zone_id}")
                return True
                
        except Exception as e:
            self.conn.rollback()
            print(f"[DB ERROR] add_to_active_presence: {e}")
            return False

    def remove_from_active_presence(self, person_id, person_type, zone_id):
        """
        Remove person from ActivePresence and log to AttendanceLog.
        Calculates duration automatically.
        """
        try:
            with self.conn.cursor(cursor_factory=RealDictCursor) as cur:
                id_field = '"Student_ID"' if person_type == 'Student' else '"Teacher_ID"'
                
                # Get active presence record
                cur.execute(f"""
                    SELECT "Presence_ID", "EntryTime" FROM "ActivePresence" 
                    WHERE {id_field} = %s AND "Zone_id" = %s
                """, (person_id, zone_id))
                
                presence = cur.fetchone()
                if not presence:
                    print(f"[DB] {person_type} {person_id} not in Zone {zone_id}")
                    return False

                entry_time = presence['EntryTime']
                exit_time = datetime.now()
                duration = int((exit_time - entry_time).total_seconds())

                # Insert into AttendanceLog
                if person_type == 'Student':
                    cur.execute("""
                        INSERT INTO "AttendanceLog" 
                        ("PersonType", "Student_ID", "Zone_id", "EntryTime", "ExitTime", "Duration")
                        VALUES (%s, %s, %s, %s, %s, %s)
                    """, ('Student', person_id, zone_id, entry_time, exit_time, duration))
                else:
                    cur.execute("""
                        INSERT INTO "AttendanceLog" 
                        ("PersonType", "Teacher_ID", "Zone_id", "EntryTime", "ExitTime", "Duration")
                        VALUES (%s, %s, %s, %s, %s, %s)
                    """, ('Teacher', person_id, zone_id, entry_time, exit_time, duration))

                # Remove from ActivePresence
                cur.execute("""
                    DELETE FROM "ActivePresence" WHERE "Presence_ID" = %s
                """, (presence['Presence_ID'],))
                
                self.conn.commit()
                print(f"[DB] ✓ Removed {person_type} {person_id} from Zone {zone_id} (Duration: {duration}s)")
                return True
                
        except Exception as e:
            self.conn.rollback()
            print(f"[DB ERROR] remove_from_active_presence: {e}")
            return False

    def save_unknown_face(self, image_bytes, zone_id, confidence=None):
        """Save unknown face to database"""
        try:
            with self.conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO "UnknownFaces" 
                    ("Captured_Image", "Zone_id", "Confidence", "Status", "DetectedTime")
                    VALUES (%s, %s, %s, 'PENDING', NOW())
                    RETURNING "Unknown_ID"
                """, (image_bytes, zone_id, confidence))
                
                unknown_id = cur.fetchone()[0]
                self.conn.commit()
                print(f"[DB] ✓ Saved unknown face ID: {unknown_id}")
                return unknown_id
                
        except Exception as e:
            self.conn.rollback()
            print(f"[DB ERROR] save_unknown_face: {e}")
            return None

    def save_face_embeddings(self, person_id, person_type, embeddings):
        """
        Save face embeddings to database (pickle format for compatibility)
        """
        try:
            table = '"Teacher"' if person_type == 'Teacher' else '"Students"'
            id_field = '"Teacher_ID"' if person_type == 'Teacher' else '"Student_ID"'
            
            # Convert embeddings to pickle bytes
            embeddings_bytes = pickle.dumps(embeddings)
            
            with self.conn.cursor() as cur:
                cur.execute(f"""
                    UPDATE {table} 
                    SET "Face_Embeddings" = %s
                    WHERE {id_field} = %s
                """, (embeddings_bytes, person_id))
                
                self.conn.commit()
                print(f"[DB] ✓ Saved embeddings for {person_type} {person_id}")
                return True
                
        except Exception as e:
            self.conn.rollback()
            print(f"[DB ERROR] save_face_embeddings: {e}")
            return False

    def get_person_images(self, person_id, person_type):
        """Get all face pictures for a person"""
        try:
            table = '"Teacher"' if person_type == 'Teacher' else '"Students"'
            id_field = '"Teacher_ID"' if person_type == 'Teacher' else '"Student_ID"'
            
            with self.conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(f"""
                    SELECT "Name", "Face_Picture_1", "Face_Picture_2", "Face_Picture_3", 
                           "Face_Picture_4", "Face_Picture_5"
                    FROM {table}
                    WHERE {id_field} = %s
                """, (person_id,))
                
                return cur.fetchone()
                
        except Exception as e:
            print(f"[DB ERROR] get_person_images: {e}")
            return None
