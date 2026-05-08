"""
End-to-end recognition diagnostic.

Loads every enrolled person from the database, then runs each of their stored
Face_Picture_1..5 photos through the EXACT same pipeline the live camera uses
(YuNet detect → tight bbox crop → preprocess_face_crop → resize 112×112 →
ArcFace.represent → search_with_vote against the index).

The expected output for a healthy system is: every photo matches its own
person with cosine distance < 0.40.  Distances > 0.68 mean recognition will
fail in the live camera too — usually because of a preprocessing inconsistency
between enrollment and recognition.

Usage:
    python test_recognition.py
"""

import os
import sys
import cv2
import numpy as np
from deepface import DeepFace
from psycopg2.extras import RealDictCursor

if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

from config import (
    MODEL_NAME, DETECTOR_BACKEND, DISTANCE_THRESHOLD,
    KNN_K, KNN_VOTE_MIN, KNN_MARGIN, MIN_FACE_SIZE,
)
from database_handler import DatabaseHandler
from utils import (
    EmbeddingIndex, preprocess_face_crop, decode_base64_image,
)

FACE_SIZE = 112  # ArcFace canonical input — must match camera_streaming_service


def extract_embedding(face_crop: np.ndarray) -> np.ndarray | None:
    """Mirror of camera_streaming_service._get_raw_embedding (live path)."""
    if face_crop is None or face_crop.size == 0:
        return None
    if face_crop.shape[0] < MIN_FACE_SIZE or face_crop.shape[1] < MIN_FACE_SIZE:
        return None
    try:
        processed = preprocess_face_crop(face_crop)
        resized = cv2.resize(processed, (FACE_SIZE, FACE_SIZE),
                             interpolation=cv2.INTER_LINEAR)
        result = DeepFace.represent(
            img_path=resized,
            model_name=MODEL_NAME,
            detector_backend='skip',
            enforce_detection=False,
            align=False,
        )
        if result:
            return np.array(result[0]['embedding'], dtype=np.float32)
    except Exception as e:
        print(f"  [embed error] {e}")
    return None


def detect_and_crop(bgr_image: np.ndarray) -> np.ndarray | None:
    """Detect the largest face in an image and return the TIGHT bbox crop.

    This matches what enrollment does (DeepFace.extract_faces returns the
    raw frame[y:y+h, x:x+w] crop) AND what the camera service now does after
    today's fix (no margin around the YuNet bbox).
    """
    try:
        faces = DeepFace.extract_faces(
            img_path=bgr_image,
            detector_backend=DETECTOR_BACKEND,
            enforce_detection=False,
            align=False,
        )
    except Exception as e:
        print(f"  [detect error] {e}")
        return None

    if not faces:
        # Fall back to opencv if yunet missed
        try:
            faces = DeepFace.extract_faces(
                img_path=bgr_image,
                detector_backend='opencv',
                enforce_detection=False,
                align=False,
            )
        except Exception:
            return None

    if not faces:
        return None

    best = max(faces, key=lambda f: f.get('confidence', 0))
    face_arr = best.get('face')
    if face_arr is None or face_arr.size == 0:
        return None
    if face_arr.dtype != np.uint8:
        face_arr = (face_arr * 255).clip(0, 255).astype(np.uint8)
        face_arr = cv2.cvtColor(face_arr, cv2.COLOR_RGB2BGR)
    return face_arr


def main():
    print("=" * 70)
    print("RECOGNITION PIPELINE DIAGNOSTIC")
    print("=" * 70)

    # ── Step 1: load embeddings from DB ───────────────────────────────────────
    db = DatabaseHandler()
    persons_dict = db.fetch_all_persons()

    new_data = []
    for p in persons_dict.values():
        for emb in p['embeddings']:
            new_data.append({
                'person_id':  p['id'],
                'name':       p['name'],
                'role':       p['role'],
                'person_key': p['key'],
                'embedding':  emb,
            })

    index = EmbeddingIndex(new_data)
    print(f"\n[INDEX] Loaded {len(persons_dict)} person(s), "
          f"{len(index)} embedding row(s)")
    for key, p in persons_dict.items():
        print(f"  {key}: {len(p['embeddings'])} embedding(s)")

    if len(index) == 0:
        print("\n[FAIL] No embeddings loaded — enrol someone first")
        db.close()
        return

    # ── Step 2: pull each person's source photos and self-match them ─────────
    print(f"\n{'=' * 70}")
    print("SELF-MATCH TEST (enrollment photos → live recognition pipeline)")
    print('=' * 70)
    print("Expected: same-person dist < 0.40 (clear match)")
    print(f"Threshold: {DISTANCE_THRESHOLD} (above = 'unknown' in live)")
    print()

    total_photos = 0
    total_match  = 0
    total_high   = 0   # passed but distance > 0.40 (worrying)
    total_fail   = 0   # didn't match at all

    for key, person in persons_dict.items():
        person_id   = person['id']
        person_type = person['type']
        name        = person['name']

        photos = db.get_person_images(person_id, person_type)
        if not photos:
            continue

        print(f"\n── {name} ({person_type} ID={person_id}) ──")

        for i in range(1, 6):
            pic = photos.get(f'Face_Picture_{i}')
            if not pic:
                continue

            total_photos += 1
            bgr = decode_base64_image(pic)
            if bgr is None:
                print(f"  Photo {i}: ✗ failed to decode")
                continue

            crop = detect_and_crop(bgr)
            if crop is None:
                print(f"  Photo {i}: ✗ no face detected")
                continue

            emb = extract_embedding(crop)
            if emb is None:
                print(f"  Photo {i}: ✗ embedding extraction failed")
                continue

            match, dist, conf = index.search_with_vote(
                emb, k=KNN_K, threshold=DISTANCE_THRESHOLD,
                vote_min=KNN_VOTE_MIN, margin=KNN_MARGIN,
            )

            if match is None:
                total_fail += 1
                print(f"  Photo {i}: ✗ NO MATCH  best_dist={dist:.4f} "
                      f"(threshold={DISTANCE_THRESHOLD})  CROP={crop.shape}")
            elif match['name'] != name:
                total_fail += 1
                print(f"  Photo {i}: ✗ WRONG MATCH → {match['name']} "
                      f"(dist={dist:.4f})")
            else:
                total_match += 1
                tag = '✓' if dist < 0.40 else '⚠'
                if dist >= 0.40:
                    total_high += 1
                print(f"  Photo {i}: {tag} {match['name']:<20s} "
                      f"dist={dist:.4f}  conf={conf:.0%}  CROP={crop.shape}")

    # ── Summary ───────────────────────────────────────────────────────────────
    print(f"\n{'=' * 70}")
    print("SUMMARY")
    print('=' * 70)
    print(f"Total photos tested : {total_photos}")
    print(f"Correct match       : {total_match} "
          f"({100*total_match/total_photos:.0f}%)" if total_photos else "")
    print(f"  └─ with dist≥0.40 : {total_high} (close to threshold — fragile)")
    print(f"Failed / wrong      : {total_fail}")

    if total_fail == 0 and total_high == 0:
        print("\n✓ HEALTHY: pipeline is working — live recognition should match.")
    elif total_fail == 0 and total_high > 0:
        print("\n⚠ MARGINAL: matches succeed but distances are large.")
        print("  Live frames usually score worse than the enrolled photos.")
        print("  Consider lowering DISTANCE_THRESHOLD or re-enrolling with")
        print("  better-lit, clearer photos.")
    else:
        print("\n✗ BROKEN: same-person photos don't even match themselves.")
        print("  Something is wrong in the embedding pipeline.")

    db.close()


if __name__ == '__main__':
    main()
