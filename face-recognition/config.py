import os
from dotenv import load_dotenv

# Load .env file
if not load_dotenv():
    print("Warning: .env file not found. Using defaults.")

# Database configuration
DB_CONFIG = {
    'host': os.getenv('DB_HOST', 'localhost'),
    'port': int(os.getenv('DB_PORT', 5432)),
    'database': os.getenv('DB_NAME', 'FYP_Intellisight'),
    'user': os.getenv('DB_USER', 'postgres'),
    'password': os.getenv('DB_PASSWORD', '')
}

# Face recognition settings
RECOGNITION_TOLERANCE = float(os.getenv('RECOGNITION_TOLERANCE', 0.5))
MIN_FACE_SIZE = int(os.getenv('MIN_FACE_SIZE', 100))
CONSECUTIVE_MATCHES = int(os.getenv('CONSECUTIVE_MATCHES', 5))
FRAME_SKIP = int(os.getenv('FRAME_SKIP', 2))

# Unidentified face settings
UNIDENTIFIED_CONSECUTIVE = int(os.getenv('UNIDENTIFIED_CONSECUTIVE', 5))
UNIDENTIFIED_COOLDOWN = int(os.getenv('UNIDENTIFIED_COOLDOWN', 60))
UNIDENTIFIED_SAVE_PATH = os.getenv('UNIDENTIFIED_SAVE_PATH', './unidentified_images/')

# Detection quality settings
MAX_FACE_DISTANCE = float(os.getenv('MAX_FACE_DISTANCE', 0.5))
MIN_DETECTION_CONFIDENCE = float(os.getenv('MIN_DETECTION_CONFIDENCE', 0.8))
FACE_DETECTION_MODEL = os.getenv('FACE_DETECTION_MODEL', 'hog')  # 'hog' or 'cnn'

# Cache
KNOWN_FACES_CACHE = 'known_faces_cache.pkl'

print(f"[CONFIG] Loaded: DB={DB_CONFIG['database']}, Tolerance={RECOGNITION_TOLERANCE}")
