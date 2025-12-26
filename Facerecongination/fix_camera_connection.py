"""
Enhanced Camera Connection with RTSP Support
Apply these changes to your persistent_camera_manager.py and camera_streaming_service.py
"""

import cv2
import os

def create_rtsp_capture(camera_url, timeout=10000):
    """
    Create VideoCapture with optimized RTSP settings
    
    Args:
        camera_url: RTSP URL (rtsp://user:pass@ip:port/path)
        timeout: Connection timeout in milliseconds (default 10 seconds)
    
    Returns:
        cv2.VideoCapture object or None
    """
    
    # Set environment variables for RTSP optimization
    # Use UDP for speed, fallback to TCP if needed
    os.environ['OPENCV_FFMPEG_CAPTURE_OPTIONS'] = 'rtsp_transport;udp|rtsp_flags;prefer_tcp'
    os.environ['OPENCV_VIDEOIO_PRIORITY_FFMPEG'] = '100'
    
    try:
        # Method 1: Try with explicit FFMPEG backend (if available)
        print(f"Attempting connection with FFMPEG backend...")
        cap = cv2.VideoCapture(camera_url, cv2.CAP_FFMPEG)
        
        if not cap.isOpened():
            # Method 2: Try default backend
            print(f"FFMPEG failed, trying default backend...")
            cap = cv2.VideoCapture(camera_url)
        
        if cap.isOpened():
            # Configure RTSP optimizations
            cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)  # Minimize latency
            cap.set(cv2.CAP_PROP_OPEN_TIMEOUT_MSEC, timeout)
            cap.set(cv2.CAP_PROP_READ_TIMEOUT_MSEC, timeout)
            
            # Optional: Limit FPS to reduce load
            # cap.set(cv2.CAP_PROP_FPS, 15)
            
            # Test if we can actually read frames
            print(f"Testing frame capture...")
            ret, frame = cap.read()
            
            if ret and frame is not None:
                print(f"✓ Connection successful!")
                print(f"  Resolution: {frame.shape[1]}x{frame.shape[0]}")
                return cap
            else:
                print(f"✗ Cannot read frames")
                cap.release()
                return None
        else:
            print(f"✗ Cannot open camera")
            return None
            
    except Exception as e:
        print(f"✗ Connection error: {e}")
        return None


def test_rtsp_url(rtsp_url):
    """
    Quick test function to verify RTSP URL
    """
    print(f"\n{'='*70}")
    print(f"Testing RTSP Connection")
    print(f"{'='*70}")
    print(f"URL: {rtsp_url[:30]}...{rtsp_url[-20:]}")  # Hide credentials
    print()
    
    cap = create_rtsp_capture(rtsp_url)
    
    if cap:
        print(f"\n✓ Camera connected successfully!")
        print(f"\nCapturing 10 test frames...")
        
        success_count = 0
        for i in range(10):
            ret, frame = cap.read()
            if ret:
                success_count += 1
                print(f"  Frame {i+1}: OK")
            else:
                print(f"  Frame {i+1}: FAILED")
        
        cap.release()
        
        print(f"\nResult: {success_count}/10 frames captured")
        
        if success_count >= 8:
            print(f"✓ Connection is STABLE")
            return True
        else:
            print(f"⚠ Connection is UNSTABLE")
            return False
    else:
        print(f"\n✗ Failed to connect to camera")
        print(f"\nTroubleshooting steps:")
        print(f"  1. Check OpenCV FFMPEG support:")
        print(f"     python -c \"import cv2; print(cv2.getBuildInformation())\" | findstr FFMPEG")
        print(f"  2. Verify URL works in VLC")
        print(f"  3. Check network connectivity: ping <camera_ip>")
        print(f"  4. Verify RTSP port 554 is open")
        print(f"  5. Check camera credentials and RTSP settings")
        return False


# Example usage
if __name__ == '__main__':
    import sys
    
    if len(sys.argv) > 1:
        rtsp_url = sys.argv[1]
    else:
        # Example URL (replace with your actual URL)
        rtsp_url = input("Enter RTSP URL: ").strip()
    
    test_rtsp_url(rtsp_url)
