"""
IntelliSight - Database Handler for DeepFace Face Recognition
Handles all database operations for the face recognition system
"""

import psycopg2
from psycopg2.extras import RealDictCursor
import pickle
import json
import numpy as np
from datetime import datetime, timezone
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
            # Force UTC session timezone so TIMESTAMP columns always store/read UTC values
            # regardless of the PostgreSQL server's local timezone setting.
            with self.conn.cursor() as cur:
                cur.execute("SET TIME ZONE 'UTC'")
            self.conn.commit()
            print("[DB] Connected successfully (session timezone = UTC)")
        except Exception as e:
            print(f"[DB ERROR] Connection failed: {e}")
            raise

    def _ensure_connection(self):
        """Re-establish the PostgreSQL connection if it has been closed or timed out."""
        try:
            if self.conn is None or self.conn.closed:
                raise Exception("connection closed")
            # Cheap ping to detect a silently-dropped connection
            with self.conn.cursor() as cur:
                cur.execute("SELECT 1")
        except Exception:
            print("[DB] Connection lost — reconnecting...")
            try:
                if self.conn and not self.conn.closed:
                    self.conn.close()
            except Exception:
                pass
            self.connect()  # connect() already sets TIME ZONE UTC

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
        self._ensure_connection()
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

    def _mark_class_attendance(self, cur, person_id, person_type, zone_id, now_utc):
        """
        Real-time ClassAttendance upsert when a person is detected.
        Finds the active TimetableSlot for this zone/day/local-time and marks PRESENT or LATE.
        Slot times are stored in local clock (PKT), so we compare against local datetime.now().
        Non-fatal — exceptions are logged but never propagate.
        """
        try:
            is_student  = person_type == 'Student'
            pt_upper    = 'STUDENT' if is_student else 'TEACHER'
            days        = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']
            now_local   = datetime.now()  # local clock — matches TimetableSlot time strings
            cur_day     = days[now_local.weekday()]
            cur_time    = now_local.strftime('%H:%M')
            cur_date    = now_local.date()

            if is_student:
                cur.execute("""
                    SELECT ts."Slot_ID", ts."StartTime"
                    FROM   "TimetableSlot" ts
                    JOIN   "Enrollment" e
                           ON  e."Section_ID" = ts."Section_ID"
                           AND e."Student_ID" = %s
                    WHERE  ts."Zone_id"    = %s
                      AND  ts."DayOfWeek"  = %s
                      AND  ts."StartTime" <= %s
                      AND  ts."EndTime"   >  %s
                      AND  ts."IsActive"   = true
                    LIMIT 1
                """, (person_id, zone_id, cur_day, cur_time, cur_time))
            else:
                cur.execute("""
                    SELECT "Slot_ID", "StartTime"
                    FROM   "TimetableSlot"
                    WHERE  "Teacher_ID" = %s
                      AND  "Zone_id"    = %s
                      AND  "DayOfWeek"  = %s
                      AND  "StartTime" <= %s
                      AND  "EndTime"   >  %s
                      AND  "IsActive"   = true
                    LIMIT 1
                """, (person_id, zone_id, cur_day, cur_time, cur_time))

            slot = cur.fetchone()
            if not slot:
                return  # No active class in this zone right now

            slot_id    = slot[0]
            slot_start = slot[1]
            start_h, start_m = map(int, slot_start.split(':'))
            now_mins   = now_local.hour * 60 + now_local.minute
            status     = 'LATE' if now_mins > start_h * 60 + start_m + 10 else 'PRESENT'

            if is_student:
                cur.execute("""
                    INSERT INTO "ClassAttendance"
                      ("Slot_ID","Date","PersonType","Student_ID","Status",
                       "FirstSeenAt","LastSeenAt","TotalMinutes","DetectionsCount",
                       "CreatedAt","UpdatedAt")
                    VALUES (%s,%s,'STUDENT',%s,%s,%s,%s,0,1,NOW(),NOW())
                    ON CONFLICT ("Slot_ID","Date","Student_ID") DO UPDATE SET
                      "LastSeenAt"      = EXCLUDED."LastSeenAt",
                      "DetectionsCount" = "ClassAttendance"."DetectionsCount" + 1,
                      "UpdatedAt"       = NOW()
                """, (slot_id, cur_date, person_id, status, now_utc, now_utc))
            else:
                cur.execute("""
                    INSERT INTO "ClassAttendance"
                      ("Slot_ID","Date","PersonType","Teacher_ID","Status",
                       "FirstSeenAt","LastSeenAt","TotalMinutes","DetectionsCount",
                       "CreatedAt","UpdatedAt")
                    VALUES (%s,%s,'TEACHER',%s,%s,%s,%s,0,1,NOW(),NOW())
                    ON CONFLICT ("Slot_ID","Date","Teacher_ID") DO UPDATE SET
                      "LastSeenAt"      = EXCLUDED."LastSeenAt",
                      "DetectionsCount" = "ClassAttendance"."DetectionsCount" + 1,
                      "UpdatedAt"       = NOW()
                """, (slot_id, cur_date, person_id, status, now_utc, now_utc))

            print(f"[DB] ✓ ClassAttendance: {pt_upper} {person_id} → Slot {slot_id} [{status}]")
        except Exception as e:
            print(f"[DB WARNING] _mark_class_attendance: {e}")

    def _update_class_attendance_exit(self, cur, person_id, person_type, zone_id, entry_time, exit_time):
        """Update ClassAttendance TotalMinutes + LastSeenAt when person exits."""
        try:
            is_student  = person_type == 'Student'
            days        = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']
            now_local   = datetime.now()
            cur_day     = days[now_local.weekday()]
            cur_date    = now_local.date()
            entry_aware = entry_time.replace(tzinfo=timezone.utc) if entry_time.tzinfo is None else entry_time
            exit_aware  = exit_time if exit_time.tzinfo else exit_time.replace(tzinfo=timezone.utc)
            total_mins  = max(0, int((exit_aware - entry_aware).total_seconds() / 60))

            if is_student:
                cur.execute("""
                    UPDATE "ClassAttendance" ca SET
                      "LastSeenAt"   = %s,
                      "TotalMinutes" = %s,
                      "UpdatedAt"    = NOW()
                    WHERE ca."Student_ID" = %s
                      AND ca."Date"       = %s
                      AND ca."Slot_ID" IN (
                          SELECT ts."Slot_ID"
                          FROM   "TimetableSlot" ts
                          JOIN   "Enrollment" e
                                 ON  e."Section_ID" = ts."Section_ID"
                                 AND e."Student_ID" = %s
                          WHERE  ts."Zone_id"   = %s
                            AND  ts."DayOfWeek" = %s
                            AND  ts."IsActive"  = true
                      )
                """, (exit_time, total_mins, person_id, cur_date, person_id, zone_id, cur_day))
            else:
                cur.execute("""
                    UPDATE "ClassAttendance" ca SET
                      "LastSeenAt"   = %s,
                      "TotalMinutes" = %s,
                      "UpdatedAt"    = NOW()
                    WHERE ca."Teacher_ID" = %s
                      AND ca."Date"       = %s
                      AND ca."Slot_ID" IN (
                          SELECT "Slot_ID" FROM "TimetableSlot"
                          WHERE  "Teacher_ID" = %s
                            AND  "Zone_id"    = %s
                            AND  "DayOfWeek"  = %s
                            AND  "IsActive"   = true
                      )
                """, (exit_time, total_mins, person_id, cur_date, person_id, zone_id, cur_day))

            print(f"[DB] ✓ ClassAttendance exit: {person_type} {person_id} → {total_mins}m")
        except Exception as e:
            print(f"[DB WARNING] _update_class_attendance_exit: {e}")

    def add_to_active_presence(self, person_id, person_type, zone_id):
        """
        Add person to ActivePresence table (entry detected).
        Also opens an AttendanceLog row with ExitTime=NULL so the Logs page
        shows the person as 'Inside' until the exit camera completes the session.
        Simultaneously marks real-time ClassAttendance for the active timetable slot.
        Checks if already present to avoid duplicates.
        """
        self._ensure_connection()
        try:
            with self.conn.cursor() as cur:
                # Check if already in this zone
                id_field = '"Student_ID"' if person_type == 'Student' else '"Teacher_ID"'
                cur.execute(f"""
                    SELECT "Presence_ID" FROM "ActivePresence"
                    WHERE {id_field} = %s AND "Zone_id" = %s
                """, (person_id, zone_id))

                if cur.fetchone():
                    print(f"[DB] {person_type} {person_id} already in Zone {zone_id}")
                    return False

                now_utc = datetime.now(timezone.utc).replace(tzinfo=None)  # naive UTC — safe for TIMESTAMP col
                person_type_upper = 'STUDENT' if person_type == 'Student' else 'TEACHER'

                if person_type == 'Student':
                    cur.execute("""
                        INSERT INTO "ActivePresence"
                        ("PersonType", "Student_ID", "Zone_id", "EntryTime")
                        VALUES (%s, %s, %s, %s)
                    """, (person_type_upper, person_id, zone_id, now_utc))
                    cur.execute("""
                        INSERT INTO "AttendanceLog"
                        ("PersonType", "Student_ID", "Zone_id", "EntryTime", "ExitTime", "Duration")
                        VALUES (%s, %s, %s, %s, NULL, NULL)
                    """, (person_type_upper, person_id, zone_id, now_utc))
                else:
                    cur.execute("""
                        INSERT INTO "ActivePresence"
                        ("PersonType", "Teacher_ID", "Zone_id", "EntryTime")
                        VALUES (%s, %s, %s, %s)
                    """, (person_type_upper, person_id, zone_id, now_utc))
                    cur.execute("""
                        INSERT INTO "AttendanceLog"
                        ("PersonType", "Teacher_ID", "Zone_id", "EntryTime", "ExitTime", "Duration")
                        VALUES (%s, %s, %s, %s, NULL, NULL)
                    """, (person_type_upper, person_id, zone_id, now_utc))

                # Mark ClassAttendance for the active timetable slot (non-fatal)
                self._mark_class_attendance(cur, person_id, person_type, zone_id, now_utc)

                self.conn.commit()
                print(f"[DB] ✓ Added {person_type} {person_id} to Zone {zone_id} + opened AttendanceLog")
                return True

        except Exception as e:
            self.conn.rollback()
            print(f"[DB ERROR] add_to_active_presence: {e}")
            return False

    def remove_from_active_presence(self, person_id, person_type, exit_zone_id):
        """
        Remove person from ActivePresence and complete their AttendanceLog row.

        Searches across ALL zones — entry and exit cameras may belong to different
        zones, so filtering by exit_zone_id would miss the record.

        Preferred path: UPDATE the open AttendanceLog row (ExitTime IS NULL) that
        was created by add_to_active_presence, filling in ExitTime + Duration.
        Fallback: INSERT a new completed row if no open row exists (e.g. legacy data).

        Duration is stored in MINUTES to match the Node.js path.
        """
        self._ensure_connection()
        try:
            with self.conn.cursor(cursor_factory=RealDictCursor) as cur:
                id_field = '"Student_ID"' if person_type == 'Student' else '"Teacher_ID"'

                # Search ALL zones — person may have entered via a different zone
                cur.execute(f"""
                    SELECT "Presence_ID", "EntryTime", "Zone_id"
                    FROM   "ActivePresence"
                    WHERE  {id_field} = %s
                    ORDER  BY "EntryTime" DESC
                    LIMIT  1
                """, (person_id,))

                presence = cur.fetchone()
                if not presence:
                    print(f"[DB] {person_type} {person_id} not in ActivePresence (no entry recorded)")
                    return False

                entry_zone_id = presence['Zone_id']
                entry_time    = presence['EntryTime']

                # UTC-consistent duration calculation — stored in MINUTES
                exit_time   = datetime.now(timezone.utc)
                entry_aware = entry_time.replace(tzinfo=timezone.utc) if entry_time.tzinfo is None else entry_time
                duration_mins = max(0, int((exit_time - entry_aware).total_seconds() / 60))

                person_type_upper = 'STUDENT' if person_type == 'Student' else 'TEACHER'

                # UPDATE the open AttendanceLog row that was created at entry time.
                # Uses a subquery because PostgreSQL does not support ORDER BY / LIMIT in UPDATE.
                cur.execute(f"""
                    UPDATE "AttendanceLog"
                    SET    "ExitTime" = %s, "Duration" = %s
                    WHERE  "Log_ID" = (
                        SELECT "Log_ID" FROM "AttendanceLog"
                        WHERE  {id_field} = %s
                          AND  "Zone_id"   = %s
                          AND  "ExitTime"  IS NULL
                        ORDER  BY "EntryTime" DESC
                        LIMIT  1
                    )
                """, (exit_time, duration_mins, person_id, entry_zone_id))

                if cur.rowcount == 0:
                    # No open log found (legacy data or missed entry) — insert completed row
                    if person_type == 'Student':
                        cur.execute("""
                            INSERT INTO "AttendanceLog"
                            ("PersonType", "Student_ID", "Zone_id", "EntryTime", "ExitTime", "Duration")
                            VALUES (%s, %s, %s, %s, %s, %s)
                        """, (person_type_upper, person_id, entry_zone_id, entry_time, exit_time, duration_mins))
                    else:
                        cur.execute("""
                            INSERT INTO "AttendanceLog"
                            ("PersonType", "Teacher_ID", "Zone_id", "EntryTime", "ExitTime", "Duration")
                            VALUES (%s, %s, %s, %s, %s, %s)
                        """, (person_type_upper, person_id, entry_zone_id, entry_time, exit_time, duration_mins))

                # Update ClassAttendance TotalMinutes for the active slot (non-fatal)
                self._update_class_attendance_exit(cur, person_id, person_type, entry_zone_id, entry_time, exit_time)

                # Remove from ActivePresence
                cur.execute("""
                    DELETE FROM "ActivePresence" WHERE "Presence_ID" = %s
                """, (presence['Presence_ID'],))

                self.conn.commit()
                print(f"[DB] ✓ EXIT {person_type} {person_id} — Zone {entry_zone_id} "
                      f"duration={duration_mins}m → AttendanceLog completed")
                return True

        except Exception as e:
            self.conn.rollback()
            print(f"[DB ERROR] remove_from_active_presence: {e}")
            return False

    def save_unknown_face(self, image_bytes, zone_id, confidence=None):
        """Save unknown face to database"""
        self._ensure_connection()
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

    def save_face_embeddings_v2(self, person_id, person_type, enriched_embeddings,
                                person_name=None):
        """
        Save face embeddings with per-embedding quality metadata.

        Differs from save_face_embeddings() by accepting richer per-row metadata:

            enriched_embeddings : list of dicts, each containing:
                'embedding'          : list[float]  — 512-D ArcFace vector
                'quality_score'      : float        — 0.0–1.0 composite quality score
                'is_centroid'        : bool         — True for the averaged centroid row
                'source_image_index' : int | None   — Face_Picture_N slot (1–5)

        Writes to:
          1. FaceEmbeddings table with QualityScore, IsCentroid, SourceImageIndex columns
             (gracefully falls back to the v1 INSERT if those columns don't exist yet)
          2. Legacy pickle blob in Students / Teacher table (backward compat)

        The centroid row is always included — it is the most stable single-point
        representation used by search_with_vote() as a reliable anchor.
        """
        try:
            table    = '"Teacher"' if person_type == 'Teacher' else '"Students"'
            id_field = '"Teacher_ID"' if person_type == 'Teacher' else '"Student_ID"'

            if not person_name:
                with self.conn.cursor(cursor_factory=RealDictCursor) as cur:
                    cur.execute(f'SELECT "Name" FROM {table} WHERE {id_field} = %s',
                                (person_id,))
                    row = cur.fetchone()
                    person_name = row['Name'] if row else f"{person_type}_{person_id}"

            role       = 'STUDENT' if person_type == 'Student' else 'TEACHER'
            person_key = build_person_key(person_id, role, person_name)

            # Raw list of embeddings for legacy pickle blob
            raw_embeddings = [e['embedding'] for e in enriched_embeddings
                              if not e.get('is_centroid', False)]

            id_col = '"Student_ID"' if person_type == 'Student' else '"Teacher_ID"'

            with self.conn.cursor() as cur:
                # ── Detect v2 schema ONCE up front ────────────────────────────
                # The previous code tried the v2 INSERT per row, and on failure
                # called self.conn.rollback() to fall back to a v1 INSERT.
                # That rollback was transaction-wide — it undid the DELETE that
                # was meant to clear this person's old rows, so every re-enroll
                # accumulated embeddings on top of the existing ones (one user
                # had 70 rows for 5 photos before this was caught).
                # Now we check column availability once and pick the right
                # statement directly — no exception, no rollback.
                cur.execute("""
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'FaceEmbeddings'
                      AND column_name = 'QualityScore'
                    LIMIT 1
                """)
                has_v2_columns = cur.fetchone() is not None

                # 1. Legacy pickle blob (only individual embeddings, not centroid)
                cur.execute(f"""
                    UPDATE {table} SET "Face_Embeddings" = %s WHERE {id_field} = %s
                """, (pickle.dumps(raw_embeddings), person_id))

                # 2. FaceEmbeddings — clear old rows for this person.
                # This must run inside the same transaction as the INSERTs so a
                # failed re-enroll doesn't leave the person with zero embeddings.
                cur.execute(
                    f'DELETE FROM "FaceEmbeddings" WHERE {id_col} = %s',
                    (person_id,),
                )

                for item in enriched_embeddings:
                    emb        = item['embedding']
                    quality    = item.get('quality_score')
                    is_cent    = bool(item.get('is_centroid', False))
                    src_idx    = item.get('source_image_index')
                    emb_json   = json.dumps(emb if isinstance(emb, list) else list(emb))
                    emb_bytes  = emb_json.encode('utf-8')

                    if has_v2_columns:
                        cur.execute(f"""
                            INSERT INTO "FaceEmbeddings"
                                ("PersonType", {id_col}, "PersonName",
                                 "Embedding", "EmbeddingJson",
                                 "QualityScore", "IsCentroid", "SourceImageIndex",
                                 "CreatedAt", "UpdatedAt")
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, NOW(), NOW())
                        """, (person_type, person_id, person_name,
                              emb_bytes, emb_json, quality, is_cent, src_idx))
                    else:
                        cur.execute(f"""
                            INSERT INTO "FaceEmbeddings"
                                ("PersonType", {id_col}, "PersonName",
                                 "Embedding", "EmbeddingJson",
                                 "CreatedAt", "UpdatedAt")
                            VALUES (%s, %s, %s, %s, %s, NOW(), NOW())
                        """, (person_type, person_id, person_name,
                              emb_bytes, emb_json))

            self.conn.commit()
            n_ind  = sum(1 for e in enriched_embeddings if not e.get('is_centroid'))
            n_cent = sum(1 for e in enriched_embeddings if e.get('is_centroid'))
            print(f"[DB] ✓ {person_key}: saved {n_ind} embedding(s) + {n_cent} centroid")
            return True

        except Exception as e:
            self.conn.rollback()
            print(f"[DB ERROR] save_face_embeddings_v2: {e}")
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
