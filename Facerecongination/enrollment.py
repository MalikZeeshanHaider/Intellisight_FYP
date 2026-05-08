"""
IntelliSight - Face Enrollment Pipeline v2

Redesigned for accuracy:
  • Quality gate  — rejects blurry, dark, or low-confidence images before
                    generating embeddings.  A bad enrollment image permanently
                    corrupts the embedding index; prevention is cheaper than cure.
  • Diversity check — rejects near-duplicate poses (cosine dist < 0.12) so
                    each stored embedding covers a distinct region of the
                    embedding sphere rather than clustering in the same spot.
  • Centroid embedding — arithmetic mean of all accepted embeddings, L2-normalised.
                    Sits at the densest point of the person's cluster; most stable
                    single-point representation for nearest-neighbour search.
  • Quality metadata — QualityScore, IsCentroid, SourceImageIndex stored per row
                    in FaceEmbeddings so embeddings can be ranked/pruned later.

CLI usage (unchanged from v1):
    python enrollment.py --type student --id 1
    python enrollment.py --type teacher --id 2
    python enrollment.py --all
    python enrollment.py --train
"""

import os
import gc
import json
import argparse
import cv2
import numpy as np

from deepface import DeepFace
from database_handler import DatabaseHandler
from config import (
    MODEL_NAME, DETECTOR_BACKEND,
    IMAGES_FOLDER, EMBEDDINGS_FOLDER, EMBEDDINGS_FILE,
    MIN_FACE_SIZE,
)
from utils import (
    setup_logging, decode_base64_image, save_base64_image,
    save_embeddings_to_json, create_person_folder, preprocess_face_crop,
    build_person_key,
)

logger = setup_logging()

# ── Enrollment-specific thresholds ────────────────────────────────────────────
# Tuned for real-world dashboard uploads: JPEG-compressed selfies and webcam
# shots score lower on sharpness and detector confidence than ideal studio
# photos, so thresholds are intentionally lenient here.

MIN_ENROLLMENT_QUALITY = 0.20  # composite score — raised from 0.40; JPEG photos score ~0.25–0.45
DIVERSITY_MIN_DISTANCE = 0.12  # cosine dist — closer than this = redundant pose
SHARPNESS_STILL        = 20.0  # Laplacian variance — JPEG compression halves this vs raw
MIN_DETECT_CONF        = 0.25  # min yunet/opencv detection confidence (was hardcoded 0.50)
MAX_INDIVIDUAL_EMBEDS  = 6     # max individual (non-centroid) embeddings per person
# ─────────────────────────────────────────────────────────────────────────────


# ── Quality scoring ────────────────────────────────────────────────────────────

def score_enrollment_image(bgr_image: np.ndarray) -> tuple:
    """
    Score a still-photo enrollment image and return the face crop.

    Runs face detection + four photometric gates.  Face detection is mandatory
    at enrollment (unlike live frames where we skip re-detection on a tight
    crop) — an enrollment image that YuNet can't find a face in is useless.

    Returns
    -------
    (score, face_crop, detect_conf, reject_reason, metrics)
      score         : float 0.0–1.0 — composite quality score
      face_crop     : BGR uint8 np.ndarray | None — tight face crop, or None on hard fail
      detect_conf   : float — YuNet detection confidence
      reject_reason : str — non-empty if score < MIN_ENROLLMENT_QUALITY
      metrics       : dict with 'brightness', 'contrast', 'sharpness', 'detect_conf'

    Score formula
    -------------
      sharpness_score  = min(1, laplacian_var / SHARPNESS_STILL)
      brightness_score = 1 - |mean - 127.5| / 127.5   (penalises dark AND overexposed)
      contrast_score   = min(1, std / 45)
      composite        = 0.35 * sharpness + 0.25 * detect_conf
                       + 0.20 * brightness + 0.20 * contrast
    """
    metrics = {'brightness': 0.0, 'contrast': 0.0, 'sharpness': 0.0, 'detect_conf': 0.0}

    if bgr_image is None or bgr_image.size == 0:
        return 0.0, None, 0.0, 'empty_image', metrics

    # ── Step 1: face detection (mandatory at enrollment) ──────────────────────
    # Try the primary detector first; fall back to opencv Haar cascade if it
    # returns no faces or gives very low confidence on a still photo.
    faces = []
    _used_backend = DETECTOR_BACKEND
    for _backend in ([DETECTOR_BACKEND] if DETECTOR_BACKEND != 'opencv' else []) + ['opencv']:
        try:
            _result = DeepFace.extract_faces(
                img_path=bgr_image,
                detector_backend=_backend,
                enforce_detection=False,
                align=False,
            )
            if _result:
                best_candidate = max(_result, key=lambda f: f.get('confidence', 0))
                if float(best_candidate.get('confidence', 0) or 0) >= MIN_DETECT_CONF:
                    faces = _result
                    _used_backend = _backend
                    break
                elif not faces:
                    # Keep the best result even if conf is low; may improve later
                    faces = _result
                    _used_backend = _backend
        except Exception as _e:
            pass  # try next backend

    if not faces:
        return 0.0, None, 0.0, 'no_face_detected', metrics

    # Pick highest-confidence face
    best        = max(faces, key=lambda f: f.get('confidence', 0))
    detect_conf = float(best.get('confidence', 0) or 0)
    metrics['detect_conf'] = round(detect_conf, 3)

    if detect_conf < MIN_DETECT_CONF:
        return 0.0, None, detect_conf, f'low_detect_conf({detect_conf:.2f})', metrics

    # Extract + convert crop (DeepFace ≥0.0.79 returns float32 RGB)
    face_arr = best.get('face')
    if face_arr is None or face_arr.size == 0:
        return 0.0, None, detect_conf, 'no_crop_returned', metrics

    if face_arr.dtype != np.uint8:
        face_arr = (face_arr * 255).clip(0, 255).astype(np.uint8)
        face_arr = cv2.cvtColor(face_arr, cv2.COLOR_RGB2BGR)

    h, w = face_arr.shape[:2]
    if h < MIN_FACE_SIZE or w < MIN_FACE_SIZE:
        return 0.0, None, detect_conf, f'crop_too_small({w}×{h})', metrics

    # ── Step 2: photometric gates on the face crop ─────────────────────────────
    gray       = cv2.cvtColor(face_arr, cv2.COLOR_BGR2GRAY)
    brightness = float(gray.mean())
    contrast   = float(gray.std())

    thumb     = cv2.resize(gray, (64, 64), interpolation=cv2.INTER_AREA)
    sharpness = float(cv2.Laplacian(thumb, cv2.CV_64F).var())

    metrics['brightness'] = round(brightness, 1)
    metrics['contrast']   = round(contrast, 1)
    metrics['sharpness']  = round(sharpness, 1)

    # Normalise each component to [0, 1]
    sharpness_score  = min(1.0, sharpness / SHARPNESS_STILL)
    brightness_score = max(0.0, 1.0 - abs(brightness - 127.5) / 127.5)
    contrast_score   = min(1.0, contrast / 45.0)

    # Weighted composite
    score = (0.35 * sharpness_score +
             0.25 * detect_conf +
             0.20 * brightness_score +
             0.20 * contrast_score)

    if score < MIN_ENROLLMENT_QUALITY:
        if sharpness_score < 0.30:
            reason = f'blurry(shp={sharpness:.0f},need≥{SHARPNESS_STILL:.0f})'
        elif brightness_score < 0.30:
            reason = f'lighting(brt={brightness:.0f},ideal≈128)'
        elif contrast_score < 0.30:
            reason = f'low_contrast(std={contrast:.0f},need≥45)'
        else:
            reason = f'low_quality(score={score:.2f},need≥{MIN_ENROLLMENT_QUALITY})'
        return score, face_arr, detect_conf, reason, metrics

    return score, face_arr, detect_conf, '', metrics


# ── Diversity check ────────────────────────────────────────────────────────────

def is_diverse(new_emb: np.ndarray,
               accepted_embs: list,
               threshold: float = DIVERSITY_MIN_DISTANCE) -> tuple:
    """
    True if new_emb is sufficiently different from all already-accepted embeddings.

    Two embeddings closer than `threshold` cosine distance represent the same
    pose/expression and add no new information to the index.

    ArcFace cosine distance reference (same person):
      0.02–0.08  identical pose / same image re-encoded
      0.08–0.14  same expression, minor lighting change  ← reject as duplicate
      0.15–0.25  slight head turn (5–15°)                ← accept as diverse
      0.25–0.40  moderate turn or expression change      ← clearly diverse

    Returns (is_diverse: bool, nearest_dist: float | None)
    """
    if not accepted_embs:
        return True, None

    a = np.array(new_emb, dtype=np.float32)
    norm_a = np.linalg.norm(a)
    if norm_a < 1e-9:
        return False, None
    a = a / norm_a

    min_dist = float('inf')
    for existing in accepted_embs:
        b      = np.array(existing, dtype=np.float32)
        norm_b = np.linalg.norm(b)
        if norm_b < 1e-9:
            continue
        b    = b / norm_b
        dist = float(1.0 - np.dot(a, b))   # cosine distance
        if dist < min_dist:
            min_dist = dist

    return min_dist >= threshold, min_dist if min_dist != float('inf') else None


# ── Centroid computation ───────────────────────────────────────────────────────

def compute_centroid(embeddings: list) -> np.ndarray:
    """
    L2-normalised arithmetic mean of a set of ArcFace embeddings.

    The centroid sits at the densest point of a person's embedding cluster —
    it is the most stable single-point representation for nearest-neighbour
    search.  With only 1 embedding it is trivially that embedding (still
    useful as the normalisation step ensures a clean unit vector).

    The mean is computed in unnormalised space first, then normalised once —
    this is mathematically equivalent to the Fréchet mean on the unit sphere
    for small inter-embedding angles (which is always the case for same-person
    ArcFace embeddings, where distances are typically < 0.40).
    """
    matrix  = np.array(embeddings, dtype=np.float32)    # (N, 512)
    mean_v  = matrix.mean(axis=0)                        # (512,)
    norm    = float(np.linalg.norm(mean_v))
    return mean_v / norm if norm > 1e-9 else mean_v


# ── Raw embedding extraction ───────────────────────────────────────────────────

def _extract_embedding(face_crop: np.ndarray) -> list | None:
    """
    Generate a 512-D ArcFace embedding for a tight face crop.

    Pipeline (matches camera_streaming_service._get_raw_embedding exactly):
      1. CLAHE contrast enhancement on L channel (preprocess_face_crop)
      2. Resize to 112×112 (ArcFace canonical input) via INTER_LINEAR
      3. DeepFace.represent with detector_backend='skip' and align=False

    Returns a plain Python list[float] (JSON-serialisable), or None on failure.
    """
    if face_crop is None or face_crop.size == 0:
        return None

    try:
        processed = preprocess_face_crop(face_crop)
        resized   = cv2.resize(processed, (112, 112), interpolation=cv2.INTER_LINEAR)

        result = DeepFace.represent(
            img_path=resized,
            model_name=MODEL_NAME,
            detector_backend='skip',
            enforce_detection=False,
            align=False,
        )

        if result and len(result) > 0:
            emb = result[0]['embedding']
            return list(emb) if not isinstance(emb, list) else emb

    except Exception as e:
        logger.error(f"Embedding extraction error: {e}")

    return None


# ── Core enrollment pipeline ───────────────────────────────────────────────────

def _run_enrollment_pipeline(images_with_meta: list) -> dict:
    """
    Run the full quality → diversity → centroid pipeline on a batch of images.

    Parameters
    ----------
    images_with_meta : list of (source_index, bgr_image) tuples
        source_index : int | None — Face_Picture_N slot number (1–5), or None for files
        bgr_image    : BGR uint8 numpy array

    Returns
    -------
    dict with keys:
        'enriched'  : list of enriched embedding dicts (ready for save_face_embeddings_v2)
        'accepted'  : int — number of accepted individual embeddings
        'log'       : list of per-image result strings (for pretty printing)
        'error'     : str | None — fatal error message, or None on success
    """
    result_log   = []
    accepted_embs  = []     # raw embedding vectors that passed all gates
    accepted_meta  = []     # (quality_score, source_index) parallel to accepted_embs

    for src_idx, bgr_image in images_with_meta:
        label = f"Image {src_idx}" if src_idx is not None else "Image"

        # Gate 1: quality score
        score, crop, detect_conf, reason, metrics = score_enrollment_image(bgr_image)

        if reason:
            result_log.append(f"  {label}: score={score:.2f} ✗ REJECTED ({reason})")
            continue

        # Gate 2: embedding extraction
        emb = _extract_embedding(crop)
        if emb is None:
            result_log.append(f"  {label}: score={score:.2f} ✗ REJECTED (embedding failed)")
            continue

        # Gate 3: diversity check
        diverse, nearest = is_diverse(emb, accepted_embs)
        if not diverse:
            result_log.append(
                f"  {label}: score={score:.2f} ✗ REJECTED "
                f"(duplicate, dist={nearest:.3f}<{DIVERSITY_MIN_DISTANCE})"
            )
            continue

        # Accepted
        accepted_embs.append(emb)
        accepted_meta.append((score, src_idx))
        dist_str = f", nearest_dist={nearest:.3f}" if nearest is not None else " (first)"
        result_log.append(
            f"  {label}: score={score:.2f} ✓ ACCEPTED"
            f" (shp={metrics['sharpness']:.0f} brt={metrics['brightness']:.0f}"
            f" conf={detect_conf:.2f}{dist_str})"
        )

        # Cap individual embeddings at MAX_INDIVIDUAL_EMBEDS
        if len(accepted_embs) >= MAX_INDIVIDUAL_EMBEDS:
            result_log.append(f"  (max {MAX_INDIVIDUAL_EMBEDS} embeddings reached — stopping)")
            break

    if not accepted_embs:
        return {
            'enriched': [], 'accepted': 0, 'log': result_log,
            'error': 'No images passed quality + diversity gates',
        }

    # Build centroid
    centroid_emb = compute_centroid(accepted_embs)

    # Build enriched list: individual embeddings + centroid
    enriched = []
    for emb, (quality, src_idx) in zip(accepted_embs, accepted_meta):
        enriched.append({
            'embedding':          emb,
            'quality_score':      round(quality, 4),
            'is_centroid':        False,
            'source_image_index': src_idx,
        })

    enriched.append({
        'embedding':          centroid_emb.tolist(),
        'quality_score':      None,   # centroid has no single source quality
        'is_centroid':        True,
        'source_image_index': None,
    })

    result_log.append(
        f"  Centroid computed from {len(accepted_embs)} embedding(s)"
    )

    return {
        'enriched': enriched,
        'accepted': len(accepted_embs),
        'log':      result_log,
        'error':    None,
    }


# ── Public API ─────────────────────────────────────────────────────────────────

def enroll_person_from_database(person_id, person_type, db_handler) -> bool:
    """
    Enroll a single person using their Face_Picture_1–5 images from the database.

    Runs the full quality → diversity → centroid pipeline and saves results via
    db_handler.save_face_embeddings_v2().  Prints a per-image breakdown so
    operators can see exactly which images were accepted, rejected, and why.

    Returns True on success (at least 1 embedding saved), False on failure.
    """
    person_data = db_handler.get_person_images(person_id, person_type)
    if not person_data:
        print(f"[ERROR] {person_type} ID={person_id} not found in database")
        return False

    name = person_data.get('Name') or f"{person_type}_{person_id}"
    print(f"\n{'='*60}")
    print(f"[ENROLLING] {name}  ({person_type} ID={person_id})")
    print(f"{'='*60}")

    # Collect (slot_index, decoded_image) pairs from Face_Picture_1..5
    images_with_meta = []
    for i in range(1, 6):
        pic_b64 = person_data.get(f'Face_Picture_{i}')
        if not pic_b64:
            continue
        bgr = decode_base64_image(pic_b64)
        if bgr is not None:
            images_with_meta.append((i, bgr))

    if not images_with_meta:
        print(f"[ERROR] No face pictures found for {name}")
        return False

    print(f"  Source images: {len(images_with_meta)}")

    result = _run_enrollment_pipeline(images_with_meta)

    # Print per-image breakdown
    for line in result['log']:
        print(line)

    if result['error']:
        print(f"\n[FAILED] {name}: {result['error']}")
        return False

    ok = db_handler.save_face_embeddings_v2(
        person_id, person_type, result['enriched'], person_name=name
    )

    if ok:
        print(f"\n[OK] {name}: {result['accepted']} embedding(s) + 1 centroid saved")
    else:
        print(f"\n[ERROR] {name}: database write failed")

    return ok


def reset_all_embeddings(db_handler) -> None:
    """
    Wipe every embedding from the system so a clean re-enroll can start.

    Clears:
      1. FaceEmbeddings table — all rows
      2. Face_Embeddings pickle column on Students and Teacher tables — set to NULL
      3. Embeddings JSON cache file — reset to empty list
    """
    from psycopg2.extras import RealDictCursor

    print(f"\n{'='*50}")
    print("CLEARING ALL EMBEDDINGS")
    print(f"{'='*50}")

    with db_handler.conn.cursor() as cur:
        cur.execute('DELETE FROM "FaceEmbeddings"')
        cur.execute('UPDATE "Students" SET "Face_Embeddings" = NULL')
        cur.execute('UPDATE "Teacher"  SET "Face_Embeddings" = NULL')
    db_handler.conn.commit()
    print("  ✓ FaceEmbeddings table cleared")
    print("  ✓ Students.Face_Embeddings reset to NULL")
    print("  ✓ Teacher.Face_Embeddings reset to NULL")

    # Reset the JSON cache so the camera service doesn't load stale data
    try:
        import json as _json
        os.makedirs(os.path.dirname(EMBEDDINGS_FILE), exist_ok=True)
        with open(EMBEDDINGS_FILE, 'w') as f:
            _json.dump([], f)
        print(f"  ✓ JSON cache cleared ({EMBEDDINGS_FILE})")
    except Exception as e:
        print(f"  [WARN] Could not clear JSON cache: {e}")

    print(f"{'='*50}\n")


def enroll_all_from_database(db_handler, force: bool = False) -> None:
    """
    Enroll all students and teachers that have face pictures.

    Args:
        force: If True, re-enroll even persons who already have embeddings.
               If False (default), skip persons where Face_Embeddings IS NOT NULL.
    """
    from psycopg2.extras import RealDictCursor

    enrolled = 0

    for label, table, id_col in [
        ('STUDENTS', '"Students"', '"Student_ID"'),
        ('TEACHERS', '"Teacher"',  '"Teacher_ID"'),
    ]:
        print(f"\n{'='*50}\nENROLLING {label}\n{'='*50}")

        with db_handler.conn.cursor(cursor_factory=RealDictCursor) as cur:
            null_check = '' if force else 'WHERE "Face_Embeddings" IS NULL AND'
            where_clause = (
                f'WHERE ('
                '"Face_Picture_1" IS NOT NULL OR "Face_Picture_2" IS NOT NULL OR '
                '"Face_Picture_3" IS NOT NULL OR "Face_Picture_4" IS NOT NULL OR '
                '"Face_Picture_5" IS NOT NULL'
                ')'
            ) if force else (
                'WHERE "Face_Embeddings" IS NULL AND ('
                '"Face_Picture_1" IS NOT NULL OR "Face_Picture_2" IS NOT NULL OR '
                '"Face_Picture_3" IS NOT NULL OR "Face_Picture_4" IS NOT NULL OR '
                '"Face_Picture_5" IS NOT NULL'
                ')'
            )
            cur.execute(f'SELECT {id_col} AS pid FROM {table} {where_clause}')
            rows = cur.fetchall()

        print(f"Found {len(rows)} {label.lower()} to enroll")
        person_type = 'Teacher' if label == 'TEACHERS' else 'Student'

        for row in rows:
            pid = row['pid']
            if enroll_person_from_database(pid, person_type, db_handler):
                enrolled += 1

    print(f"\n{'='*50}\nENROLLMENT COMPLETE: {enrolled} person(s) enrolled\n{'='*50}")


# ── Folder-based training (unchanged API) ──────────────────────────────────────

def train_from_images_folder() -> bool:
    """
    Generate embeddings from images/<person_name>/ folder structure.

    Each image goes through the same quality gate as database enrollment.
    Poor-quality images are skipped with a warning rather than generating
    bad embeddings.  A centroid per person is also computed and saved.
    """
    print(f"\n{'='*60}")
    print("FACE RECOGNITION TRAINING - ArcFace Model (v2)")
    print(f"{'='*60}\n")

    if not os.path.exists(IMAGES_FOLDER):
        print(f"✗ ERROR: '{IMAGES_FOLDER}' folder not found!")
        return False

    person_folders = [
        f for f in os.listdir(IMAGES_FOLDER)
        if os.path.isdir(os.path.join(IMAGES_FOLDER, f))
    ]

    if not person_folders:
        print(f"✗ No person folders found in '{IMAGES_FOLDER}'")
        return False

    print(f"✓ Found {len(person_folders)} person folder(s)\n")

    embeddings_data = []
    total_accepted  = 0
    total_rejected  = 0

    for person_name in sorted(person_folders):
        person_path = os.path.join(IMAGES_FOLDER, person_name)
        image_files = [
            f for f in os.listdir(person_path)
            if f.lower().endswith(('.jpg', '.jpeg', '.png'))
        ]

        if not image_files:
            print(f"  {person_name}: no images — skipping")
            continue

        print(f"Processing: {person_name}  ({len(image_files)} image(s))")

        images_with_meta = []
        for fname in sorted(image_files):
            fpath = os.path.join(person_path, fname)
            bgr   = cv2.imread(fpath)
            if bgr is not None:
                images_with_meta.append((fname, bgr))
            else:
                print(f"  ✗ {fname}: cannot read file")

        result = _run_enrollment_pipeline(images_with_meta)

        for line in result['log']:
            print(line)

        if result['error']:
            print(f"  [SKIP] {person_name}: {result['error']}\n")
            total_rejected += len(images_with_meta)
            continue

        # Flatten to the JSON format expected by save_embeddings_to_json / DB sync
        for item in result['enriched']:
            embeddings_data.append({
                'person':      person_name,
                'embedding':   item['embedding'],
                'is_centroid': item['is_centroid'],
                'quality':     item['quality_score'],
            })

        total_accepted += result['accepted']
        total_rejected += (len(images_with_meta) - result['accepted'])
        print()

        if len(embeddings_data) % 20 == 0:
            gc.collect()

    if not embeddings_data:
        print("✗ ERROR: No embeddings generated.")
        return False

    save_embeddings_to_json(embeddings_data, EMBEDDINGS_FILE)

    try:
        from train import sync_embeddings_to_database
        synced, unlinked = sync_embeddings_to_database(embeddings_data)
    except Exception as e:
        print(f"[WARNING] DB sync failed: {e}")
        synced, unlinked = 0, len(embeddings_data)

    print(f"\n{'='*60}\nTRAINING COMPLETE\n{'='*60}")
    print(f"  Accepted: {total_accepted}  |  Rejected: {total_rejected}")
    print(f"  Embeddings saved: {len(embeddings_data)} (includes centroids)")
    print(f"  Synced to DB: {synced}  |  Unlinked: {unlinked}")
    print(f"  Output: {EMBEDDINGS_FILE}\n")
    gc.collect()
    return True


# ── Legacy helpers (kept for import compatibility) ─────────────────────────────

def generate_embedding_from_base64(base64_string):
    """Single-image embedding — retained for backward compatibility."""
    bgr = decode_base64_image(base64_string)
    if bgr is None:
        return None
    score, crop, _, reason, _ = score_enrollment_image(bgr)
    if reason:
        logger.warning(f"generate_embedding_from_base64: image rejected ({reason})")
        return None
    return _extract_embedding(crop)


def generate_embeddings_from_images(image_paths):
    """Batch embedding from file paths — retained for backward compatibility."""
    embeddings = []
    for idx, path in enumerate(image_paths):
        if not os.path.exists(path):
            continue
        bgr = cv2.imread(path)
        if bgr is None:
            print(f"  ✗ {path}: cannot read")
            continue
        score, crop, _, reason, _ = score_enrollment_image(bgr)
        if reason:
            print(f"  ✗ {os.path.basename(path)}: rejected ({reason})")
            continue
        emb = _extract_embedding(crop)
        if emb:
            embeddings.append(emb)
            print(f"  ✓ {os.path.basename(path)}: score={score:.2f}")
        else:
            print(f"  ✗ {os.path.basename(path)}: embedding failed")
        if (idx + 1) % 5 == 0:
            gc.collect()
    return embeddings


# ── CLI ────────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description='IntelliSight Face Enrollment v2 — quality-gated, diversity-checked'
    )
    parser.add_argument('--type',      choices=['student', 'teacher'],
                        help='Person type to enroll')
    parser.add_argument('--id',        type=int, help='Person ID')
    parser.add_argument('--all',       action='store_true', help='Enroll all persons (skips already-enrolled)')
    parser.add_argument('--reset-all', action='store_true',
                        help='Wipe ALL embeddings then re-enroll everyone from scratch')
    parser.add_argument('--train',     action='store_true', help='Train from images folder')
    args = parser.parse_args()

    if args.train:
        train_from_images_folder()
        return

    db_handler = DatabaseHandler()
    try:
        if args.reset_all:
            reset_all_embeddings(db_handler)
            enroll_all_from_database(db_handler, force=True)
        elif args.all:
            enroll_all_from_database(db_handler)
        elif args.type and args.id:
            person_type = 'Teacher' if args.type == 'teacher' else 'Student'
            enroll_person_from_database(args.id, person_type, db_handler)
        else:
            parser.print_help()
    finally:
        db_handler.close()


if __name__ == '__main__':
    main()
