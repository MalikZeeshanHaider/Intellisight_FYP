"""
RTSP Camera Connection Tester
Tests RTSP camera connectivity before using in face recognition system
"""

import cv2
import argparse
import time
from urllib.parse import urlparse

def test_rtsp_connection(rtsp_url, duration=10):
    """
    Test RTSP camera connection
    
    Args:
        rtsp_url: Full RTSP URL (rtsp://username:password@ip:port/path)
        duration: How long to test in seconds
    """
    print(f"\n{'='*70}")
    print(f"RTSP CAMERA CONNECTION TEST")
    print(f"{'='*70}")
    print(f"URL: {rtsp_url}")
    print(f"Testing for {duration} seconds...")
    print(f"{'='*70}\n")
    
    # Parse URL to hide credentials in display
    parsed = urlparse(rtsp_url)
    safe_url = f"{parsed.scheme}://*****:*****@{parsed.hostname}"
    if parsed.port:
        safe_url += f":{parsed.port}"
    safe_url += parsed.path
    
    # Initialize video capture
    print(f"[1/4] Initializing connection to camera...")
    cap = cv2.VideoCapture(rtsp_url)
    
    if not cap.isOpened():
        print(f"❌ FAILED: Could not connect to camera")
        print(f"\nPossible issues:")
        print(f"  • Check if camera IP is correct and reachable")
        print(f"  • Verify username and password")
        print(f"  • Ensure RTSP port is correct (usually 554)")
        print(f"  • Check if camera RTSP is enabled")
        print(f"  • Verify firewall/network settings")
        return False
    
    print(f"✓ Connection established")
    
    # Get camera properties
    print(f"\n[2/4] Reading camera properties...")
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps = int(cap.get(cv2.CAP_PROP_FPS))
    
    print(f"✓ Resolution: {width}x{height}")
    print(f"✓ FPS: {fps}")
    
    # Test frame reading
    print(f"\n[3/4] Testing frame capture...")
    frame_count = 0
    start_time = time.time()
    failed_reads = 0
    
    while time.time() - start_time < duration:
        ret, frame = cap.read()
        
        if ret:
            frame_count += 1
            
            # Display frame
            cv2.putText(frame, f"Frame: {frame_count}", (10, 30), 
                       cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)
            cv2.putText(frame, f"Press 'q' to quit", (10, height - 20), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
            cv2.putText(frame, f"URL: {safe_url}", (10, 70), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
            
            cv2.imshow('RTSP Camera Test', frame)
            
            if cv2.waitKey(1) & 0xFF == ord('q'):
                break
        else:
            failed_reads += 1
            if failed_reads > 30:
                print(f"❌ FAILED: Too many failed frame reads")
                cap.release()
                cv2.destroyAllWindows()
                return False
    
    elapsed = time.time() - start_time
    actual_fps = frame_count / elapsed
    
    cap.release()
    cv2.destroyAllWindows()
    
    print(f"✓ Captured {frame_count} frames in {elapsed:.1f} seconds")
    print(f"✓ Actual FPS: {actual_fps:.1f}")
    print(f"✓ Failed reads: {failed_reads}")
    
    # Final verdict
    print(f"\n[4/4] Connection Test Result:")
    if frame_count > 0 and failed_reads < 10:
        print(f"✅ SUCCESS: Camera is working properly!")
        print(f"\nCamera is ready for face recognition system.")
        return True
    else:
        print(f"⚠️  WARNING: Camera connection is unstable")
        print(f"  Frames captured: {frame_count}")
        print(f"  Failed reads: {failed_reads}")
        return False


def test_multiple_cameras(camera_list):
    """Test multiple cameras"""
    results = {}
    
    for idx, rtsp_url in enumerate(camera_list, 1):
        print(f"\n\n{'#'*70}")
        print(f"Testing Camera {idx}/{len(camera_list)}")
        print(f"{'#'*70}")
        
        success = test_rtsp_connection(rtsp_url, duration=5)
        results[rtsp_url] = success
        
        time.sleep(2)  # Brief pause between tests
    
    # Summary
    print(f"\n\n{'='*70}")
    print(f"TEST SUMMARY")
    print(f"{'='*70}")
    for url, success in results.items():
        status = "✅ PASS" if success else "❌ FAIL"
        parsed = urlparse(url)
        safe_url = f"{parsed.scheme}://{parsed.hostname}"
        print(f"{status} - {safe_url}")
    
    return results


def main():
    parser = argparse.ArgumentParser(description='Test RTSP camera connection')
    parser.add_argument('--url', type=str, help='RTSP URL to test')
    parser.add_argument('--duration', type=int, default=10, help='Test duration in seconds')
    parser.add_argument('--file', type=str, help='File containing list of RTSP URLs (one per line)')
    
    args = parser.parse_args()
    
    if args.file:
        # Test multiple cameras from file
        with open(args.file, 'r') as f:
            urls = [line.strip() for line in f if line.strip() and not line.startswith('#')]
        test_multiple_cameras(urls)
    elif args.url:
        # Test single camera
        test_rtsp_connection(args.url, args.duration)
    else:
        # Interactive mode
        print("RTSP Camera Tester - Interactive Mode")
        print("="*70)
        rtsp_url = input("Enter RTSP URL: ").strip()
        if rtsp_url:
            test_rtsp_connection(rtsp_url, duration=10)
        else:
            print("No URL provided. Exiting.")


if __name__ == "__main__":
    main()
