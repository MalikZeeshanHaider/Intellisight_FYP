# IntelliSight Face Recognition System - Complete Guide

## 📁 Clean Project Structure

```
Intellisight_FYP/
├── Facerecongination/          # Face Recognition System (DeepFace FaceNet)
│   ├── images/                 # 📂 Training images (auto-populated from frontend)
│   │   └── {PersonName}/       # Folder created automatically with person's name
│   │       ├── image_1.jpg     # Auto-saved face pictures
│   │       ├── image_2.jpg
│   │       ├── image_3.jpg
│   │       ├── image_4.jpg
│   │       └── image_5.jpg
│   ├── embeddings/             # Generated after training
│   │   └── representations_facenet.json
│   ├── train.py                # Training script (auto-triggered)
│   ├── recognize.py            # Live recognition script
│   └── config.py               # Configuration settings
│
├── admin-dashboard/            # Frontend (React + Vite)
└── src/                        # Backend (Node.js + Express)
```

---

## 🔄 Automatic Workflow (How It Works)

### **Step 1: Add Student/Teacher via Frontend**

1. Open: `http://localhost:3001`
2. Login: `john.admin@intellisight.com` / `admin123`
3. Go to **Students** or **Teachers** page
4. Click **Add New**
5. Fill details and **capture 5 face pictures**
6. Click **Save**

### **Step 2: What Happens Automatically**

```
Frontend (Save) 
    ↓
Backend receives data
    ↓
Images saved to: Facerecongination/images/{PersonName}/
    ↓
AUTO-TRAINING triggered (train.py runs automatically)
    ↓
Embeddings generated in: embeddings/representations_facenet.json
    ↓
Ready for recognition!
```

**You don't need to manually train!** Training happens automatically when you add/update a student or teacher.

---

## 📸 Image Requirements

### **For Best Recognition Accuracy:**

1. **Image Quality**
   - Clear, well-lit photos
   - Face should be clearly visible
   - Minimum resolution: 200x200 pixels
   - Formats: JPG, JPEG, PNG

2. **Number of Images**
   - Minimum: 3 images per person
   - Recommended: 5-10 images per person
   - More variety = better accuracy

3. **Variety**
   - Different angles (front, slight left/right)
   - Different lighting conditions
   - With/without glasses (if applicable)
   - Different expressions

4. **What to Avoid**
   - Blurry images
   - Face too small in frame
   - Heavy shadows on face
   - Extreme angles
   - Sunglasses or face coverings

---

## 🔧 What Was Missing (Now Fixed)

| Issue | Solution |
|-------|----------|
| Images not saved to train folder | Created `imageSaving.service.js` that saves to `Facerecongination/images/` |
| Old algorithm still referenced | Updated all controllers to use `Facerecongination/` path |
| No automatic image saving on student/teacher creation | Added `savePersonImages()` calls in controllers |
| Training script not integrated | Created `enrollment.py` for database-based training |

---

## 🚀 Quick Start Commands

### **1. Start Backend**
```powershell
cd D:\fffffffffffffffff\Intellisight_FYP
npm run dev
```

### **2. Start Frontend**
```powershell
cd D:\fffffffffffffffff\Intellisight_FYP\admin-dashboard
npm run dev
```

### **3. Install Python Dependencies (First Time)**
```powershell
cd D:\fffffffffffffffff\Intellisight_FYP\Facerecongination
pip install -r requirements.txt
```

### **4. Train Model**
```powershell
cd D:\fffffffffffffffff\Intellisight_FYP\Facerecongination
python train.py
```

### **5. Start Live Recognition**
```powershell
cd D:\fffffffffffffffff\Intellisight_FYP\Facerecongination
python recognize.py
```

---

## 📂 Folder Structure for Training Images

```
Facerecongination/
└── images/
    ├── Ali/
    │   ├── 1.jpg
    │   ├── 2.jpg
    │   └── 3.jpg
    ├── Moiz/
    │   ├── photo1.jpg
    │   └── photo2.jpg
    ├── Zeeshan/
    │   ├── image_1.jpg    # Auto-saved from frontend
    │   ├── image_2.jpg
    │   ├── image_3.jpg
    │   ├── image_4.jpg
    │   └── image_5.jpg
    └── John_Smith/        # New person added via frontend
        ├── image_1.jpg
        ├── image_2.jpg
        ├── image_3.jpg
        ├── image_4.jpg
        └── image_5.jpg
```

---

## 🔍 How Detection Works

1. **Camera captures frame**
2. **Face detection** (Haar Cascade for speed)
3. **Face cropping** with margin
4. **Embedding generation** (DeepFace FaceNet - 128D vector)
5. **Distance comparison** with stored embeddings
6. **Match found** if distance < 10.0 (threshold)
7. **Entry/Exit logged** to database

---

## ⚙️ Configuration

Edit `Facerecongination/config.py` to adjust:

```python
# Face recognition settings
MODEL_NAME = "Facenet"          # Model to use
DETECTOR_BACKEND = "retinaface" # Face detector
DISTANCE_THRESHOLD = 10.0       # Match threshold (lower = stricter)
MIN_FACE_SIZE = 30              # Minimum face size in pixels
CONSECUTIVE_MATCHES = 3         # Matches needed for confirmation
```

---

## 🔗 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/face-recognition/enroll` | POST | Enroll single person |
| `/api/face-recognition/enroll-all` | POST | Enroll all persons |
| `/api/face-recognition/start/:zoneId` | POST | Start recognition for zone |
| `/api/live-recognition/start/:zoneId` | POST | Start live recognition |
| `/api/live-recognition/stop/:zoneId` | POST | Stop live recognition |
| `/api/live-recognition/status` | GET | Get active recognition status |

---

## ✅ Checklist for New Deployment

- [ ] PostgreSQL database running on port 5432
- [ ] Backend running on port 3000
- [ ] Frontend running on port 3001
- [ ] Python environment set up with dependencies
- [ ] At least one camera configured in database
- [ ] At least one zone created
- [ ] Training images in `Facerecongination/images/`
- [ ] Model trained (`representations_facenet.json` exists)

---

## 🐛 Troubleshooting

### "No embeddings found"
→ Run `python train.py` to generate embeddings

### "No person folders found"
→ Add folders with images to `Facerecongination/images/`

### "Camera not opening"
→ Check camera URL in database (Camara table)

### "Face not detected"
→ Ensure good lighting and clear face visibility

### "Recognition not accurate"
→ Add more training images with variety
