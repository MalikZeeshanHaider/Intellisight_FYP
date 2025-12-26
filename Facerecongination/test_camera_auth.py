"""
RTSP Camera Connection Tester
Tests different RTSP URL formats and authentication methods
"""

import cv2
import os
import sys
import time

def test_rtsp_connection(rtsp_url, timeout=15):
    """Test RTSP connection with multiple methods"""
    
    print(f"\n{'='*70}")
    print(f"RTSP CONNECTION TEST")
    print(f"{'='*70}")
    print(f"URL: {rtsp_url[:50]}...")
    print(f"{'='*70}\n")
    
    # Set FFMPEG options
    os.environ['OPENCV_FFMPEG_CAPTURE_OPTIONS'] = 'rtsp_transport;tcp|rtsp_flags;prefer_tcp|stimeout;5000000'
    
    # Test methods
    methods = [
        ("FFMPEG with TCP", rtsp_url, cv2.CAP_FFMPEG),
        ("Default backend", rtsp_url, cv2.CAP_ANY),
        ("URL with TCP param", rtsp_url + ("&" if "?" in rtsp_url else "?") + "rtsp_transport=tcp", cv2.CAP_FFMPEG),
    ]
    
    for name, url, api in methods:
        print(f"\n[TEST] {name}...")
        print(f"       URL: {url[:60]}...")
        
        try:
            start = time.time()
            cap = cv2.VideoCapture(url, api)
            
            # Set timeouts
            cap.set(cv2.CAP_PROP_OPEN_TIMEOUT_MSEC, timeout * 1000)
            cap.set(cv2.CAP_PROP_READ_TIMEOUT_MSEC, timeout * 1000)
            cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
            
            if cap.isOpened():
                ret, frame = cap.read()
                elapsed = time.time() - start
                
                if ret and frame is not None:
                    print(f"       ✓ SUCCESS! Connected in {elapsed:.1f}s")
                    print(f"       Frame size: {frame.shape[1]}x{frame.shape[0]}")
                    cap.release()
                    return True
                else:
                    print(f"       ✗ Connected but cannot read frames")
            else:
                print(f"       ✗ Failed to open stream")
            
            cap.release()
            
        except Exception as e:
            print(f"       ✗ Error: {e}")
    
    return False


def test_alternative_urls(base_ip, username, password):
    """Test different RTSP URL formats for common cameras"""
    
    print(f"\n{'='*70}")
    print(f"TESTING ALTERNATIVE URL FORMATS")
    print(f"Camera IP: {base_ip}")
    print(f"{'='*70}\n")
    
    # Common RTSP URL formats for different camera brands
    url_formats = [
        # Dahua cameras
        f"rtsp://{username}:{password}@{base_ip}/cam/realmonitor?channel=1&subtype=0",
        f"rtsp://{username}:{password}@{base_ip}:554/cam/realmonitor?channel=1&subtype=0",
        f"rtsp://{username}:{password}@{base_ip}/cam/realmonitor?channel=1&subtype=1",
        
        # Hikvision cameras
        f"rtsp://{username}:{password}@{base_ip}/Streaming/Channels/101",
        f"rtsp://{username}:{password}@{base_ip}:554/Streaming/Channels/101",
        f"rtsp://{username}:{password}@{base_ip}/h264/ch1/main/av_stream",
        
        # Generic ONVIF cameras
        f"rtsp://{username}:{password}@{base_ip}/stream1",
        f"rtsp://{username}:{password}@{base_ip}/video1",
        f"rtsp://{username}:{password}@{base_ip}/live/ch00_0",
        
        # With explicit port
        f"rtsp://{username}:{password}@{base_ip}:554/",
        f"rtsp://{username}:{password}@{base_ip}:8554/",
    ]
    
    working_urls = []
    
    for url in url_formats:
        print(f"\nTesting: {url[:60]}...")
        
        try:
            os.environ['OPENCV_FFMPEG_CAPTURE_OPTIONS'] = 'rtsp_transport;tcp|stimeout;3000000'
            cap = cv2.VideoCapture(url, cv2.CAP_FFMPEG)
            cap.set(cv2.CAP_PROP_OPEN_TIMEOUT_MSEC, 5000)
            
            if cap.isOpened():
                ret, frame = cap.read()
                if ret and frame is not None:
                    print(f"  ✓ WORKS!")
                    working_urls.append(url)
                    cap.release()
                else:
                    print(f"  ✗ Opens but no frames")
            else:
                print(f"  ✗ Failed")
            
            cap.release()
            
        except Exception as e:
            print(f"  ✗ Error: {e}")
    
    print(f"\n{'='*70}")
    print(f"RESULTS")
    print(f"{'='*70}")
    
    if working_urls:
        print(f"\n✓ Found {len(working_urls)} working URL(s):\n")
        for url in working_urls:
            print(f"  {url}")
    else:
        print(f"\n✗ No working URLs found.")
        print(f"\nTroubleshooting tips:")
        print(f"  1. Verify camera IP is reachable: ping {base_ip}")
        print(f"  2. Check username/password in camera web interface")
        print(f"  3. Ensure RTSP is enabled in camera settings")
        print(f"  4. Check if camera uses different RTSP port (not 554)")
        print(f"  5. Try accessing camera web interface: http://{base_ip}")
    
    return working_urls


def main():
    print("\n" + "="*70)
    print("  INTELLISIGHT - RTSP CAMERA DIAGNOSTIC TOOL")
    print("="*70)
    
    if len(sys.argv) > 1:
        # Test specific URL
        rtsp_url = sys.argv[1]
        test_rtsp_connection(rtsp_url)
    else:
        # Interactive mode
        print("\nOptions:")
        print("  1. Test a specific RTSP URL")
        print("  2. Test multiple URL formats for a camera")
        
        choice = input("\nEnter choice (1 or 2): ").strip()
        
        if choice == "1":
            rtsp_url = input("\nEnter RTSP URL: ").strip()
            test_rtsp_connection(rtsp_url)
            
        elif choice == "2":
            ip = input("\nEnter camera IP (e.g., 192.168.10.3): ").strip()
            username = input("Enter username (e.g., admin): ").strip()
            password = input("Enter password: ").strip()
            test_alternative_urls(ip, username, password)
        else:
            print("Invalid choice")


if __name__ == '__main__':
    main()
