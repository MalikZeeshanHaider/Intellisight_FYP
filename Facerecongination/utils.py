"""
IntelliSight - Utility Functions for DeepFace Face Recognition
Helper functions for logging, image processing, and file operations
"""

import os
import cv2
import json
import logging
import base64
import numpy as np
from datetime import datetime
from pathlib import Path
from io import BytesIO
from PIL import Image

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


def find_best_match(embedding, embeddings_data, threshold=0.8):
    """
    OPTIMIZED: Find the best matching person for an embedding
    Uses averaging across multiple embeddings per person for better accuracy
    
    FaceNet euclidean distance thresholds:
    - 0.0 - 0.4: Very high confidence match
    - 0.4 - 0.6: Good confidence match  
    - 0.6 - 0.8: Acceptable match
    - > 0.8: Likely different person
    
    Args:
        embedding: Face embedding to match (128D FaceNet)
        embeddings_data: List of dicts with 'person' and 'embedding' keys
        threshold: Maximum distance to consider a match (default 0.8)
        
    Returns:
        tuple: (person_name, distance) or ("Unknown", distance)
    """
    if not embeddings_data:
        return "Unknown", float('inf')
    
    # Group distances by person for better accuracy
    person_distances = {}
    
    for data in embeddings_data:
        if isinstance(data, dict) and 'embedding' in data:
            emb = data['embedding']
            person = data.get('person', 'Unknown')
        else:
            continue
        
        try:
            dist = get_euclidean_distance(embedding, emb)
            
            if person not in person_distances:
                person_distances[person] = []
            person_distances[person].append(dist)
        except Exception:
            continue
    
    if not person_distances:
        return "Unknown", float('inf')
    
    # Find person with best (minimum) average distance
    best_person = None
    min_best_distance = float('inf')
    
    for person, distances in person_distances.items():
        # Use minimum distance (best match) for this person
        best_dist = min(distances)
        
        if best_dist < min_best_distance:
            min_best_distance = best_dist
            best_person = person
    
    if min_best_distance <= threshold and best_person:
        return best_person, min_best_distance
    return "Unknown", min_best_distance


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
    Save embeddings to JSON file
    
    Args:
        embeddings_data: List of embedding dicts
        embeddings_file: Path to save file
        
    Returns:
        bool: Success status
    """
    try:
        # Convert numpy arrays to lists for JSON serialization
        serializable_data = []
        for item in embeddings_data:
            serializable_item = {
                "person": item["person"],
                "image": item.get("image", ""),
                "image_path": item.get("image_path", ""),
                "embedding": item["embedding"] if isinstance(item["embedding"], list) 
                            else item["embedding"].tolist()
            }
            serializable_data.append(serializable_item)
        
        # Ensure directory exists
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
