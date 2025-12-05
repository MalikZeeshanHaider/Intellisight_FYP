"""
Incremental Face Recognition Training (Simple Version)
Uses OpenCV for face detection and simple embedding generation
Only trains NEW images that are not already in the embeddings file
"""

import os
import sys
import json

# Fix Windows console encoding
if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except:
        pass

try:
    import cv2
    import numpy as np
except ImportError:
    print("[ERROR] OpenCV not installed. Run: pip install opencv-python numpy")
    sys.exit(1)

# Configuration
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
IMAGES_FOLDER = os.path.join(BASE_DIR, "images")
EMBEDDINGS_FOLDER = os.path.join(BASE_DIR, "embeddings")
EMBEDDINGS_FILE = os.path.join(EMBEDDINGS_FOLDER, "representations_facenet.json")

# Face detector
FACE_CASCADE_PATH = cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
face_cascade = cv2.CascadeClassifier(FACE_CASCADE_PATH)


def load_existing_embeddings():
    """Load existing embeddings from file"""
    if os.path.exists(EMBEDDINGS_FILE):
        try:
            with open(EMBEDDINGS_FILE, 'r') as f:
                return json.load(f)
        except:
            return []
    return []


def get_trained_images(embeddings):
    """Get set of already trained image paths"""
    trained = set()
    for item in embeddings:
        # Store just the person/image combination
        trained.add(f"{item['person']}/{item['image']}")
    return trained


def find_new_images(trained_set):
    """Find images that haven't been trained yet"""
    new_images = []
    
    if not os.path.exists(IMAGES_FOLDER):
        print(f"[ERROR] Images folder not found: {IMAGES_FOLDER}")
        return new_images
    
    for person_name in os.listdir(IMAGES_FOLDER):
        person_path = os.path.join(IMAGES_FOLDER, person_name)
        
        if not os.path.isdir(person_path):
            continue
        
        for image_file in os.listdir(person_path):
            if not image_file.lower().endswith(('.jpg', '.jpeg', '.png')):
                continue
            
            key = f"{person_name}/{image_file}"
            if key not in trained_set:
                new_images.append({
                    'person': person_name,
                    'image': image_file,
                    'path': os.path.join(person_path, image_file)
                })
    
    return new_images


def extract_face_embedding(image_path):
    """
    Extract a simple face embedding from an image
    Uses histogram-based features for simplicity
    """
    try:
        # Read image
        img = cv2.imread(image_path)
        if img is None:
            return None
        
        # Convert to grayscale
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        
        # Detect faces
        faces = face_cascade.detectMultiScale(gray, 1.1, 4)
        
        if len(faces) == 0:
            # Try with entire image if no face detected
            face_region = gray
        else:
            # Get the largest face
            x, y, w, h = max(faces, key=lambda f: f[2] * f[3])
            face_region = gray[y:y+h, x:x+w]
        
        # Resize to standard size
        face_resized = cv2.resize(face_region, (128, 128))
        
        # Generate embedding using multiple features
        embedding = []
        
        # 1. Histogram features (normalized)
        hist = cv2.calcHist([face_resized], [0], None, [64], [0, 256])
        hist = cv2.normalize(hist, hist).flatten()
        embedding.extend(hist.tolist())
        
        # 2. LBP-like features (simplified)
        cell_h, cell_w = 32, 32
        for i in range(4):
            for j in range(4):
                cell = face_resized[i*cell_h:(i+1)*cell_h, j*cell_w:(j+1)*cell_w]
                embedding.append(float(np.mean(cell)) / 255.0)
                embedding.append(float(np.std(cell)) / 255.0)
        
        # 3. Edge density features
        edges = cv2.Canny(face_resized, 50, 150)
        edge_density = np.sum(edges > 0) / (128 * 128)
        embedding.append(edge_density)
        
        # Normalize to 128 dimensions
        while len(embedding) < 128:
            embedding.append(0.0)
        embedding = embedding[:128]
        
        return embedding
        
    except Exception as e:
        print(f"  [ERROR] {str(e)[:50]}")
        return None


def save_embeddings(embeddings):
    """Save embeddings to JSON file"""
    os.makedirs(EMBEDDINGS_FOLDER, exist_ok=True)
    
    with open(EMBEDDINGS_FILE, 'w') as f:
        json.dump(embeddings, f, indent=2)


def main():
    print("\n" + "="*50)
    print("INCREMENTAL FACE TRAINING")
    print("="*50)
    
    # Load existing embeddings
    existing_embeddings = load_existing_embeddings()
    trained_set = get_trained_images(existing_embeddings)
    
    print(f"[INFO] Existing embeddings: {len(existing_embeddings)}")
    
    # Find new images
    new_images = find_new_images(trained_set)
    
    if len(new_images) == 0:
        print("[OK] No new images to train")
        print("="*50 + "\n")
        return
    
    print(f"[INFO] New images to train: {len(new_images)}")
    print("-"*50)
    
    # Train new images
    new_embeddings = []
    for img_info in new_images:
        print(f"Training: {img_info['person']}/{img_info['image']}", end=" ")
        
        embedding = extract_face_embedding(img_info['path'])
        
        if embedding is not None:
            new_embeddings.append({
                'person': img_info['person'],
                'image': img_info['image'],
                'image_path': img_info['path'],
                'embedding': embedding
            })
            print("[OK]")
        else:
            print("[SKIP]")
    
    # Merge with existing embeddings
    if len(new_embeddings) > 0:
        all_embeddings = existing_embeddings + new_embeddings
        save_embeddings(all_embeddings)
        
        print("-"*50)
        print(f"[OK] Added {len(new_embeddings)} new embeddings")
        print(f"[OK] Total embeddings: {len(all_embeddings)}")
    else:
        print("[WARN] No new embeddings generated")
    
    print("="*50 + "\n")


if __name__ == "__main__":
    main()
