import psycopg2
from psycopg2.extras import RealDictCursor
import pickle
from datetime import datetime
from config import DB_CONFIG, UNIDENTIFIED_SAVE_PATH

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
            person_id: {
                'name': str,
                'type': 'Student' or 'Teacher',
                'encodings': list of 128D arrays
            }
        }
        """
        persons = {}
        
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
                        'encodings': encodings
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
                        'encodings': encodings
                    }
                except Exception as e:
                    print(f"[DB ERROR] Failed to load teacher {row['Teacher_ID']} embeddings: {e}")

        print(f"[DB] Loaded {len(persons)} persons with face embeddings")
        return persons

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
                cur.execute(f"""
                    INSERT INTO "ActivePresence" 
                    ("PersonType", {id_field}, "Zone_id", "EntryTime") 
                    VALUES (%s, %s, %s, NOW())
                """, (person_type, person_id, zone_id))
                
                self.conn.commit()
                print(f"[DB] ✓ {person_type} {person_id} entered Zone {zone_id}")
                return True
        except Exception as e:
            print(f"[DB ERROR] add_to_active_presence: {e}")
            self.conn.rollback()
            return False

    def remove_from_active_presence(self, person_id, person_type, zone_id):
        """
        Remove person from ActivePresence (exit detected).
        Also creates AttendanceLog entry with entry/exit times.
        """
        try:
            with self.conn.cursor(cursor_factory=RealDictCursor) as cur:
                # Get active presence record
                id_field = '"Student_ID"' if person_type == 'Student' else '"Teacher_ID"'
                cur.execute(f"""
                    SELECT "Presence_ID", "EntryTime" 
                    FROM "ActivePresence" 
                    WHERE {id_field} = %s AND "Zone_id" = %s
                """, (person_id, zone_id))
                
                record = cur.fetchone()
                if not record:
                    print(f"[DB] {person_type} {person_id} not in Zone {zone_id} active presence")
                    return False

                entry_time = record['EntryTime']
                exit_time = datetime.now()
                duration = int((exit_time - entry_time).total_seconds() / 60)  # minutes

                # Create attendance log
                cur.execute(f"""
                    INSERT INTO "AttendanceLog" 
                    ("PersonType", {id_field}, "Zone_id", "EntryTime", "ExitTime", "Duration") 
                    VALUES (%s, %s, %s, %s, %s, %s)
                """, (person_type, person_id, zone_id, entry_time, exit_time, duration))

                # Delete from active presence
                cur.execute(f"""
                    DELETE FROM "ActivePresence" 
                    WHERE "Presence_ID" = %s
                """, (record['Presence_ID'],))

                self.conn.commit()
                print(f"[DB] ✓ {person_type} {person_id} exited Zone {zone_id} (Duration: {duration} min)")
                return True
        except Exception as e:
            print(f"[DB ERROR] remove_from_active_presence: {e}")
            self.conn.rollback()
            return False

    def log_unknown_face(self, zone_id, image_path):
        """Save unidentified face to UnknownFaces table"""
        try:
            with self.conn.cursor() as cur:
                # Read image file
                with open(image_path, 'rb') as f:
                    image_bytes = f.read()
                
                cur.execute("""
                    INSERT INTO "UnknownFaces" 
                    ("Zone_id", "Captured_Image", "DetectedTime", "Status") 
                    VALUES (%s, %s, NOW(), 'PENDING')
                """, (zone_id, image_bytes))
                
                self.conn.commit()
                print(f"[DB] ✓ Unknown face logged for Zone {zone_id}")
        except Exception as e:
            print(f"[DB ERROR] log_unknown_face: {e}")
            self.conn.rollback()

    def get_zone_cameras(self, zone_id):
        """Get entry and exit cameras for a zone"""
        try:
            with self.conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("""
                    SELECT "Camara_Id", "Camera_Type", "Camera_URL" 
                    FROM "Camara" 
                    WHERE "Zone_id" = %s
                    ORDER BY "Camera_Type"
                """, (zone_id,))
                
                cameras = cur.fetchall()
                return {
                    'entry': next((c for c in cameras if c['Camera_Type'] == 'Entry'), None),
                    'exit': next((c for c in cameras if c['Camera_Type'] == 'Exit'), None)
                }
        except Exception as e:
            print(f"[DB ERROR] get_zone_cameras: {e}")
            return {'entry': None, 'exit': None}

    def get_zone_name(self, zone_id):
        """Get zone name"""
        try:
            with self.conn.cursor() as cur:
                cur.execute('SELECT "Zone_Name" FROM "Zone" WHERE "Zone_id" = %s', (zone_id,))
                result = cur.fetchone()
                return result[0] if result else f"Zone {zone_id}"
        except Exception as e:
            print(f"[DB ERROR] get_zone_name: {e}")
            return f"Zone {zone_id}"

    def save_face_embeddings(self, person_id, person_type, embeddings):
        """Save face embeddings to database"""
        try:
            table = '"Teacher"' if person_type == 'Teacher' else '"Students"'
            id_field = '"Teacher_ID"' if person_type == 'Teacher' else '"Student_ID"'
            
            embeddings_bytes = pickle.dumps(embeddings)
            
            with self.conn.cursor() as cur:
                cur.execute(f"""
                    UPDATE {table} 
                    SET "Face_Embeddings" = %s 
                    WHERE {id_field} = %s
                """, (embeddings_bytes, person_id))
                
                self.conn.commit()
                print(f"[DB] ✓ Saved {len(embeddings)} face encodings for {person_type} {person_id}")
                return True
        except Exception as e:
            print(f"[DB ERROR] save_face_embeddings: {e}")
            self.conn.rollback()
            return False
