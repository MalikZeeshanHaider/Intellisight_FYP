"""
IntelliSight - Dual Camera Face Recognition System using DeepFace (FaceNet)
Monitors entry and exit cameras for a zone.
- Entry camera: Adds detected persons to ActivePresence
- Exit camera: Removes from ActivePresence and logs to AttendanceLog

Usage:
    python recognition.py --zone 1
    python recognition.py --zone 1 --entry-only
    python recognition.py --zone 1 --exit-only
"""

import os
import json
import cv2
import numpy as np
import time
import argparse
from datetime import datetime
from deepface import DeepFace

from database_handler import DatabaseHandler
from config import (
    MODEL_NAME, DISTANCE_THRESHOLD, DISTANCE_METRIC, MIN_FACE_SIZE,
    CONSECUTIVE_MATCHES, EMBEDDINGS_FILE, DETECTOR_BACKEND,
    UNIDENTIFIED_SAVE_PATH, FRAME_SKIP
)
from utils import (
    setup_logging, get_euclidean_distance, find_best_match,
    load_embeddings_from_json, draw_face_box, draw_info_panel, FPSCounter,
    build_person_key, preprocess_face_crop, EmbeddingIndex, FaceTracker
)

logger = setup_logging()

# Recognition settings
MAX_FACES = 10  # Maximum faces to process at once


class DualCameraRecognizer:
    def __init__(self, zone_id):
        self.zone_id = zone_id
        self.db_handler = DatabaseHandler()
        self.zone_name = self.db_handler.get_zone_name(zone_id)
        
        # Load known faces and build vectorized index
        self.embeddings_data  = self.load_embeddings()
        self.embedding_index  = EmbeddingIndex(self.embeddings_data)
        
        # Get cameras for zone
        cameras = self.db_handler.get_zone_cameras(zone_id)
        self.entry_camera = cameras['entry']
        self.exit_camera = cameras['exit']
        
        if not self.entry_camera and not self.exit_camera:
            raise ValueError(f"No cameras configured for Zone {zone_id}")
        
        # Initialize video captures (with retry on first open)
        self.entry_cap    = None
        self.exit_cap     = None
        self.entry_source = None   # stored for reconnect in run()
        self.exit_source  = None

        if self.entry_camera:
            self.entry_source = self.parse_camera_source(self.entry_camera['Camera_URL'])
            self.entry_cap    = self._open_camera(self.entry_source, 'ENTRY CAMERA')

        if self.exit_camera:
            self.exit_source = self.parse_camera_source(self.exit_camera['Camera_URL'])
            self.exit_cap    = self._open_camera(self.exit_source, 'EXIT CAMERA')
        
        # Tracking variables
        self.entry_match_counts = {}  # {person_key: count}
        self.exit_match_counts = {}
        self.frame_count = 0
        self.fps_counter = FPSCounter()

        # Face trackers — one per camera, cache identity for 2 s without re-recognition
        self.entry_tracker = FaceTracker(max_age_seconds=2.0)
        self.exit_tracker  = FaceTracker(max_age_seconds=2.0)

        # Per-person DB write cooldown — prevents repeated idempotent writes for
        # the same person within WRITE_COOLDOWN seconds after a confirmed write.
        self.last_write_time = {}
        self.WRITE_COOLDOWN  = 5.0
        
        print(f"\n{'='*60}")
        print(f"DUAL CAMERA RECOGNITION SYSTEM - DeepFace ArcFace")
        print(f"Zone: {self.zone_name} (ID: {zone_id})")
        print(f"Known Persons: {len(self.embeddings_data)}")
        print(f"Entry Camera: {'✓' if self.entry_cap else '✗'}")
        print(f"Exit Camera: {'✓' if self.exit_cap else '✗'}")
        print(f"Distance ({DISTANCE_METRIC}): threshold={DISTANCE_THRESHOLD}")
        print(f"{'='*60}\n")

    def _open_camera(self, source, label, max_attempts=5):
        """
        Open a camera with exponential backoff.

        Tries up to *max_attempts* times.  For RTSP URLs, configures FFMPEG
        with TCP transport; for integer webcam indices a plain VideoCapture is
        used.  Logs each attempt and returns the VideoCapture on success, or
        None if every attempt fails (the run-loop will retry later).

        Args:
            source       : int (webcam index) or str (RTSP/file URL)
            label        : human-readable label used in log lines
            max_attempts : maximum number of open attempts

        Returns:
            cv2.VideoCapture | None
        """
        base_delay = 2
        max_delay  = 60

        for attempt in range(max_attempts):
            try:
                if attempt > 0:
                    delay = min(base_delay * (2 ** (attempt - 1)), max_delay)
                    print(f"[{label}] Attempt {attempt + 1}/{max_attempts} — waiting {delay:.0f}s...")
                    time.sleep(delay)

                if isinstance(source, str) and source.lower().startswith('rtsp'):
                    os.environ['OPENCV_FFMPEG_CAPTURE_OPTIONS'] = (
                        'rtsp_transport;tcp|'
                        'rtsp_flags;prefer_tcp|'
                        'stimeout;5000000|'
                        'max_delay;500000|'
                        'reorder_queue_size;0'
                    )
                    cap = cv2.VideoCapture(source, cv2.CAP_FFMPEG)
                    cap.set(cv2.CAP_PROP_OPEN_TIMEOUT_MSEC, 10000)
                    cap.set(cv2.CAP_PROP_READ_TIMEOUT_MSEC,  5000)
                else:
                    cap = cv2.VideoCapture(source)

                cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)

                if cap.isOpened():
                    ret, _ = cap.read()
                    if ret:
                        print(f"[{label}] ✓ Connected")
                        return cap

                cap.release()
                print(f"[{label}] Attempt {attempt + 1}/{max_attempts} failed — could not read frame")

            except Exception as e:
                print(f"[{label}] Attempt {attempt + 1}/{max_attempts} error: {e}")

        print(f"[{label}] Could not connect after {max_attempts} attempts — will retry during operation")
        return None

    def parse_camera_source(self, camera_url):
        """Parse camera URL/index"""
        if not camera_url:
            return 0
        try:
            return int(camera_url)
        except ValueError:
            return camera_url

    def load_embeddings(self):
        """
        Load embeddings from database (FaceEmbeddings table) with JSON file fallback.

        The 'person' field of every returned item is set to the canonical person_key
        ("42|STUDENT|Ali Khan") so that find_best_match() returns a person_key and
        parse_person_key() can decode it without any further DB lookup.
        """
        db_persons = self.db_handler.fetch_all_persons()

        if db_persons:
            embeddings_data = []
            for key, person_data in db_persons.items():
                for embedding in person_data.get('embeddings', []):
                    embeddings_data.append({
                        'person_id':  person_data.get('id'),
                        'name':       person_data.get('name', ''),
                        'role':       person_data.get('role', 'UNKNOWN'),
                        'person_key': person_data.get('key', key),
                        'embedding':  embedding,
                    })

            if embeddings_data:
                unique_names = sorted(set(d['name'] or d['person_key'] for d in embeddings_data))
                print(f"[EMBEDDINGS] Loaded {len(embeddings_data)} embedding(s) for: {', '.join(unique_names)}")
                return embeddings_data

        # JSON fallback — may be old format (just folder name) or new (person_key)
        raw = load_embeddings_from_json(EMBEDDINGS_FILE)

        if not raw:
            print(f"[WARNING] No embeddings found in database or {EMBEDDINGS_FILE}")
            print("[WARNING] Run 'python train.py' first!")
            return []

        embeddings_data = []
        for item in raw:
            embeddings_data.append({
                'person_id':  item.get('person_id'),
                'name':       item.get('name') or item.get('person', ''),
                'role':       (item.get('role') or 'UNKNOWN').upper(),
                'person_key': item.get('person_key') or item.get('person', ''),
                'embedding':  item['embedding'],
            })

        unique_names = set(d['name'] or d['person_key'] for d in embeddings_data)
        print(f"[EMBEDDINGS] Loaded {len(embeddings_data)} embedding(s) from file ({len(unique_names)} persons)")
        return embeddings_data
    
    def reload_embeddings(self):
        """Reload embeddings from database (call when embeddings are updated)"""
        self.embeddings_data = self.load_embeddings()
        self.embedding_index = EmbeddingIndex(self.embeddings_data)
        print(f"[EMBEDDINGS] Reloaded {len(self.embeddings_data)} embeddings")

    def process_frame(self, frame, camera_type):
        """
        Process a single frame using a two-phase pipeline:

        Phase 1 — Detection (always runs):
            DeepFace.extract_faces() with DETECTOR_BACKEND locates all faces and
            returns aligned crops + bounding boxes.

        Phase 2 — Recognition (tracker-gated):
            For each detected face the FaceTracker is queried.  If a cached
            identity exists (IoU ≥ 0.5, age < 2 s) it is reused without
            calling DeepFace.represent() again.  Only genuinely new or
            tracking-lost faces pay the full embedding cost.

        Args:
            frame       : OpenCV BGR frame
            camera_type : 'entry' or 'exit'

        Returns:
            (display_frame, recognized_persons)
        """
        tracker  = self.entry_tracker if camera_type == 'entry' else self.exit_tracker
        display  = frame.copy()
        recognized_persons = []
        unknown_crops      = []   # (face_crop, distance) for unrecognised faces
        detections         = []   # fed into tracker.update() at end of frame

        # ── Phase 1: detect all faces ─────────────────────────────────────────
        try:
            face_list = DeepFace.extract_faces(
                img_path=preprocess_face_crop(frame),
                detector_backend=DETECTOR_BACKEND,
                enforce_detection=False,
                align=False   # must match enrollment.py which uses align=False
            )
        except Exception as e:
            logger.debug(f"Detection error: {e}")
            face_list = []

        # Sort largest-first, cap to MAX_FACES
        face_list = sorted(
            face_list,
            key=lambda f: f.get('facial_area', {}).get('w', 0) * f.get('facial_area', {}).get('h', 0),
            reverse=True
        )[:MAX_FACES]

        # ── Phase 2: identity lookup per face ─────────────────────────────────
        for face_obj in face_list:
            fa = face_obj.get('facial_area', {})
            x, y, w, h = fa.get('x', 0), fa.get('y', 0), fa.get('w', 0), fa.get('h', 0)

            if w < MIN_FACE_SIZE or h < MIN_FACE_SIZE:
                continue

            bbox = (x, y, w, h)

            # Check tracker cache — avoids re-recognition for known faces
            cached_person, cached_dist, _ = tracker.get_person_for_bbox(bbox)

            if cached_person is not None:
                person_dict = cached_person
                distance    = cached_dist
            else:
                # Full recognition: embed the aligned crop, search index
                face_crop = face_obj.get('face')
                if face_crop is None or (hasattr(face_crop, 'size') and face_crop.size == 0):
                    fh, fw = frame.shape[:2]
                    m = 20
                    face_crop = frame[max(0, y - m):min(fh, y + h + m),
                                      max(0, x - m):min(fw, x + w + m)]
                else:
                    # DeepFace ≥0.0.79 returns float32 [0–1] RGB from extract_faces.
                    # Convert to uint8 BGR so CLAHE preprocessing works correctly,
                    # matching the uint8 BGR pipeline used during enrollment.
                    if face_crop.dtype != np.uint8:
                        face_crop = (face_crop * 255).clip(0, 255).astype(np.uint8)
                        face_crop = cv2.cvtColor(face_crop, cv2.COLOR_RGB2BGR)

                face_crop    = preprocess_face_crop(face_crop)
                face_resized = cv2.resize(face_crop, (112, 112))  # ArcFace canonical 112×112

                person_dict = distance = None
                try:
                    results = DeepFace.represent(
                        img_path=face_resized,
                        model_name=MODEL_NAME,
                        detector_backend="skip",
                        enforce_detection=False,
                        align=False,
                    )
                    if results:
                        person_dict, distance = self.embedding_index.search(
                            results[0]["embedding"], DISTANCE_THRESHOLD
                        )
                except Exception as e:
                    logger.debug(f"Recognition error: {e}")

            # Accumulate detection for tracker update
            detections.append({
                'bbox':       bbox,
                'person':     person_dict,
                'distance':   distance or 0,
                'confidence': 0,
            })

            # Build display label and collect recognized persons
            if person_dict is not None:
                role         = person_dict['role']
                display_name = person_dict['name']
                color = (255, 100, 0) if role == 'TEACHER' else (0, 200, 0)
                label = f"{display_name} ({distance:.1f})"
                recognized_persons.append({
                    'person_id':  person_dict['person_id'],
                    'name':       display_name,
                    'role':       role,
                    'person_key': person_dict['person_key'],
                    'distance':   distance,
                    'bbox':       bbox,
                })
            elif distance is not None:
                color = (0, 0, 255)
                label = f"Unknown ({distance:.1f})"
                # face_crop is always available here — unknown faces never hit the
                # cached-identity branch (cached_person would be None, forcing full
                # recognition).  Collect for entry-camera unknown-face saving.
                unknown_crops.append((face_crop.copy(), distance))
            else:
                color = (0, 255, 255)
                label = "Detecting..."

            draw_face_box(display, x, y, w, h, label, color)

        # ── Update tracker with this frame's detections ───────────────────────
        tracker.update(detections, self.frame_count)

        return display, recognized_persons, unknown_crops

    def handle_entry_detection(self, person: dict):
        """
        Handle a person recognised at the entry camera.

        Args:
            person: dict with keys 'person_id', 'name', 'role', 'person_key',
                    'distance', 'bbox' as produced by process_frame().
        """
        person_key = person['person_key']
        match_counts = self.entry_match_counts

        match_counts[person_key] = match_counts.get(person_key, 0) + 1

        if match_counts[person_key] >= CONSECUTIVE_MATCHES:
            match_counts[person_key] = 0

            # Skip if a write for this person was committed within the cooldown window.
            now = time.time()
            write_key = f"entry_{person_key}"
            if now - self.last_write_time.get(write_key, 0) < self.WRITE_COOLDOWN:
                return

            person_id = person['person_id']
            role      = person['role']
            name      = person['name']

            if person_id is not None and role in ('STUDENT', 'TEACHER'):
                person_type = 'Student' if role == 'STUDENT' else 'Teacher'
                success = self.db_handler.add_to_active_presence(person_id, person_type, self.zone_id)
                if success:
                    self.last_write_time[write_key] = now
                    print(f"[ENTRY] ✓ {name} ({role}) entered {self.zone_name}")
                else:
                    print(f"[ENTRY] = {name} already present in {self.zone_name}")
            else:
                logger.warning(f"[ENTRY] Invalid identity in person dict: {person!r}")

    def handle_exit_detection(self, person: dict):
        """
        Handle a person recognised at the exit camera.

        Args:
            person: dict with keys 'person_id', 'name', 'role', 'person_key',
                    'distance', 'bbox' as produced by process_frame().
        """
        person_key = person['person_key']
        match_counts = self.exit_match_counts

        match_counts[person_key] = match_counts.get(person_key, 0) + 1

        if match_counts[person_key] >= CONSECUTIVE_MATCHES:
            match_counts[person_key] = 0

            now = time.time()
            write_key = f"exit_{person_key}"

            # Guard 1: exit cooldown — don't fire twice for the same exit event.
            if now - self.last_write_time.get(write_key, 0) < self.WRITE_COOLDOWN:
                return

            # Guard 2: entry-exit overlap prevention.
            # If this person was written to ActivePresence within the last
            # ENTRY_EXIT_GUARD seconds by the entry camera, skip the exit —
            # it's almost certainly a false detection caused by the two cameras
            # seeing the same doorway simultaneously.
            ENTRY_EXIT_GUARD = 10.0
            entry_write_key  = f"entry_{person_key}"
            if now - self.last_write_time.get(entry_write_key, 0) < ENTRY_EXIT_GUARD:
                return

            person_id = person['person_id']
            role      = person['role']
            name      = person['name']

            if person_id is not None and role in ('STUDENT', 'TEACHER'):
                person_type = 'Student' if role == 'STUDENT' else 'Teacher'
                success = self.db_handler.remove_from_active_presence(person_id, person_type, self.zone_id)
                if success:
                    self.last_write_time[write_key] = now
                    print(f"[EXIT] ✓ {name} ({role}) exited {self.zone_name}")
                else:
                    print(f"[EXIT] ? {name} not in ActivePresence (no entry recorded or already exited)")
            else:
                logger.warning(f"[EXIT] Invalid identity in person dict: {person!r}")

    # UNKNOWN_FACE_COOLDOWN: minimum seconds between consecutive saves of an
    # unrecognised face from the same camera to avoid spamming the DB.
    UNKNOWN_FACE_COOLDOWN = 30.0

    def handle_unknown_face(self, face_crop, distance):
        """
        Save an unrecognised face image to the UnknownFaces table.
        Called only by the ENTRY camera path — exit camera does not log unknowns.
        A 30-second per-camera cooldown prevents repeated saves of the same person.
        """
        write_key = "unknown_entry"
        now = time.time()
        if now - self.last_write_time.get(write_key, 0) < self.UNKNOWN_FACE_COOLDOWN:
            return

        try:
            _, jpeg = cv2.imencode('.jpg', face_crop, [cv2.IMWRITE_JPEG_QUALITY, 90])
            image_bytes = jpeg.tobytes()
            confidence  = max(0.0, 1.0 - (distance / DISTANCE_THRESHOLD))
            saved_id    = self.db_handler.save_unknown_face(image_bytes, self.zone_id, confidence)
            if saved_id is not None:
                self.last_write_time[write_key] = now
                print(f"[ENTRY] ⚠ Unknown face saved (id={saved_id}, dist={distance:.2f}, zone={self.zone_id})")
        except Exception as e:
            logger.warning(f"[ENTRY] Unknown face save failed: {e}")

    def run(self, entry_only=False, exit_only=False):
        """
        Main recognition loop
        
        Args:
            entry_only: Only process entry camera
            exit_only: Only process exit camera
        """
        print("\n[RECOGNITION] Starting face recognition loop...")
        print("[RECOGNITION] Press 'q' to quit\n")

        # Per-camera reconnect state
        entry_fail_count = 0
        exit_fail_count  = 0
        entry_reconnects = 0
        exit_reconnects  = 0
        FAIL_THRESHOLD   = 10   # Consecutive read failures before attempting reconnect

        try:
            while True:
                self.frame_count += 1
                self.fps_counter.update()

                # ── Entry camera ──────────────────────────────────────────────
                if self.entry_source is not None and not exit_only:
                    if self.entry_cap is not None:
                        ret, frame = self.entry_cap.read()
                    else:
                        ret = False  # cap is None — trigger reconnect path below

                    if ret:
                        entry_fail_count = 0
                        if self.frame_count % FRAME_SKIP == 0:
                            display, recognized, unknowns = self.process_frame(frame, 'entry')
                            # Entry camera: write presence + open attendance log
                            for person in recognized:
                                self.handle_entry_detection(person)
                            # Entry camera only: save unknown faces to DB
                            for face_crop, distance in unknowns:
                                self.handle_unknown_face(face_crop, distance)
                            fps = self.fps_counter.get_fps()
                            draw_info_panel(display, [
                                f"Zone: {self.zone_name} (Entry)",
                                f"FPS: {fps:.1f}",
                                f"Faces: {len(recognized)}"
                            ])
                            cv2.imshow(f'Entry Camera - {self.zone_name}', display)
                        else:
                            cv2.imshow(f'Entry Camera - {self.zone_name}', frame)
                    else:
                        entry_fail_count += 1
                        if entry_fail_count >= FAIL_THRESHOLD:
                            entry_reconnects += 1
                            delay = min(2 * (2 ** min(entry_reconnects - 1, 5)), 60)
                            print(
                                f"[ENTRY] Stream lost — reconnect attempt {entry_reconnects}, "
                                f"waiting {delay:.0f}s..."
                            )
                            if self.entry_cap:
                                self.entry_cap.release()
                                self.entry_cap = None
                            time.sleep(delay)
                            self.entry_cap = self._open_camera(
                                self.entry_source, 'ENTRY CAMERA', max_attempts=1
                            )
                            if self.entry_cap:
                                entry_reconnects = 0
                                print("[ENTRY] ✓ Reconnected")
                            entry_fail_count = 0

                # ── Exit camera ───────────────────────────────────────────────
                if self.exit_source is not None and not entry_only:
                    if self.exit_cap is not None:
                        ret, frame = self.exit_cap.read()
                    else:
                        ret = False

                    if ret:
                        exit_fail_count = 0
                        if self.frame_count % FRAME_SKIP == 0:
                            display, recognized, _ = self.process_frame(frame, 'exit')
                            # Exit camera only: close attendance log + remove presence.
                            # Unknown faces from exit camera are intentionally ignored.
                            for person in recognized:
                                self.handle_exit_detection(person)
                            fps = self.fps_counter.get_fps()
                            draw_info_panel(display, [
                                f"Zone: {self.zone_name} (Exit)",
                                f"FPS: {fps:.1f}",
                                f"Faces: {len(recognized)}"
                            ])
                            cv2.imshow(f'Exit Camera - {self.zone_name}', display)
                        else:
                            cv2.imshow(f'Exit Camera - {self.zone_name}', frame)
                    else:
                        exit_fail_count += 1
                        if exit_fail_count >= FAIL_THRESHOLD:
                            exit_reconnects += 1
                            delay = min(2 * (2 ** min(exit_reconnects - 1, 5)), 60)
                            print(
                                f"[EXIT] Stream lost — reconnect attempt {exit_reconnects}, "
                                f"waiting {delay:.0f}s..."
                            )
                            if self.exit_cap:
                                self.exit_cap.release()
                                self.exit_cap = None
                            time.sleep(delay)
                            self.exit_cap = self._open_camera(
                                self.exit_source, 'EXIT CAMERA', max_attempts=1
                            )
                            if self.exit_cap:
                                exit_reconnects = 0
                                print("[EXIT] ✓ Reconnected")
                            exit_fail_count = 0

                # Check for quit
                if cv2.waitKey(1) & 0xFF == ord('q'):
                    break
                    
        except KeyboardInterrupt:
            print("\n[RECOGNITION] Interrupted by user")
        finally:
            self.cleanup()

    def cleanup(self):
        """Cleanup resources"""
        if self.entry_cap:
            self.entry_cap.release()
        if self.exit_cap:
            self.exit_cap.release()
        cv2.destroyAllWindows()
        self.db_handler.close()
        print("[RECOGNITION] Cleanup complete")


def main():
    parser = argparse.ArgumentParser(description='Dual Camera Face Recognition - DeepFace FaceNet')
    parser.add_argument('--zone', type=int, required=True, help='Zone ID to monitor')
    parser.add_argument('--entry-only', action='store_true', help='Only process entry camera')
    parser.add_argument('--exit-only', action='store_true', help='Only process exit camera')
    
    args = parser.parse_args()
    
    try:
        recognizer = DualCameraRecognizer(args.zone)
        recognizer.run(entry_only=args.entry_only, exit_only=args.exit_only)
    except Exception as e:
        print(f"[ERROR] {e}")
        return 1
    
    return 0


if __name__ == "__main__":
    exit(main())
