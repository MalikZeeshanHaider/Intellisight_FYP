"""
Test Face Recognition System
Quick test to verify all components work together
"""

import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

def test_imports():
    """Test if all required modules can be imported"""
    print("Testing imports...")
    try:
        import cv2
        print("✓ OpenCV imported")
        
        import face_recognition
        print("✓ face_recognition imported")
        
        import psycopg2
        print("✓ psycopg2 imported")
        
        import numpy
        print("✓ numpy imported")
        
        from database_handler import DatabaseHandler
        print("✓ DatabaseHandler imported")
        
        from config import DB_CONFIG, RECOGNITION_TOLERANCE
        print("✓ Config imported")
        
        return True
    except ImportError as e:
        print(f"❌ Import error: {e}")
        return False

def test_database_connection():
    """Test database connection"""
    print("\nTesting database connection...")
    try:
        from database_handler import DatabaseHandler
        db = DatabaseHandler()
        
        # Test zone query
        zone_name = db.get_zone_name(1)
        print(f"✓ Database connected. Zone 1: {zone_name}")
        
        # Test person fetch
        persons = db.fetch_all_persons()
        print(f"✓ Found {len(persons)} persons with face embeddings")
        
        db.close()
        return True
    except Exception as e:
        print(f"❌ Database error: {e}")
        return False

def test_camera():
    """Test camera access"""
    print("\nTesting camera access...")
    try:
        import cv2
        cap = cv2.VideoCapture(0)
        
        if not cap.isOpened():
            print("❌ Camera 0 not accessible")
            return False
        
        ret, frame = cap.read()
        cap.release()
        
        if ret:
            print(f"✓ Camera accessible. Frame shape: {frame.shape}")
            return True
        else:
            print("❌ Camera opened but couldn't read frame")
            return False
    except Exception as e:
        print(f"❌ Camera error: {e}")
        return False

def test_face_detection():
    """Test face detection on a frame"""
    print("\nTesting face detection...")
    try:
        import cv2
        import face_recognition
        
        cap = cv2.VideoCapture(0)
        ret, frame = cap.read()
        cap.release()
        
        if not ret:
            print("❌ Couldn't capture frame")
            return False
        
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        face_locations = face_recognition.face_locations(rgb_frame)
        
        print(f"✓ Face detection works. Found {len(face_locations)} face(s)")
        return True
    except Exception as e:
        print(f"❌ Face detection error: {e}")
        return False

def main():
    print("="*60)
    print("FACE RECOGNITION SYSTEM TEST")
    print("="*60)
    
    results = []
    
    # Run tests
    results.append(("Imports", test_imports()))
    results.append(("Database", test_database_connection()))
    results.append(("Camera", test_camera()))
    results.append(("Face Detection", test_face_detection()))
    
    # Summary
    print("\n" + "="*60)
    print("TEST SUMMARY")
    print("="*60)
    
    all_passed = True
    for test_name, passed in results:
        status = "✓ PASS" if passed else "❌ FAIL"
        print(f"{test_name:20s} {status}")
        if not passed:
            all_passed = False
    
    print("="*60)
    
    if all_passed:
        print("\n✅ All tests passed! System ready.")
        print("\nNext steps:")
        print("1. Run: node scripts/setupCameras.js")
        print("2. Add students/teachers via dashboard")
        print("3. Click 'Enroll' buttons to generate embeddings")
        print("4. Run: python recognition.py --zone 1")
    else:
        print("\n❌ Some tests failed. Fix issues before proceeding.")
        print("\nCommon fixes:")
        print("- Install dependencies: pip install -r requirements.txt")
        print("- Check database connection in .env")
        print("- Ensure camera is connected and not in use")

if __name__ == "__main__":
    main()
