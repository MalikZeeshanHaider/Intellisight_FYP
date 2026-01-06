# 🎥 IntelliSight - Complete RTSP Camera Integration

## 🚀 Quick Start

### Option 1: Using Quick Start Script (Windows)
```bash
# Simply run the menu-driven script
quick_start.bat
```

### Option 2: Manual Setup
```bash
# 1. Install Python dependencies
cd Facerecongination
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt

# 2. Test your camera
python test_rtsp_camera.py --url "rtsp://admin:password@192.168.1.100/stream"

# 3. Train face recognition
python enrollment.py --train

# 4. Start streaming service
python camera_streaming_service.py

# 5. Open frontend
# http://localhost:3001
# Add camera in Zone Live page
```

---

## 📖 Complete Documentation

1. **[CAMERA_FACE_RECOGNITION_GUIDE.md](CAMERA_FACE_RECOGNITION_GUIDE.md)**
   - Complete step-by-step setup
   - RTSP camera testing
   - Face recognition training
   - API reference
   - Troubleshooting
   - Performance optimization

2. **[RTSP_INTEGRATION_SUMMARY.md](RTSP_INTEGRATION_SUMMARY.md)**
   - System architecture
   - Implementation summary
   - Quick reference
   - Success criteria

3. **[ZONELIVE_IMPROVEMENTS.md](ZONELIVE_IMPROVEMENTS.md)**
   - Frontend camera management
   - Database integration details
   - UI/UX improvements

---

## 🏗️ System Components

### 1. RTSP Camera Testing
**File:** `Facerecongination/test_rtsp_camera.py`
```bash
python test_rtsp_camera.py --url "YOUR_RTSP_URL" --duration 10
```

### 2. Camera Streaming Service (Port 5001)
**File:** `Facerecongination/camera_streaming_service.py`
- Real-time face detection
- Face recognition using DeepFace FaceNet
- MJPEG streaming to frontend
- Database logging (entry/exit)

### 3. Frontend Live Display
**File:** `admin-dashboard/src/pages/ZoneLive.jsx`
- Live video from cameras
- Real-time face detection overlay
- Camera configuration management

---

## 🎯 How It Works

```
RTSP Camera → Python Service → Face Detection → Face Recognition
                    ↓                                  ↓
              Video Stream                       Database Log
                    ↓                                  ↓
               Frontend Display              ActivePresence/AttendanceLog
```

### Entry Camera
1. Detects person entering
2. Recognizes face
3. Adds to `ActivePresence` table
4. Shows green box with name on video

### Exit Camera
1. Detects person leaving
2. Recognizes face
3. Removes from `ActivePresence`
4. Logs to `AttendanceLog` with duration
5. Shows red box with name on video

---

## 📊 Ports Used

| Service | Port | URL |
|---------|------|-----|
| Backend API | 3000 | http://localhost:3000 |
| Frontend | 3001 | http://localhost:3001 |
| PostgreSQL | 5000 | localhost:5000 |
| **Streaming Service** | **5001** | **http://localhost:5001** |

---

## ✅ Pre-flight Checklist

Before starting:
- [ ] Backend running: `npm run dev`
- [ ] Frontend running: `cd admin-dashboard && npm run dev`
- [ ] Database accessible
- [ ] RTSP camera tested with VLC or test script
- [ ] Face images enrolled in database
- [ ] Python environment created and activated
- [ ] Dependencies installed: `pip install -r requirements.txt`

---

## 🧪 Testing Steps

### 1. Test RTSP Camera
```bash
python test_rtsp_camera.py --url "rtsp://admin:password@192.168.1.100/stream"
```
**Expected:** Video window opens, shows live feed

### 2. Train Face Recognition
```bash
python enrollment.py --train
```
**Expected:** `embeddings/representations_facenet.json` created

### 3. Start Streaming Service
```bash
python camera_streaming_service.py
```
**Expected:** Service runs on port 5001

### 4. Add Camera in Frontend
1. Go to `http://localhost:3001/zones/1/live`
2. Click "Add Camera"
3. Enter RTSP URL
4. Select camera type (Entry/Exit)
5. Save

**Expected:** Live video appears with face detection

### 5. Verify Database Logging
Walk in front of camera, then check database:
```sql
SELECT * FROM "ActivePresence";
SELECT * FROM "AttendanceLog";
```

---

## 🎓 Common RTSP URL Formats

### Dahua Cameras
```
rtsp://username:password@ip:554/cam/realmonitor?channel=1&subtype=0
```

### Hikvision Cameras
```
rtsp://username:password@ip:554/Streaming/Channels/101
```

### Axis Cameras
```
rtsp://username:password@ip:554/axis-media/media.amp
```

### Generic
```
rtsp://username:password@ip:554/stream
or
rtsp://username:password@ip/stream (port 554 assumed)
```

---

## 🐛 Troubleshooting

### Camera Not Connecting
```
❌ Error: Could not connect to camera
```
**Solutions:**
1. Test URL in VLC Media Player
2. Verify IP/username/password
3. Check RTSP port (usually 554)
4. Ensure camera RTSP is enabled

### No Faces Detected
```
⚠️ No faces appearing on video
```
**Solutions:**
1. Check lighting conditions
2. Adjust camera angle
3. Lower `MIN_FACE_SIZE` in config.py
4. Try different detector: `DETECTOR_BACKEND = "opencv"`

### All Faces Show "Unknown"
```
🔴 Red boxes with "Unknown" label
```
**Solutions:**
1. Run `python enrollment.py --train`
2. Verify embeddings file exists
3. Check person names in database
4. Adjust `DISTANCE_THRESHOLD` (try 12.0 or 15.0)

### Low FPS
```
📉 FPS: 5-10 (should be 20+)
```
**Solutions:**
1. Increase `PROCESS_EVERY_N_FRAMES` to 10 or 15
2. Reduce camera resolution
3. Use faster detector: `opencv` instead of `retinaface`
4. Close other applications

---

## 📈 Performance Tips

1. **Camera Resolution**: Use 720p instead of 1080p
2. **Processing Rate**: Process every 5-10 frames, not every frame
3. **Detector**: Haar Cascade (fast) for detection, DeepFace for recognition
4. **Simultaneous Cameras**: 2-4 cameras on standard laptop
5. **Network**: Use wired connections for cameras

---

## 🎉 Success Indicators

System is working when you see:
- ✅ Live video in frontend
- ✅ Green/red boxes around faces
- ✅ Person names displayed
- ✅ FPS counter shows 20+
- ✅ Database tables update
- ✅ Entry/exit logs created

---

## 📞 API Endpoints

### Camera Streaming Service (Port 5001)

#### Start Camera
```bash
POST http://localhost:5001/cameras/start
{
  "camera_id": 1,
  "camera_url": "rtsp://...",
  "camera_type": "Entry",
  "zone_id": 1
}
```

#### Stream Video
```bash
GET http://localhost:5001/stream/1
```

#### Health Check
```bash
GET http://localhost:5001/health
```

---

## 📝 Configuration

### `config.py`
```python
MODEL_NAME = "Facenet"           # Face recognition model
DISTANCE_THRESHOLD = 10.0        # Recognition threshold (lower = stricter)
MIN_FACE_SIZE = 30              # Minimum face size in pixels
CONSECUTIVE_MATCHES = 3          # Matches needed for confirmation
PROCESS_EVERY_N_FRAMES = 10     # Process every Nth frame
```

---

## 🔧 Files Overview

### Python Scripts
- `test_rtsp_camera.py` - Test RTSP connectivity
- `camera_streaming_service.py` - Main streaming service
- `enrollment.py` - Train face recognition
- `recognition_live.py` - Zone-based recognition
- `recognize.py` - Webcam testing
- `database_handler.py` - Database operations

### Frontend
- `admin-dashboard/src/pages/ZoneLive.jsx` - Live video display
- `admin-dashboard/src/api/api.js` - API client

### Documentation
- `CAMERA_FACE_RECOGNITION_GUIDE.md` - Complete guide
- `RTSP_INTEGRATION_SUMMARY.md` - Implementation summary
- `ZONELIVE_IMPROVEMENTS.md` - Frontend improvements

### Utilities
- `quick_start.bat` - Windows quick start menu
- `camera_config_example.json` - Example configurations

---

## 🚀 Production Deployment

For production use:
1. Use HTTPS for frontend and APIs
2. Set up camera streaming as system service
3. Configure firewall rules
4. Enable GPU acceleration (TensorFlow-GPU)
5. Set up monitoring and alerts
6. Configure automatic backups
7. Implement failover for critical cameras

---

## 💡 Tips & Best Practices

1. **Always test cameras** with `test_rtsp_camera.py` before adding to system
2. **Train with 3-5 images** per person for better accuracy
3. **Use Entry/Exit pairs** instead of "Both" type cameras
4. **Monitor FPS** - keep above 20 for smooth operation
5. **Good lighting** is crucial for face recognition
6. **Wired connections** for cameras are more reliable than WiFi
7. **Regular training** - retrain when adding new people

---

## 📚 Additional Resources

- DeepFace Documentation: https://github.com/serengil/deepface
- OpenCV RTSP Guide: https://docs.opencv.org/
- RTSP Protocol: https://en.wikipedia.org/wiki/Real_Time_Streaming_Protocol

---

## 🎯 Next Features (Future Enhancements)

- [ ] GPU acceleration support
- [ ] Mobile app for monitoring
- [ ] Email/SMS alerts for unknown faces
- [ ] Video recording and playback
- [ ] Advanced analytics dashboard
- [ ] Multi-zone simultaneous monitoring
- [ ] Face mask detection
- [ ] Age and gender detection

---

## 📞 Support

For issues or questions:
1. Check [CAMERA_FACE_RECOGNITION_GUIDE.md](CAMERA_FACE_RECOGNITION_GUIDE.md) troubleshooting section
2. Review error logs in terminal
3. Test components individually
4. Verify all services are running

---

**Status:** ✅ Fully Operational  
**Version:** 2.0 - Complete RTSP Integration  
**Last Updated:** December 13, 2025

---

## ⚡ Quick Command Reference

```bash
# Test camera
python test_rtsp_camera.py --url "rtsp://..."

# Train faces
python enrollment.py --train

# Start streaming
python camera_streaming_service.py

# Check health
curl http://localhost:5001/health

# View database
psql -U postgres -p 5000 -d FYP_Intellisight -c 'SELECT * FROM "ActivePresence";'
```

---

**Ready to start!** 🎉

Run `quick_start.bat` or follow the manual setup steps above.
