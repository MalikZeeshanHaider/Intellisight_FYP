"""
Image Quality Checker for Face Enrollment
Validates images before enrollment to ensure good quality
"""

import cv2
import face_recognition
import numpy as np
from PIL import Image
import base64
from io import BytesIO

def check_image_quality(image_path_or_base64):
    """
    Check if image is suitable for face recognition enrollment
    Returns: (is_valid, message, details)
    """
    try:
        # Load image
        if isinstance(image_path_or_base64, str) and image_path_or_base64.startswith('data:image'):
            # Base64 image
            base64_data = image_path_or_base64.split(',')[1]
            image_bytes = base64.b64decode(base64_data)
            image = Image.open(BytesIO(image_bytes))
            image_np = np.array(image)
        else:
            # File path
            image_np = face_recognition.load_image_file(image_path_or_base64)
        
        details = {}
        issues = []
        
        # Check 1: Image resolution
        height, width = image_np.shape[:2]
        details['resolution'] = f"{width}x{height}"
        if width < 200 or height < 200:
            issues.append(f"Image too small ({width}x{height}). Minimum: 200x200")
        elif width < 300 or height < 300:
            issues.append(f"Image resolution low ({width}x{height}). Recommended: 300x300+")
        
        # Check 2: Detect faces
        face_locations = face_recognition.face_locations(image_np, model='hog')
        details['faces_detected'] = len(face_locations)
        
        if len(face_locations) == 0:
            issues.append("No face detected in image")
            return False, "No face detected", details
        elif len(face_locations) > 1:
            issues.append(f"Multiple faces detected ({len(face_locations)}). Use single-person photos")
        
        # Check 3: Face size
        top, right, bottom, left = face_locations[0]
        face_width = right - left
        face_height = bottom - top
        details['face_size'] = f"{face_width}x{face_height}"
        
        if face_width < 80 or face_height < 80:
            issues.append(f"Face too small ({face_width}x{face_height}). Move closer or use higher resolution")
        
        # Check 4: Face position (should be centered)
        face_center_x = (left + right) / 2
        face_center_y = (top + bottom) / 2
        image_center_x = width / 2
        image_center_y = height / 2
        
        offset_x = abs(face_center_x - image_center_x) / width
        offset_y = abs(face_center_y - image_center_y) / height
        
        if offset_x > 0.3 or offset_y > 0.3:
            issues.append("Face not centered. Position face in center of frame")
        
        # Check 5: Brightness
        gray = cv2.cvtColor(image_np, cv2.COLOR_RGB2GRAY)
        brightness = np.mean(gray)
        details['brightness'] = f"{brightness:.1f}"
        
        if brightness < 50:
            issues.append(f"Image too dark (brightness: {brightness:.0f}/255). Improve lighting")
        elif brightness > 200:
            issues.append(f"Image too bright (brightness: {brightness:.0f}/255). Reduce lighting")
        
        # Check 6: Blur detection
        laplacian_var = cv2.Laplacian(gray, cv2.CV_64F).var()
        details['sharpness'] = f"{laplacian_var:.1f}"
        
        if laplacian_var < 100:
            issues.append(f"Image blurry (sharpness: {laplacian_var:.0f}). Use steady camera")
        
        # Check 7: Face encoding generation
        try:
            encodings = face_recognition.face_encodings(image_np, face_locations)
            if not encodings:
                issues.append("Could not generate face encoding. Face may be occluded")
            else:
                details['encoding_generated'] = True
        except Exception as e:
            issues.append(f"Encoding error: {str(e)}")
        
        # Final verdict
        if not issues:
            return True, "✓ Image quality excellent", details
        elif len(issues) <= 2 and 'No face detected' not in ''.join(issues):
            return True, f"⚠ Acceptable but could improve: {'; '.join(issues)}", details
        else:
            return False, f"✗ Poor quality: {'; '.join(issues)}", details
            
    except Exception as e:
        return False, f"Error processing image: {str(e)}", {}

def check_person_images(person_images):
    """
    Check quality of all 5 images for a person
    person_images: list of 5 image paths or base64 strings
    Returns: (all_valid, results)
    """
    results = []
    all_valid = True
    
    for idx, image in enumerate(person_images, 1):
        if not image:
            results.append({
                'image_number': idx,
                'valid': False,
                'message': 'Image missing',
                'details': {}
            })
            all_valid = False
            continue
        
        is_valid, message, details = check_image_quality(image)
        results.append({
            'image_number': idx,
            'valid': is_valid,
            'message': message,
            'details': details
        })
        
        if not is_valid:
            all_valid = False
    
    return all_valid, results

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: python check_image_quality.py <image_path>")
        sys.exit(1)
    
    image_path = sys.argv[1]
    is_valid, message, details = check_image_quality(image_path)
    
    print(f"\nImage Quality Check: {image_path}")
    print(f"Result: {message}")
    print(f"\nDetails:")
    for key, value in details.items():
        print(f"  {key}: {value}")
    
    sys.exit(0 if is_valid else 1)
