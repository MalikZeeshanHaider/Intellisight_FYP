"""
Test Camera RTSP Connection
Diagnose why camera connection is failing
"""

import cv2
import time

camera_url = "rtsp://admin:ozair123@192.168.10.2/cam/realmonitor?channel=1&subtype=0"

print("=" * 70)
print("CAMERA CONNECTION DIAGNOSTIC TEST")
print("=" * 70)
print(f"Testing: {camera_url}\n")

# Test 1: Basic connection
print("[Test 1] Opening camera stream...")
cap = cv2.VideoCapture(camera_url)

if not cap.isOpened():
    print("❌ Failed to open camera")
    print("\nPossible issues:")
    print("  1. Incorrect RTSP URL path")
    print("  2. Wrong username/password")
    print("  3. Camera port is not 554 (default RTSP)")
    print("  4. Camera RTSP is disabled")
    print("\nTry these alternative URLs:")
    print("  - rtsp://admin:ozair123@192.168.10.2:554/cam/realmonitor?channel=1&subtype=0")
    print("  - rtsp://admin:ozair123@192.168.10.2/stream1")
    print("  - rtsp://admin:ozair123@192.168.10.2/live")
    print("  - rtsp://admin:ozair123@192.168.10.2:554/h264/ch1/main/av_stream")
else:
    print("✅ Camera opened successfully!")
    
    # Test 2: Read frame
    print("\n[Test 2] Reading frame (timeout 10 seconds)...")
    start_time = time.time()
    success = False
    frame = None
    
    while time.time() - start_time < 10:
        ret, frame = cap.read()
        if ret and frame is not None:
            success = True
            break
        time.sleep(0.1)
    
    if success:
        print(f"✅ Frame received!")
        print(f"   Resolution: {frame.shape[1]}x{frame.shape[0]}")
        print(f"   Channels: {frame.shape[2]}")
        print(f"   Time: {time.time() - start_time:.2f}s")
        
        # Test 3: Read multiple frames
        print("\n[Test 3] Reading 10 frames...")
        for i in range(10):
            ret, frame = cap.read()
            if ret:
                print(f"  Frame {i+1}/10 ✓")
            else:
                print(f"  Frame {i+1}/10 ✗ Failed")
                break
        
        print("\n✅ Camera is working correctly!")
        print("   The camera should now work with the face recognition service.")
        
    else:
        print("❌ No frame received (timeout)")
        print("\nPossible issues:")
        print("  1. Camera is streaming but very slow")
        print("  2. Network bandwidth issue")
        print("  3. Camera requires specific codec settings")
    
    cap.release()

print("\n" + "=" * 70)
print("Test complete!")
print("=" * 70)
