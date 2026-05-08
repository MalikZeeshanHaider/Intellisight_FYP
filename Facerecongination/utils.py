"""
IntelliSight - Utility Functions for DeepFace Face Recognition
Helper functions for logging, image processing, and file operations
"""

import os
import gc
import time
import threading
import cv2
import json
import logging
import base64
import numpy as np
from datetime import datetime
from pathlib import Path
from io import BytesIO
from PIL import Image

from config import DISTANCE_THRESHOLD

# ── Module-level CLAHE singleton ───────────────────────────────────────────────
# preprocess_face_crop is called once per face per frame (hot path: ~2 cameras
# × 3 faces × 10 AI fps = ~60 calls/s).  cv2.createCLAHE allocates a tile
# histogram buffer on every call — ~60 malloc/GC pairs per second.
# One module-level instance pays that cost exactly once at import time.
_CLAHE_L = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
# ─────────────────────────────────────────────────────────────────────────────

# ─── Canonical identity key ───────────────────────────────────────────────────
# Format : "{person_id}|{ROLE}|{Full Name}"
# Examples: "42|STUDENT|Ali Khan"   "7|TEACHER|Dr. Smith"
#
# Rules:
#   - person_id  : integer DB primary key
#   - ROLE       : always uppercase — "STUDENT" or "TEACHER"
#   - Full Name  : display name exactly as stored in the DB (may contain spaces)
#
# The separator "|" is split with maxsplit=2 so names that (rarely) contain "|"
# are preserved intact in the third segment.
# ─────────────────────────────────────────────────────────────────────────────
_KEY_SEP = "|"


def build_person_key(person_id: int, role: str, name: str) -> str:
    """
    Build canonical identity key.

    Args:
        person_id : integer DB primary key (Student_ID or Teacher_ID)
        role      : "STUDENT" or "TEACHER" (case-insensitive — normalised here)
        name      : full display name as stored in the DB

    Returns:
        str — e.g. "42|STUDENT|Ali Khan"
    """
    return f"{int(person_id)}{_KEY_SEP}{str(role).upper()}{_KEY_SEP}{name}"


def parse_person_key(person_key: str):
    """
    Parse canonical identity key back to its components.

    Args:
        person_key : string in the format produced by build_person_key()

    Returns:
        (person_id: int, role: str, name: str)
        or (None, None, None) when the format is invalid / unrecognised.
    """
    if not person_key or not isinstance(person_key, str):
        return None, None, None

    parts = person_key.split(_KEY_SEP, 2)

    if len(parts) != 3:
        return None, None, None

    try:
        person_id = int(parts[0])
        role = parts[1].upper()
        name = parts[2]
        return person_id, role, name
    except (ValueError, IndexError):
        return None, None, None

# Configure logging
def setup_logging(log_file: str = None, level: str = "INFO"):
    """Setup logging configuration"""
    if log_file is None:
        log_dir = os.path.join(os.path.dirname(__file__), "logs")
        os.makedirs(log_dir, exist_ok=True)
        log_file = os.path.join(log_dir, "system.log")
    else:
        os.makedirs(os.path.dirname(log_file), exist_ok=True)
    
    logging.basicConfig(
        level=getattr(logging, level.upper()),
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.FileHandler(log_file),
            logging.StreamHandler()
        ]
    )
    return logging.getLogger(__name__)

logger = setup_logging()


def decode_base64_image(base64_string):
    """
    Decode base64 image string to numpy array (OpenCV format)
    
    Args:
        base64_string: Base64 encoded image string
        
    Returns:
        numpy.ndarray: OpenCV image (BGR format) or None
    """
    try:
        # Remove data URL prefix if present
        if ',' in base64_string:
            base64_string = base64_string.split(',')[1]
        
        # Decode base64
        image_bytes = base64.b64decode(base64_string)
        
        # Convert to PIL Image
        pil_image = Image.open(BytesIO(image_bytes))
        
        # Convert to numpy array (RGB)
        np_image = np.array(pil_image)
        
        # Convert RGB to BGR for OpenCV
        if len(np_image.shape) == 3 and np_image.shape[2] == 3:
            return cv2.cvtColor(np_image, cv2.COLOR_RGB2BGR)
        elif len(np_image.shape) == 3 and np_image.shape[2] == 4:
            # RGBA to BGR
            return cv2.cvtColor(np_image, cv2.COLOR_RGBA2BGR)
        
        return np_image
        
    except Exception as e:
        logger.error(f"Error decoding base64 image: {e}")
        return None


def save_base64_image(base64_string, filepath):
    """
    Save base64 image to file
    
    Args:
        base64_string: Base64 encoded image string
        filepath: Path to save the image
        
    Returns:
        bool: Success status
    """
    try:
        # Ensure directory exists
        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        
        # Decode and save
        image = decode_base64_image(base64_string)
        if image is not None:
            cv2.imwrite(filepath, image)
            logger.info(f"Saved image to: {filepath}")
            return True
        return False
        
    except Exception as e:
        logger.error(f"Error saving base64 image: {e}")
        return False


def image_to_base64(image_path):
    """
    Convert image file to base64 string
    
    Args:
        image_path: Path to image file
        
    Returns:
        str: Base64 encoded string or None
    """
    try:
        with open(image_path, 'rb') as f:
            image_bytes = f.read()
        return base64.b64encode(image_bytes).decode('utf-8')
    except Exception as e:
        logger.error(f"Error converting image to base64: {e}")
        return None


def preprocess_face_crop(image):
    """
    Enhance a face image (crop or full frame) before embedding generation.

    Steps applied in order:
    1. Upscale — if height < 100 px, scale up using cubic interpolation so
       FaceNet receives enough detail for reliable embeddings.
    2. CLAHE — Contrast Limited Adaptive Histogram Equalization applied on the
       L channel (LAB colorspace) to recover detail in low-light conditions
       without blowing out well-lit areas.

    Args:
        image: BGR numpy array (face crop or full frame)

    Returns:
        Preprocessed BGR numpy array, or the original image if preprocessing
        fails for any reason.
    """
    if image is None or image.size == 0:
        return image

    try:
        h, w = image.shape[:2]

        # Step 1 — upscale small face crops
        if h < 100:
            scale = 100.0 / h
            image = cv2.resize(
                image,
                (max(1, int(w * scale)), 100),
                interpolation=cv2.INTER_CUBIC
            )

        # Step 2 — CLAHE on L channel (perceptual luminance)
        lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
        l, a, b = cv2.split(lab)
        l = _CLAHE_L.apply(l)   # module-level singleton — no per-call alloc
        image = cv2.cvtColor(cv2.merge([l, a, b]), cv2.COLOR_LAB2BGR)

    except Exception:
        pass  # Return whatever we have rather than crashing the pipeline

    return image


def get_euclidean_distance(emb1, emb2):
    """
    Calculate Euclidean distance between two embeddings
    
    Args:
        emb1: First embedding (list or numpy array)
        emb2: Second embedding (list or numpy array)
        
    Returns:
        float: Euclidean distance
    """
    return np.linalg.norm(np.array(emb1) - np.array(emb2))


class FaceTracker:
    """
    Track face identities across frames using IoU-based bounding-box matching
    with consecutive-frame voting (identity hysteresis).

    Workflow
    --------
    1. Each processed frame calls update() with all detected faces and their
       raw recognition result (person_dict | None).
    2. Identity hysteresis: a new identity only becomes the track's *confirmed*
       person after CONFIRM_FRAMES consecutive recognitions of the same person.
       Single-frame misidentifications (Ali → Ahmed → Ali) are suppressed.
    3. Before running expensive embedding extraction, call get_person_for_bbox()
       — if a confirmed cached identity is returned, skip DeepFace entirely.
    4. New or unmatched faces always go through full recognition.
    5. Tracks that receive no matching detection for max_age_seconds are evicted.

    Per-track state
    ---------------
    person          : confirmed identity dict (None until CONFIRM_FRAMES hit)
    candidate       : the identity being accumulated before confirmation
    candidate_count : consecutive frames the same candidate has been seen
    last_rerecog_time : wall-clock time of last ArcFace call for this track

    Thread-safe: all public methods acquire a threading.Lock.
    """

    def __init__(self, max_age_seconds: float = 2.0, max_cache: int = 100,
                 confirm_frames: int = 3):
        """
        Args:
            max_age_seconds : seconds without a match before a track is evicted
                              and re-recognition is forced (default 2 s).
            max_cache       : hard cap on simultaneous tracks to bound memory.
            confirm_frames  : consecutive recognitions of the same person before
                              the identity is locked in (default 3).  A value of
                              1 disables hysteresis (instant identity update).
        """
        self.tracks          = {}   # {track_id: track_dict}
        self.next_id         = 0
        self.max_age_seconds = max_age_seconds
        self.max_cache       = max_cache
        self.confirm_frames  = confirm_frames
        self.lock            = threading.Lock()

    # ── IoU helper ────────────────────────────────────────────────────────────

    @staticmethod
    def _iou(box1, box2):
        """Intersection-over-Union for (x, y, w, h) tuples."""
        x1 = max(box1[0], box2[0])
        y1 = max(box1[1], box2[1])
        x2 = min(box1[0] + box1[2], box2[0] + box2[2])
        y2 = min(box1[1] + box1[3], box2[1] + box2[3])
        if x2 <= x1 or y2 <= y1:
            return 0.0
        inter = (x2 - x1) * (y2 - y1)
        union = box1[2] * box1[3] + box2[2] * box2[3] - inter
        return inter / union if union > 0 else 0.0

    # ── Public API ────────────────────────────────────────────────────────────

    def update(self, detections, frame_count=None):
        """
        Match detections to existing tracks, apply identity hysteresis voting,
        and evict stale tracks.

        Identity hysteresis
        -------------------
        Each track holds two identity slots:

          person          — the *confirmed* identity, only updated once
                            `confirm_frames` consecutive recognitions of the
                            same candidate are observed.
          candidate       — the challenger being accumulated.
          candidate_count — consecutive frames the current candidate has been
                            seen without interruption.

        Transitions:
          • Same candidate as last frame  → candidate_count += 1
          • Different candidate           → candidate replaced, count reset to 1
          • candidate_count == confirm_frames → person = candidate (confirmed)
          • det['person'] is None         → candidate_count reset to 0
            (unknown frame resets accumulation but does NOT clear confirmed person)

        Args:
            detections  : list of dicts, each containing:
                            'bbox'       – (x, y, w, h)
                            'person'     – person_dict or None
                            'distance'   – float
                            'confidence' – float
            frame_count : optional int kept for call-site compatibility;
                          eviction is wall-clock based regardless.
        """
        now = time.time()

        with self.lock:
            # ── Match detections to existing tracks ───────────────────────────
            for det in detections:
                bbox      = det['bbox']
                det_person = det.get('person')
                best_id   = None
                best_iou  = 0.3  # minimum IoU to associate detection with track

                for tid, track in self.tracks.items():
                    iou = self._iou(bbox, track['bbox'])
                    if iou > best_iou:
                        best_iou = iou
                        best_id  = tid

                if best_id is not None:
                    track = self.tracks[best_id]
                    track['bbox']           = bbox
                    track['last_seen_time'] = now

                    # Always store a fresh smooth embedding when one is provided
                    if det.get('smooth_embedding') is not None:
                        track['smooth_embedding'] = det['smooth_embedding']

                    if det_person is not None:
                        # ── Hysteresis voting ─────────────────────────────────
                        # Determine whether the incoming person matches the
                        # current candidate (same person_key) or is a challenger.
                        det_key = (det_person.get('person_key') or
                                   f"{det_person.get('person_id')}|{det_person.get('role')}")
                        cand    = track.get('candidate')
                        cand_key = (cand.get('person_key') or
                                    f"{cand.get('person_id')}|{cand.get('role')}"
                                    if cand else None)

                        if cand_key == det_key:
                            # Same candidate — increment streak
                            track['candidate_count'] = track.get('candidate_count', 0) + 1
                        else:
                            # New challenger — reset accumulation
                            track['candidate']       = det_person
                            track['candidate_count'] = 1
                            track['candidate_dist']  = det.get('distance', 0)
                            track['candidate_conf']  = det.get('confidence', 0)

                        # Promote to confirmed identity once streak is reached
                        if track['candidate_count'] >= self.confirm_frames:
                            track['person']           = track['candidate']
                            track['distance']         = track.get('candidate_dist', 0)
                            track['confidence']       = track.get('candidate_conf', 0)
                            track['last_rerecog_time'] = now
                    else:
                        # Unrecognised frame — break accumulation streak but
                        # do NOT evict the confirmed person (they just moved).
                        track['candidate_count'] = 0

                else:
                    # New track — seed candidate; require confirm_frames before
                    # returning any identity from get_person_for_bbox().
                    is_confirmed = (self.confirm_frames <= 1 and det_person is not None)
                    self.tracks[self.next_id] = {
                        'bbox':             bbox,
                        'person':           det_person if is_confirmed else None,
                        'distance':         det.get('distance', 0) if is_confirmed else 0,
                        'confidence':       det.get('confidence', 0) if is_confirmed else 0,
                        'last_seen_time':   now,
                        'last_rerecog_time': now if is_confirmed else 0.0,
                        'candidate':        det_person,
                        'candidate_count':  1 if det_person is not None else 0,
                        'candidate_dist':   det.get('distance', 0),
                        'candidate_conf':   det.get('confidence', 0),
                        'smooth_embedding': det.get('smooth_embedding'),  # may be None
                    }
                    self.next_id += 1

            # ── Evict stale tracks (time-based) ───────────────────────────────
            stale = [tid for tid, t in self.tracks.items()
                     if now - t['last_seen_time'] > self.max_age_seconds]
            for tid in stale:
                del self.tracks[tid]

            # ── Enforce hard cache cap ────────────────────────────────────────
            if len(self.tracks) > self.max_cache:
                oldest = sorted(self.tracks.items(),
                                key=lambda kv: kv[1]['last_seen_time'])
                for tid, _ in oldest[:len(self.tracks) - self.max_cache]:
                    del self.tracks[tid]

    def get_person_for_bbox(self, bbox, iou_threshold: float = 0.5,
                            rerecog_interval: float = 0.0):
        """
        Return the cached identity for a detection bounding box.

        A stricter IoU threshold than update() (0.5 vs 0.3) is used to avoid
        accidentally serving one person's identity for a nearby face.

        Args:
            bbox               : (x, y, w, h) of the detected face
            iou_threshold      : minimum IoU required to accept a cached track
            rerecog_interval   : seconds after which the cached identity is
                                 considered stale — returns (None, None, None)
                                 to force a fresh ArcFace call.  0.0 = disabled.

        Returns:
            (person_dict, distance, confidence)  when a confirmed, fresh match exists
            (None, None, None)                   when no match, unconfirmed, or stale

        Note: only *confirmed* identities (those that have passed the
        consecutive-frame vote in update()) are returned.  Tracks where the
        candidate hasn't yet reached confirm_frames always return (None, None, None),
        causing the caller to run a fresh ArcFace call and feed the result back
        into the voting accumulator via update().
        """
        now = time.time()
        with self.lock:
            best_track = None
            best_iou   = iou_threshold

            for track in self.tracks.values():
                iou = self._iou(bbox, track['bbox'])
                # Only serve confirmed identities (person is not None)
                if iou > best_iou and track.get('person') is not None:
                    best_iou   = iou
                    best_track = track

            if best_track is None:
                return None, None, None

            # Force re-recognition after rerecog_interval seconds to prevent drift
            if (rerecog_interval > 0.0 and
                    now - best_track.get('last_rerecog_time', 0) > rerecog_interval):
                return None, None, None

            return (best_track['person'],
                    best_track.get('distance', 0),
                    best_track.get('confidence', 0))

    def get_smooth_embedding(self, bbox, iou_threshold: float = 0.3):
        """
        Return the stored smoothed embedding for a detection bbox.

        Used by the call site in _run_ai to seed EMA smoothing on the next
        ArcFace call for this track.  A looser IoU threshold (0.3) is intentional
        here — we only need positional proximity to retrieve the right track's
        embedding, not to confirm identity.

        Args:
            bbox          : (x, y, w, h) of the detected face
            iou_threshold : minimum IoU to accept a match (default 0.3)

        Returns:
            np.ndarray (512,) if a smoothed embedding exists for this bbox,
            None otherwise (new track or ArcFace has not yet run for it).
        """
        with self.lock:
            best_iou = iou_threshold
            best_emb = None
            for track in self.tracks.values():
                iou = self._iou(bbox, track['bbox'])
                if iou > best_iou and track.get('smooth_embedding') is not None:
                    best_iou = iou
                    best_emb = track['smooth_embedding']
            return best_emb

    def clear(self):
        """Evict all tracks (call on camera disconnect or service shutdown)."""
        with self.lock:
            self.tracks.clear()
            gc.collect()


class EmbeddingIndex:
    """
    Pre-built NumPy matrix for vectorized nearest-neighbour matching.

    Build once from embeddings_data at application startup; call search() or
    search_with_confidence() per recognition frame instead of looping through
    the raw list each time.

    Internals
    ---------
    _matrix     : (N, D) float32 array — one row per stored embedding vector
    _meta       : parallel list of N person dicts (person_id, name, role, person_key)
    _group_keys : parallel list of N "person_id|role" group-key strings

    A person enrolled with multiple training photos contributes multiple rows to
    the matrix but shares the same group_key.  search() keeps only the minimum
    distance per group before comparing against the threshold, so extra photos
    only help — they never inflate distances.
    """

    def __init__(self, embeddings_data):
        self._meta       = []
        self._group_keys = []
        vectors          = []

        for data in embeddings_data:
            if not isinstance(data, dict) or 'embedding' not in data:
                continue

            person_id  = data.get('person_id')
            role       = (data.get('role') or '').upper()
            # Fall back to legacy 'person' field (folder name) when 'name' is
            # absent — embeddings generated before the DB-sync enrichment step
            # only stored "person": folder_name, not the canonical "name" field.
            name       = data.get('name') or data.get('person', '')
            person_key = data.get('person_key') or data.get('person', '')

            group_key = (f"{person_id}|{role}"
                         if person_id is not None and role
                         else person_key or 'unknown')

            vectors.append(data['embedding'])
            self._meta.append({
                'person_id':  person_id,
                'name':       name,
                'role':       role,
                'person_key': person_key,
            })
            self._group_keys.append(group_key)

        if vectors:
            mat = np.array(vectors, dtype=np.float32)
            # L2-normalise rows so dot-product == cosine similarity
            norms = np.linalg.norm(mat, axis=1, keepdims=True)
            norms[norms == 0] = 1.0
            self._matrix = mat / norms
        else:
            self._matrix = np.empty((0, 0), dtype=np.float32)

    def __len__(self):
        return len(self._meta)

    def search(self, embedding, threshold=DISTANCE_THRESHOLD):
        """
        Vectorized nearest-neighbour search using cosine distance.

        Stored vectors are L2-normalised in __init__, so cosine distance is
        computed as: 1 - dot(normalised_query, normalised_stored_row).

        Args:
            embedding : query embedding (list or 1-D numpy array, 512-D ArcFace)
            threshold : max cosine distance to accept as a match (default 0.68)

        Returns:
            (person_dict | None, float distance)
        """
        if self._matrix.ndim < 2 or self._matrix.shape[0] == 0:
            return None, float('inf')

        query = np.array(embedding, dtype=np.float32)
        norm  = np.linalg.norm(query)
        if norm > 0:
            query = query / norm
        distances = 1.0 - (self._matrix @ query)    # cosine distance (N,)

        # Keep minimum distance per person group
        best_by_group = {}  # group_key → (min_dist, meta)
        for dist, gk, meta in zip(distances.tolist(), self._group_keys, self._meta):
            if gk not in best_by_group or dist < best_by_group[gk][0]:
                best_by_group[gk] = (dist, meta)

        if not best_by_group:
            return None, float('inf')

        best_dist, best_meta = min(best_by_group.values(), key=lambda x: x[0])

        if best_dist <= threshold:
            return best_meta, best_dist
        return None, best_dist

    def search_with_confidence(self, embedding, threshold=DISTANCE_THRESHOLD):
        """
        Vectorized search that also returns a confidence score in [0.0, 1.0].

        Confidence formula
        ------------------
            base       = max(0.0, 1 - min_distance / threshold)
            bonus      = min(0.15, extra_within_threshold * 0.05)
            confidence = min(1.0, base + bonus)

        The bonus rewards persons with multiple enrolled embeddings that all
        land inside threshold — rewarding consistent multi-angle enrolment.

        Args:
            embedding : query embedding (list or 1-D numpy array, 128-D)
            threshold : max euclidean distance to accept as a match

        Returns:
            (person_dict | None, float distance, float confidence)
        """
        if self._matrix.ndim < 2 or self._matrix.shape[0] == 0:
            return None, float('inf'), 0.0

        query = np.array(embedding, dtype=np.float32)
        norm  = np.linalg.norm(query)
        if norm > 0:
            query = query / norm
        distances = 1.0 - (self._matrix @ query)    # cosine distance (N,)

        # Accumulate per-group: min distance + count of embeddings within threshold
        groups = {}  # group_key → {'min': float, 'within': int, 'meta': dict}
        for dist, gk, meta in zip(distances.tolist(), self._group_keys, self._meta):
            if gk not in groups:
                groups[gk] = {'min': dist, 'within': 0, 'meta': meta}
            else:
                groups[gk]['min'] = min(groups[gk]['min'], dist)
            if dist < threshold:
                groups[gk]['within'] += 1

        if not groups:
            return None, float('inf'), 0.0

        best_gk    = min(groups, key=lambda k: groups[k]['min'])
        best_group = groups[best_gk]
        min_dist   = best_group['min']
        best_meta  = best_group['meta']

        if min_dist >= threshold:
            return None, min_dist, 0.0

        base       = max(0.0, 1.0 - (min_dist / threshold))
        bonus      = min(0.15, (best_group['within'] - 1) * 0.05)
        confidence = min(1.0, base + bonus)
        return best_meta, min_dist, confidence

    def search_with_vote(self, embedding, k: int = 5,
                         threshold: float = DISTANCE_THRESHOLD,
                         vote_min: int = 1,
                         margin: float = 0.08):
        """
        Top-K voting search with margin gate — more robust than single-NN.

        Algorithm
        ─────────
        1. Compute cosine distances for ALL stored embeddings (vectorized).
        2. Per-person best distance: each person's score = their closest embedding.
           This prevents persons with many enrolled images from dominating the vote
           via quantity alone.
        3. Find the K nearest embeddings across ALL persons (argpartition, O(N)).
        4. Count per-person votes: each unique person whose embedding appears in
           the top-K pool AND whose best distance ≤ threshold gets 1 vote.
        5. Winner = person with the most votes (tie-broken by lowest best-distance).
        6. Reject if winner_votes < vote_min (insufficient agreement).
        7. Reject if second-best person is also within threshold AND the distance
           gap (margin) < margin (ambiguous query — between two identities).
        8. Confidence = f(best_distance, vote_bonus).

        Why step 4 counts embedding-level votes but step 7 uses person-level
        best-distances for margin: the vote rewards persons who enrolled multiple
        diverse photos (more embeddings in top-K); the margin uses the actual
        nearest embedding per person so the gap is meaningful in distance space.

        Args:
            embedding  : query vector — (512,) float32 ArcFace, any normalisation
            k          : pool size (default 5 — tuned for 5 enrolled images/person)
            threshold  : cosine distance cutoff for accepting a match (default 0.68)
            vote_min   : minimum votes the winner must receive (default 1)
            margin     : minimum per-person cosine distance gap (default 0.08)

        Returns:
            (person_dict, distance, confidence)
            • person_dict — meta dict or None (no match / ambiguous / below threshold)
            • distance    — winner's best cosine distance (or best overall on reject)
            • confidence  — float in [0.0, 1.0]; 0.0 on any reject

        Example outputs
        ───────────────
        Clear match (enrolled Ali, query = Ali walking):
            ("Ali", 0.28, 0.82)   ← confident, large margin

        Ambiguous (query between Ali and Ahmed):
            (None, 0.39, 0.0)     ← margin gate fired; safe reject

        No enrolled person close enough:
            (None, 0.72, 0.0)     ← best dist > threshold
        """
        if self._matrix.ndim < 2 or self._matrix.shape[0] == 0:
            return None, float('inf'), 0.0

        # ── Step 1: L2-normalize query ────────────────────────────────────────
        query = np.array(embedding, dtype=np.float32)
        norm  = np.linalg.norm(query)
        if norm > 1e-9:
            query = query / norm

        # ── Step 2: Cosine distances for all stored embeddings ────────────────
        # Stored matrix is pre-normalised in __init__ so:
        #   cosine_distance = 1 - dot(query_unit, stored_unit)
        distances = 1.0 - (self._matrix @ query)   # (N,) float32

        # ── Step 3: Per-person best distance across ALL embeddings ────────────
        # This is the "ground truth" ranking used for margin check and threshold.
        best_by_group: dict = {}   # group_key → {'min_dist', 'meta', 'vote_count'}
        for dist, gk, meta in zip(distances.tolist(), self._group_keys, self._meta):
            if gk not in best_by_group:
                best_by_group[gk] = {'min_dist': dist, 'meta': meta, 'vote_count': 0}
            elif dist < best_by_group[gk]['min_dist']:
                best_by_group[gk]['min_dist'] = dist
                best_by_group[gk]['meta']     = meta  # track closest embedding's meta

        if not best_by_group:
            return None, float('inf'), 0.0

        # ── Step 4: Top-K nearest embeddings (partial sort, O(N)) ─────────────
        n        = len(distances)
        k_actual = min(k, n)
        if k_actual < n:
            # np.argpartition: O(N) — guarantees the k_actual smallest values are
            # in the first k_actual positions (unordered within that slice).
            top_k_idx = np.argpartition(distances, k_actual - 1)[:k_actual]
        else:
            top_k_idx = np.arange(n, dtype=np.intp)

        # ── Step 5: Vote counting — per-person, embedding-level pool ─────────
        # Each unique person whose embedding lands in top-K AND within threshold
        # gets exactly 1 vote increment.  A person can contribute at most
        # min(k, enrolled_images) votes — rewarding diverse multi-angle enrolment.
        vote_counts: dict = {}   # group_key → int
        for idx in top_k_idx:
            dist = float(distances[idx])
            if dist > threshold:
                continue   # outside threshold — no vote
            gk = self._group_keys[idx]
            vote_counts[gk] = vote_counts.get(gk, 0) + 1

        # Merge vote counts back into best_by_group
        for gk, vc in vote_counts.items():
            best_by_group[gk]['vote_count'] = vc

        # ── Step 6: Find winner (max votes, tie-break = min distance) ─────────
        # Build candidate list only for persons that meet vote_min.
        candidates = [
            data for data in best_by_group.values()
            if data['vote_count'] >= vote_min
        ]

        if not candidates:
            # Nobody reached vote_min — return best distance for diagnostics.
            best_dist_global = min(d['min_dist'] for d in best_by_group.values())
            return None, best_dist_global, 0.0

        winner = max(candidates, key=lambda d: (d['vote_count'], -d['min_dist']))
        winner_dist = winner['min_dist']
        winner_meta = winner['meta']

        # ── Step 7: Threshold gate ─────────────────────────────────────────────
        if winner_dist > threshold:
            return None, winner_dist, 0.0

        # ── Step 8: Margin gate (person-level best distances) ─────────────────
        # Sort all enrolled persons by their best distance; if the runner-up is
        # also within threshold and the gap is too small, reject as ambiguous.
        #
        # CRITICAL: winner_gk MUST match the format used in self._group_keys
        # (built in __init__).  That format is "person_id|role" — NOT the full
        # "person_id|role|name" person_key.  If we use person_key here, the
        # winner's own group is never matched in the loop below, the winner
        # gets compared against itself as the "runner-up" with gap=0, and the
        # margin gate rejects every match as ambiguous.
        wp_id   = winner_meta.get('person_id')
        wp_role = (winner_meta.get('role') or '').upper()
        winner_gk = (f"{wp_id}|{wp_role}"
                     if wp_id is not None and wp_role
                     else (winner_meta.get('person_key') or 'unknown'))
        runner_up_dist = float('inf')
        for gk, data in best_by_group.items():
            if gk != winner_gk and data['min_dist'] <= threshold:
                if data['min_dist'] < runner_up_dist:
                    runner_up_dist = data['min_dist']

        if runner_up_dist <= threshold:
            gap = runner_up_dist - winner_dist
            if gap < margin:
                # Query sits between two enrolled identities — reject.
                return None, winner_dist, 0.0

        # ── Step 9: Confidence score ───────────────────────────────────────────
        base        = max(0.0, 1.0 - winner_dist / threshold)
        vote_bonus  = min(0.15, (winner['vote_count'] - 1) * 0.05)
        confidence  = min(1.0, base + vote_bonus)

        return winner_meta, winner_dist, confidence


def find_best_match(embedding, embeddings_data, threshold=DISTANCE_THRESHOLD):
    """
    Find the best matching person for a query embedding.

    Accepts either an EmbeddingIndex (fast — matrix already built) or a plain
    list of embedding dicts (convenience — builds a transient index internally,
    still vectorized).

    Args:
        embedding      : query face embedding (128-D FaceNet vector)
        embeddings_data: EmbeddingIndex built at startup, or list of dicts with
                         'embedding', 'person_id', 'role', 'name', 'person_key'
        threshold      : max euclidean distance to accept as a match

    Returns:
        (person_dict | None, float distance)
            person_dict = {'person_id': int, 'name': str, 'role': str, 'person_key': str}
    """
    if isinstance(embeddings_data, EmbeddingIndex):
        return embeddings_data.search(embedding, threshold)
    # Legacy list path — build a transient index; still vectorized, just not cached
    return EmbeddingIndex(embeddings_data).search(embedding, threshold)


def create_person_folder(images_folder, person_type, person_id):
    """
    Create folder for a person's training images
    
    Args:
        images_folder: Base images folder path
        person_type: 'student' or 'teacher'
        person_id: Person's database ID
        
    Returns:
        str: Path to created folder
    """
    folder_name = f"{person_type.lower()}_{person_id}"
    folder_path = os.path.join(images_folder, folder_name)
    os.makedirs(folder_path, exist_ok=True)
    return folder_path


def save_person_images(images_folder, person_type, person_id, person_name, face_pictures):
    """
    Save person's face pictures to training folder
    
    Args:
        images_folder: Base images folder path
        person_type: 'student' or 'teacher'
        person_id: Person's database ID
        person_name: Person's name (for folder naming)
        face_pictures: Dict of face pictures (Face_Picture_1, etc.)
        
    Returns:
        list: List of saved image paths
    """
    # Create folder using name for readability
    folder_name = person_name.replace(' ', '_') if person_name else f"{person_type}_{person_id}"
    folder_path = os.path.join(images_folder, folder_name)
    os.makedirs(folder_path, exist_ok=True)
    
    saved_paths = []
    
    for i in range(1, 6):
        key = f'Face_Picture_{i}'
        if key in face_pictures and face_pictures[key]:
            filepath = os.path.join(folder_path, f"image_{i}.jpg")
            if save_base64_image(face_pictures[key], filepath):
                saved_paths.append(filepath)
    
    logger.info(f"Saved {len(saved_paths)} images for {person_name} to {folder_path}")
    return saved_paths


def load_embeddings_from_json(embeddings_file):
    """
    Load embeddings from JSON file
    
    Args:
        embeddings_file: Path to embeddings JSON file
        
    Returns:
        list: List of embedding dicts or empty list
    """
    try:
        if os.path.exists(embeddings_file):
            with open(embeddings_file, 'r') as f:
                return json.load(f)
    except Exception as e:
        logger.error(f"Error loading embeddings: {e}")
    return []


def save_embeddings_to_json(embeddings_data, embeddings_file):
    """
    Save embeddings to JSON file.
    Each entry stores person_id, name, role as explicit fields so that
    recognition code can use them directly without string parsing.

    Args:
        embeddings_data: List of embedding dicts
        embeddings_file: Path to save file

    Returns:
        bool: Success status
    """
    try:
        serializable_data = []
        for item in embeddings_data:
            emb = item["embedding"]
            serializable_data.append({
                "person_id":  item.get("person_id"),
                "name":       item.get("name") or item.get("person", ""),
                "role":       item.get("role", ""),
                "person_key": item.get("person_key", ""),
                "image":      item.get("image", ""),
                "image_path": item.get("image_path", ""),
                "embedding":  emb if isinstance(emb, list) else emb.tolist()
            })

        os.makedirs(os.path.dirname(embeddings_file), exist_ok=True)

        with open(embeddings_file, 'w') as f:
            json.dump(serializable_data, f, indent=2)

        logger.info(f"Saved {len(serializable_data)} embeddings to {embeddings_file}")
        return True

    except Exception as e:
        logger.error(f"Error saving embeddings: {e}")
        return False


class FPSCounter:
    """Helper class to calculate FPS"""
    
    def __init__(self, avg_frames=30):
        self.avg_frames = avg_frames
        self.frame_times = []
        self.last_time = None
    
    def update(self):
        """Update FPS counter with current frame"""
        current_time = datetime.now()
        
        if self.last_time is not None:
            frame_time = (current_time - self.last_time).total_seconds()
            self.frame_times.append(frame_time)
            
            if len(self.frame_times) > self.avg_frames:
                self.frame_times.pop(0)
        
        self.last_time = current_time
    
    def get_fps(self):
        """Get current FPS"""
        if not self.frame_times:
            return 0.0
        avg_time = sum(self.frame_times) / len(self.frame_times)
        return 1.0 / avg_time if avg_time > 0 else 0.0


def draw_face_box(frame, x, y, w, h, name, color=(0, 255, 0), thickness=2):
    """
    Draw face bounding box with name label
    
    Args:
        frame: OpenCV frame
        x, y, w, h: Bounding box coordinates
        name: Person name to display
        color: Box color (BGR)
        thickness: Line thickness
    """
    cv2.rectangle(frame, (x, y), (x+w, y+h), color, thickness)
    
    # Draw label background
    label = name
    font = cv2.FONT_HERSHEY_SIMPLEX
    font_scale = 0.6
    label_size = cv2.getTextSize(label, font, font_scale, 2)[0]
    
    cv2.rectangle(frame, (x, y-25), (x + label_size[0] + 10, y), color, -1)
    cv2.putText(frame, label, (x+5, y-7), font, font_scale, (255, 255, 255), 2)


def draw_info_panel(frame, info_lines, position=(10, 30)):
    """
    Draw info panel with multiple lines
    
    Args:
        frame: OpenCV frame
        info_lines: List of strings to display
        position: Starting position (x, y)
    """
    x, y = position
    font = cv2.FONT_HERSHEY_SIMPLEX
    font_scale = 0.6
    color = (255, 255, 255)
    thickness = 2
    line_height = 25
    
    for i, line in enumerate(info_lines):
        cv2.putText(frame, line, (x, y + i * line_height), 
                   font, font_scale, color, thickness)
