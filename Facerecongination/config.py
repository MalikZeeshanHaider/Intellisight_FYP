"""
IntelliSight - Configuration for DeepFace-based Face Recognition
Uses FaceNet model via DeepFace library

*** CPU-OPTIMIZED SETTINGS ***
"""

import os
from dotenv import load_dotenv

# Load .env file from parent directory
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

# Database configuration
DB_CONFIG = {
    'host': os.getenv('DB_HOST', 'localhost'),
    'port': int(os.getenv('DB_PORT', 5000)),
    'database': os.getenv('DB_NAME', 'FYP_Intellisight'),
    'user': os.getenv('DB_USER', 'postgres'),
    'password': os.getenv('DB_PASSWORD', 'ozair')
}

# Face recognition settings - DeepFace with FaceNet (CPU Optimized)
MODEL_NAME = "Facenet"  # FaceNet model for embeddings (128-dimensional)
DETECTOR_BACKEND = "opencv"  # OpenCV Haar Cascade (fastest on CPU)

# FaceNet euclidean distance threshold: lower = stricter matching
# NOTE: FaceNet512 uses larger distances (5-15 typical range)
# For Facenet (128D): typical range is 5-12 for unnormalized embeddings
DISTANCE_THRESHOLD = 8.0  # Stricter threshold for better accuracy
MIN_FACE_SIZE = 40  # Minimum face size (pixels)
CONSECUTIVE_MATCHES = 2  # Matches needed before confirming identity
FRAME_SKIP = 3  # Process every 3rd frame for CPU optimization

# Folder paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
IMAGES_FOLDER = os.path.join(BASE_DIR, "images")
EMBEDDINGS_FOLDER = os.path.join(BASE_DIR, "embeddings")
EMBEDDINGS_FILE = os.path.join(EMBEDDINGS_FOLDER, "representations_facenet.json")

# Unidentified face settings
UNIDENTIFIED_CONSECUTIVE = 5
UNIDENTIFIED_COOLDOWN = 60  # Seconds before re-detecting same unknown face
UNIDENTIFIED_SAVE_PATH = os.path.join(BASE_DIR, "unidentified_images")

# Cache settings
KNOWN_FACES_CACHE = os.path.join(BASE_DIR, "known_faces_cache.pkl")

# Create necessary directories
for directory in [IMAGES_FOLDER, EMBEDDINGS_FOLDER, UNIDENTIFIED_SAVE_PATH]:
    if not os.path.exists(directory):
        os.makedirs(directory)
        print(f"[CONFIG] Created directory: {directory}")

print(f"[CONFIG] Loaded: DB={DB_CONFIG['database']}, Model={MODEL_NAME}, Threshold={DISTANCE_THRESHOLD}")
