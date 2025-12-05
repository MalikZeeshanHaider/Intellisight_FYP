"""
IntelliSight - Configuration for DeepFace-based Face Recognition
Uses FaceNet model via DeepFace library
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
    'password': os.getenv('DB_PASSWORD', 'zeeshan')
}

# Face recognition settings - DeepFace with FaceNet
MODEL_NAME = "Facenet"  # FaceNet model for embeddings (128-dimensional)
DETECTOR_BACKEND = "retinaface"  # Most accurate detector
DISTANCE_THRESHOLD = 10.0  # Euclidean distance threshold for matching
MIN_FACE_SIZE = 30  # Minimum face size in pixels for detection
CONSECUTIVE_MATCHES = 3  # Number of consecutive matches needed for confirmation
FRAME_SKIP = 2  # Process every N frames for performance

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
