# Face-API.js Models - Setup & Troubleshooting Guide

## ✅ Model Files Status

The following model files are required and **currently present** in `/public/models/`:

### Required Files:
1. ✅ `tiny_face_detector_model-weights_manifest.json` (2.9 KB)
2. ✅ `tiny_face_detector_model-shard1` (189 KB)
3. ✅ `face_landmark_68_model-weights_manifest.json` (7.8 KB)
4. ✅ `face_landmark_68_model-shard1` (349 KB)
5. ✅ `face_recognition_model-weights_manifest.json` (18 KB)
6. ✅ `face_recognition_model-shard1` (4.0 MB)
7. ✅ `face_recognition_model-shard2` (2.1 MB)

**Total Size**: ~7 MB

---

## 🔍 How Models Are Loaded

The models are loaded from `/models` URL path, which maps to `/public/models/` directory:

```javascript
// src/utils/faceRecognition.js
const MODEL_URL = '/models';

// Loads from: http://localhost:3001/models/
await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
```

---

## 🚨 Common Issues & Solutions

### Issue 1: "Model loading failed"

**Symptoms**: Zone Live page shows error message about models not loading.

**Possible Causes**:
1. Frontend server not running
2. Files missing or corrupted
3. Browser cache issues
4. CORS issues (rare with Vite)

**Solutions**:

#### Step 1: Verify Server is Running
```bash
# Should be running on http://localhost:3001
npm run dev
```

#### Step 2: Test Model Access
Open browser console and try:
```javascript
fetch('http://localhost:3001/models/tiny_face_detector_model-weights_manifest.json')
  .then(r => r.json())
  .then(d => console.log('✅ Model accessible:', d))
  .catch(e => console.error('❌ Model not accessible:', e))
```

#### Step 3: Clear Browser Cache
- Press `Ctrl + Shift + R` (hard refresh)
- Or clear cache: `Ctrl + Shift + Delete`

#### Step 4: Check File Integrity
```bash
cd admin-dashboard/public/models
ls -lh *.json
ls -lh *shard*
```

All files should have non-zero sizes.

---

### Issue 2: "Failed to fetch" Errors

**Cause**: Network issues or incorrect URL

**Solution**:
1. Open browser DevTools (F12)
2. Go to Network tab
3. Reload Zone Live page
4. Look for failed requests to `/models/` path
5. Check the exact URL being requested

---

### Issue 3: Models Load but Detection Fails

**Symptoms**: Models load successfully but faces aren't detected

**Possible Causes**:
1. Camera not accessible
2. Lighting too dark
3. Face too small or too far from camera
4. Browser doesn't support getUserMedia

**Solutions**:

#### Check Camera Access:
```javascript
navigator.mediaDevices.getUserMedia({ video: true })
  .then(() => console.log('✅ Camera accessible'))
  .catch(e => console.error('❌ Camera error:', e))
```

#### Lighting Requirements:
- Ensure adequate lighting on face
- Avoid backlighting (light behind person)
- Face should be clearly visible

#### Distance Requirements:
- Face should occupy at least 10-15% of camera frame
- Too close or too far reduces detection accuracy

---

## 🔧 Manual Model Download

If models are missing or corrupted, download them manually:

### Option 1: Using npm script
```bash
cd admin-dashboard
npm run download-models
```

### Option 2: Using PowerShell (Windows)
```powershell
cd admin-dashboard
./download-models.ps1
```

### Option 3: Manual Download
Download from GitHub:
```
Base URL: https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/

Files:
- tiny_face_detector_model-weights_manifest.json
- tiny_face_detector_model-shard1
- face_landmark_68_model-weights_manifest.json
- face_landmark_68_model-shard1
- face_recognition_model-weights_manifest.json
- face_recognition_model-shard1
- face_recognition_model-shard2
```

Save all files to: `admin-dashboard/public/models/`

---

## 📊 Model Loading Process

### On Zone Live Page Load:

1. **Initialize Face Recognition** (`initializeFaceRecognition()`)
   ```
   ├─ Load Models (from /models)
   │  ├─ TinyFaceDetector (189 KB)
   │  ├─ FaceLandmark68Net (349 KB)
   │  └─ FaceRecognitionNet (6.1 MB)
   │
   ├─ Fetch Face Database (from backend API)
   │  ├─ Students with face images
   │  └─ Teachers with face images
   │
   └─ Extract Face Descriptors
      └─ Convert images to 128-dimensional vectors
   ```

2. **Start Face Detection** (automatic, every 1000ms)
   ```
   For each camera feed:
   ├─ Capture video frame
   ├─ Detect faces (TinyFaceDetector)
   ├─ Extract landmarks (FaceLandmark68Net)
   ├─ Generate descriptor (FaceRecognitionNet)
   ├─ Match against known faces
   └─ Display results
   ```

---

## 🧪 Testing Model Loading

### Test in Browser Console:

```javascript
// 1. Test if faceapi is loaded
console.log('face-api.js version:', faceapi.version);

// 2. Test model loading
async function testModels() {
  try {
    await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
    console.log('✅ TinyFaceDetector loaded');
    
    await faceapi.nets.faceLandmark68Net.loadFromUri('/models');
    console.log('✅ FaceLandmark68Net loaded');
    
    await faceapi.nets.faceRecognitionNet.loadFromUri('/models');
    console.log('✅ FaceRecognitionNet loaded');
    
    console.log('🎉 All models loaded successfully!');
  } catch (error) {
    console.error('❌ Model loading failed:', error);
  }
}

testModels();
```

---

## 📝 Browser Console Commands

### Check Model Files Accessibility:
```javascript
const models = [
  'tiny_face_detector_model-weights_manifest.json',
  'face_landmark_68_model-weights_manifest.json',
  'face_recognition_model-weights_manifest.json'
];

models.forEach(async (model) => {
  try {
    const response = await fetch(`/models/${model}`);
    console.log(`✅ ${model}: ${response.status}`);
  } catch (error) {
    console.error(`❌ ${model}: ${error.message}`);
  }
});
```

---

## 🐛 Detailed Error Logging

The updated code now provides detailed error messages:

- **TinyFaceDetector failed**: Face detection model issue
- **FaceLandmark68Net failed**: Landmark detection model issue  
- **FaceRecognitionNet failed**: Recognition model issue

Each error will show:
- Which specific model failed
- The exact error message
- What files should exist
- How to fix the issue

---

## ✅ Verification Checklist

Before reporting issues, verify:

- [ ] Frontend server running (`npm run dev`)
- [ ] Backend server running (port 3000)
- [ ] All 7 model files present in `/public/models/`
- [ ] Model files have non-zero sizes
- [ ] Browser console shows no 404 errors
- [ ] Camera permissions granted
- [ ] No browser extensions blocking resources

---

## 🎯 Current Status

**Models Location**: `admin-dashboard/public/models/`
**Models URL**: `http://localhost:3001/models/`
**All Required Files**: ✅ Present
**Total Size**: ~7 MB

The models are correctly placed and should load successfully!

---

## 📞 Still Having Issues?

1. Check browser console (F12) for specific error messages
2. Look at Network tab for failed requests
3. Verify file sizes match expected values
4. Try different browser (Chrome/Edge recommended)
5. Disable browser extensions temporarily

---

**Last Updated**: December 4, 2025
