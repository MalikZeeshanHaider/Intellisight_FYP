# Fix OpenCV RTSP Connection Issue

## Problem
Your OpenCV installation does NOT have FFMPEG support, which is required for RTSP camera connections.

**Current Status:**
```
OpenCV Version: 4.12.0
FFMPEG: NO ❌
```

## Solution Options

### Option 1: Install opencv-python-headless with FFMPEG (Recommended)

1. **Uninstall current OpenCV:**
   ```bash
   pip uninstall opencv-python opencv-python-headless opencv-contrib-python
   ```

2. **Install opencv-python with FFMPEG support:**
   ```bash
   pip install opencv-contrib-python
   ```
   
   OR for headless servers:
   ```bash
   pip install opencv-contrib-python-headless
   ```

3. **Verify FFMPEG support:**
   ```bash
   python -c "import cv2; print('OpenCV:', cv2.__version__); print('FFMPEG:', 'YES' if 'FFMPEG:                    YES' in cv2.getBuildInformation() else 'NO')"
   ```

### Option 2: Use VLC Python Bindings

If OpenCV still doesn't work, use VLC for RTSP:

```bash
pip install python-vlc
```

Then modify camera connection code to use VLC instead of cv2.VideoCapture.

### Option 3: Add CAP_FFMPEG Backend Explicitly

In your Python code, explicitly specify FFMPEG backend:

```python
import cv2

# Instead of:
cap = cv2.VideoCapture(camera_url)

# Use:
cap = cv2.VideoCapture(camera_url, cv2.CAP_FFMPEG)

# Additional settings for RTSP:
cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
cap.set(cv2.CAP_PROP_OPEN_TIMEOUT_MSEC, 10000)  # 10 second timeout
cap.set(cv2.CAP_PROP_READ_TIMEOUT_MSEC, 10000)
```

### Option 4: Add Environment Variables for OpenCV

Set these environment variables before running Python:

**Windows (PowerShell):**
```powershell
$env:OPENCV_FFMPEG_CAPTURE_OPTIONS = "rtsp_transport;udp"
$env:OPENCV_VIDEOIO_DEBUG = "1"
```

**Windows (CMD):**
```cmd
set OPENCV_FFMPEG_CAPTURE_OPTIONS=rtsp_transport;udp
set OPENCV_VIDEOIO_DEBUG=1
```

## Quick Test After Fix

Run this test script:
```bash
cd Facerecongination
python test_rtsp_camera.py
```

Enter your RTSP URL when prompted.

## Additional RTSP Connection Settings

Add these settings to improve RTSP reliability in your code:

```python
# In persistent_camera_manager.py and camera_streaming_service.py
def _connect(self):
    try:
        # Create capture with FFMPEG backend
        self.cap = cv2.VideoCapture(self.camera_url, cv2.CAP_FFMPEG)
        
        # RTSP optimization settings
        self.cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)  # Reduce latency
        self.cap.set(cv2.CAP_PROP_OPEN_TIMEOUT_MSEC, 10000)  # 10s open timeout
        self.cap.set(cv2.CAP_PROP_READ_TIMEOUT_MSEC, 10000)  # 10s read timeout
        self.cap.set(cv2.CAP_PROP_FPS, 15)  # Limit FPS if needed
        
        # Use UDP transport for RTSP (faster but less reliable)
        # For TCP: set to "rtsp_transport;tcp"
        os.environ['OPENCV_FFMPEG_CAPTURE_OPTIONS'] = 'rtsp_transport;udp|rtsp_flags;prefer_tcp'
        
        if self.cap.isOpened():
            ret, frame = self.cap.read()
            if ret and frame is not None:
                return True
        return False
    except Exception as e:
        print(f"Connection error: {e}")
        return False
```

## Why VLC Works But OpenCV Doesn't

| Feature | VLC | OpenCV (pip) |
|---------|-----|--------------|
| Built-in codecs | ✅ Yes | ❌ No |
| FFMPEG support | ✅ Built-in | ❌ Not included |
| RTSP protocols | ✅ All | ⚠️ Needs FFMPEG |
| Network streaming | ✅ Optimized | ⚠️ Depends on backend |

## Common RTSP Connection Issues

1. **Firewall blocking port 554** - Ensure RTSP port is open
2. **Wrong credentials** - Verify username/password
3. **Camera RTSP disabled** - Enable RTSP in camera settings
4. **Network timeout** - Increase timeout values
5. **UDP packet loss** - Switch to TCP transport
6. **No FFMPEG support** - **YOUR CURRENT ISSUE ✅**

## Next Steps

1. **Choose Option 1** (reinstall OpenCV with FFMPEG)
2. Test with: `python test_rtsp_camera.py`
3. If still failing, try Options 3 & 4 together
4. Restart your Flask services after fixing
