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
from utils import build_person_key

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

        Returns dict keyed by canonical person_key  "{id}|{ROLE}|{Name}":
            {
                person_key: {
                    'id':        int,
                    'name':      str,
                    'type':      'Student' | 'Teacher',
                    'role':      'STUDENT' | 'TEACHER',
                    'key':       str  (same as dict key — the canonical person_key),
                    'embeddings': [ list[float], ... ]
                }
            }

        Loading order:
          1. FaceEmbeddings table (primary — always has id, type, name)
          2. JSON embeddings file (new format with person_key, or old folder-name format)
          3. Legacy pickle blobs in Students / Teacher tables
        """
        persons = {}

        # ── 1. FaceEmbeddings table ───────────────────────────────────────────
        try:
            with self.conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("""
                    SELECT "Embedding_ID", "PersonType", "Student_ID", "Teacher_ID",
                           "PersonName", "EmbeddingJson"
                    FROM "FaceEmbeddings"
                    WHERE "EmbeddingJson" IS NOT NULL
                """)
                rows = cur.fetchall()

                if rows:
                    for row in rows:
                        try:
                            person_name = row['PersonName'] or 'Unknown'
                            person_id   = row['Student_ID'] or row['Teacher_ID']
                            person_type = row['PersonType'] or 'Unknown'  # "Student" or "Teacher"
                            role        = 'STUDENT' if person_type == 'Student' else 'TEACHER'

                            embedding = json.loads(row['EmbeddingJson']) if row['EmbeddingJson'] else None
                            if not embedding or not person_id:
                                continue

                            key = build_person_key(person_id, role, person_name)

                            if key not in persons:
                                persons[key] = {
                                    'id':         person_id,
                                    'name':       person_name,
                                    'type':       person_type,
                                    'role':       role,
                                    'key':        key,
                                    'embeddings': []
                                }
                            persons[key]['embeddings'].append(embedding)

                        except Exception as e:
                            print(f"[DB ERROR] Failed to parse FaceEmbeddings row: {e}")

                    if persons:
                        print(f"[DB] Loaded {len(persons)} persons from FaceEmbeddings table")
                        return persons

        except Exception as e:
            print(f"[DB WARNING] Error loading from FaceEmbeddings table: {e}")

        # ── 2. JSON embeddings file ───────────────────────────────────────────
        try:
            with open(EMBEDDINGS_FILE, 'r') as f:
                embeddings_data = json.load(f)

            for item in embeddings_data:
                embedding = item.get('embedding')
                if not embedding:
                    continue

                # New format — explicit person_id, name, role fields
                person_id   = item.get('person_id')
                person_name = item.get('name') or item.get('person', 'Unknown')
                role        = (item.get('role') or 'UNKNOWN').upper()
                person_key_field = item.get('person_key') or item.get('person', '')

                if person_id is not None and role in ('STUDENT', 'TEACHER'):
                    key         = build_person_key(person_id, role, person_name)
                    person_type = 'Student' if role == 'STUDENT' else 'Teacher'
                elif person_key_field:
                    key         = person_key_field
                    person_type = role.capitalize() if role in ('STUDENT', 'TEACHER') else 'Unknown'
                else:
                    # Old format — folder name only; no id/role available
                    key         = person_name.lower()
                    person_type = 'Unknown'

                if key not in persons:
                    persons[key] = {
                        'id':         person_id,
                        'name':       person_name,
                        'type':       person_type,
                        'role':       role,
                        'key':        key,
                        'embeddings': []
                    }
                persons[key]['embeddings'].append(embedding)

            if persons:
                print(f"[DB] Loaded {len(persons)} persons from embeddings file")
                return persons

        except FileNotFoundError:
            print("[DB] No embeddings file found, trying legacy database format")
        except Exception as e:
            print(f"[DB WARNING] Error loading embeddings file: {e}")

        # ── 3. Legacy pickle blobs (Students / Teacher tables) ───────────────
        with self.conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT "Student_ID", "Name", "Face_Embeddings"
                FROM "Students"
                WHERE "Face_Embeddings" IS NOT NULL
            """)
            for row in cur.fetchall():
                try:
                    encodings = pickle.loads(row['Face_Embeddings'])
                    person_id   = row['Student_ID']
                    person_name = row['Name']
                    key = build_person_key(person_id, 'STUDENT', person_name)
                    persons[key] = {
                        'id':         person_id,
                        'name':       person_name,
                        'type':       'Student',
                        'role':       'STUDENT',
                        'key':        key,
                        'embeddings': encodings if isinstance(encodings, list) else [encodings]
                    }
                except Exception as e:
                    print(f"[DB ERROR] Failed to load student {row['Student_ID']} embeddings: {e}")

            cur.execute("""
                SELECT "Teacher_ID", "Name", "Face_Embeddings"
                FROM "Teacher"
                WHERE "Face_Embeddings" IS NOT NULL
            """)
            for row in cur.fetchall():
                try:
                    encodings = pickle.loads(row['Face_Embeddings'])
                    person_id   = row['Teacher_ID']
                    person_name = row['Name']
                    key = build_person_key(person_id, 'TEACHER', person_name)
                    persons[key] = {
                        'id':         person_id,
                        'name':       person_name,
                        'type':       'Teacher',
                        'role':       'TEACHER',
                        'key':        key,
                        'embeddings': encodings if isinstance(encodings, list) else [encodings]
                    }
                except Exception as e:
                    print(f"[DB ERROR] Failed to load teacher {row['Teacher_ID']} embeddings: {e}")

        print(f"[DB] Loaded {len(persons)} persons from legacy pickle store")
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

    def mark_entry(self, person_id: int, person_type: str, zone_id: int, camera_id=None):
        """
        Mark person entry (called by streaming service and persistent camera manager).

        Args:
            person_id   : integer DB primary key (Student_ID or Teacher_ID)
            person_type : "Student" or "Teacher"  (or "STUDENT"/"TEACHER" — normalised here)
            zone_id     : Zone the camera belongs to
            camera_id   : optional — logged but not written to DB currently
        """
        # Normalise to title-case "Student" / "Teacher"
        normalised = 'Teacher' if str(person_type).upper() == 'TEACHER' else 'Student'
        return self.add_to_active_presence(person_id, normalised, zone_id)

    def mark_exit(self, person_id: int, person_type: str, zone_id: int, camera_id=None):
        """
        Mark person exit (called by streaming service and persistent camera manager).

        Args:
            person_id   : integer DB primary key (Student_ID or Teacher_ID)
            person_type : "Student" or "Teacher"  (or "STUDENT"/"TEACHER" — normalised here)
            zone_id     : Zone the camera belongs to
            camera_id   : optional
        """
        normalised = 'Teacher' if str(person_type).upper() == 'TEACHER' else 'Student'
        return self.remove_from_active_presence(person_id, normalised, zone_id)

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
                    """, ('STUDENT', person_id, zone_id))
                else:
                    cur.execute("""
                        INSERT INTO "ActivePresence" 
                        ("PersonType", "Teacher_ID", "Zone_id", "EntryTime")
                        VALUES (%s, %s, %s, NOW())
                    """, ('TEACHER', person_id, zone_id))
                
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
                    """, ('STUDENT', person_id, zone_id, entry_time, exit_time, duration))
                else:
                    cur.execute("""
                        INSERT INTO "AttendanceLog" 
                        ("PersonType", "Teacher_ID", "Zone_id", "EntryTime", "ExitTime", "Duration")
                        VALUES (%s, %s, %s, %s, %s, %s)
                    """, ('TEACHER', person_id, zone_id, entry_time, exit_time, duration))

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

    def save_face_embeddings(self, person_id, person_type, embeddings, person_name=None):
        """
        Save face embeddings for a person.

        Writes to two places:
          1. Legacy pickle blob in Students / Teacher table  (backward-compat)
          2. FaceEmbeddings table with JSON + canonical person_key  (primary source
             used by fetch_all_persons going forward)

        Args:
            person_id   : integer DB primary key
            person_type : "Student" or "Teacher"
            embeddings  : list of 128-D FaceNet embedding lists
            person_name : display name (fetched from DB if not supplied)
        """
        try:
            table    = '"Teacher"' if person_type == 'Teacher' else '"Students"'
            id_field = '"Teacher_ID"' if person_type == 'Teacher' else '"Student_ID"'

            # ── Fetch name from DB if caller didn't supply it ──────────────
            if not person_name:
                with self.conn.cursor(cursor_factory=RealDictCursor) as cur:
                    name_col = '"Name"'
                    cur.execute(f'SELECT {name_col} FROM {table} WHERE {id_field} = %s', (person_id,))
                    row = cur.fetchone()
                    person_name = row['Name'] if row else f"{person_type}_{person_id}"

            role       = 'STUDENT' if person_type == 'Student' else 'TEACHER'
            person_key = build_person_key(person_id, role, person_name)

            with self.conn.cursor() as cur:
                # 1. Legacy pickle blob
                cur.execute(f"""
                    UPDATE {table}
                    SET "Face_Embeddings" = %s
                    WHERE {id_field} = %s
                """, (pickle.dumps(embeddings), person_id))

                # 2. FaceEmbeddings table — clear old rows then insert fresh ones
                if person_type == 'Student':
                    cur.execute('DELETE FROM "FaceEmbeddings" WHERE "Student_ID" = %s', (person_id,))
                else:
                    cur.execute('DELETE FROM "FaceEmbeddings" WHERE "Teacher_ID" = %s', (person_id,))

                for embedding in embeddings:
                    embedding_json  = json.dumps(embedding if isinstance(embedding, list) else list(embedding))
                    embedding_bytes = embedding_json.encode('utf-8')

                    if person_type == 'Student':
                        cur.execute("""
                            INSERT INTO "FaceEmbeddings"
                                ("PersonType", "Student_ID", "PersonName",
                                 "Embedding", "EmbeddingJson", "CreatedAt", "UpdatedAt")
                            VALUES (%s, %s, %s, %s, %s, NOW(), NOW())
                        """, (person_type, person_id, person_name, embedding_bytes, embedding_json))
                    else:
                        cur.execute("""
                            INSERT INTO "FaceEmbeddings"
                                ("PersonType", "Teacher_ID", "PersonName",
                                 "Embedding", "EmbeddingJson", "CreatedAt", "UpdatedAt")
                            VALUES (%s, %s, %s, %s, %s, NOW(), NOW())
                        """, (person_type, person_id, person_name, embedding_bytes, embedding_json))

            self.conn.commit()
            print(f"[DB] ✓ Saved {len(embeddings)} embedding(s) for {person_key}")
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
