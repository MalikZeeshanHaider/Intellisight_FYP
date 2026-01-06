run frontend on WSL: cd /mnt/e/FYP/Intellisight_FYP/new/Intellisight_FYP/admin-dashboard && npm run dev -- --host 0.0.0.0 --port 3001
run Backend on WSL: cd /mnt/e/FYP/Intellisight_FYP/new/Intellisight_FYP && node src/server.js
run Backend on WSL: cd /mnt/e/FYP/Intellisight_FYP/new/Intellisight_FYP/Facerecongination && source .venv/bin/activate && python gpu_face_service.py
-
camara 1 cammand: curl -s -X POST http://localhost:3002/cameras/start \
  -H "Content-Type: application/json" \
  -d '{"camera_id": 2, "camera_url": "rtsp://admin:ozair123@192.168.10.2/cam/realmonitor?channel=1&subtype=0", "camera_type": "Entry", "zone_id": 2}' | python3 -m json.tool
camara 2 cammand: curl -s -X POST http://localhost:3002/cameras/start   -H "Content-Type: application/json"   -d '{"camera_id": 3, "camera_url": "rtsp://admin
:Ozair-12@192.168.10.4", "camera_type": "Entry", "zone_id": 2}' | python3 -m json.tooll
# IntelliSight - Complete Facial Recognition Access Control System

A production-ready system combining Node.js backend with Python-based face recognition for intelligent access control and attendance tracking.

## 📋 Overview

### Backend (Node.js + Express + PostgreSQL)
- ✅ JWT-based authentication with role-based access control
- ✅ Complete CRUD APIs for Admin, Zone, Camera, Teacher, Students
- ✅ Smart entry/exit tracking with duplicate prevention
- ✅ Face picture storage (base64/buffer in PostgreSQL)
- ✅ Analytics and reporting endpoints
- ✅ Request validation with Zod
- ✅ Docker support for deployment
- ✅ Comprehensive test suite (32/32 passing)

### Face Recognition (Python + OpenCV + dlib)
- ✅ Real-time face detection (Haar Cascade & DNN)
- ✅ Face recognition with face_recognition library
- ✅ Automatic entry/exit tracking
- ✅ Offline mode with auto-sync
- ✅ Multi-camera support
- ✅ REST API integration with backend
- ✅ Performance optimized for Raspberry Pi

## 🚀 System Architecture

```
┌─────────────────────────────────────────────────────────┐
│         Python Face Recognition System                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │ OpenCV   │→ │   Face   │→ │  Person  │              │
│  │ Detector │  │ Matching │  │ Tracker  │              │
│  └──────────┘  └──────────┘  └──────────┘              │
│        ↓              ↓              ↓                   │
│     POST /api/timetable/entry                           │
│     POST /api/timetable/exit                            │
└─────────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────┐
│         Node.js Backend API (Port 3000)                 │
│  ┌─────────────────────────────────────────┐            │
│  │   Express Routes + JWT Authentication   │            │
│  └─────────────────────────────────────────┘            │
│        ↓                                                 │
│  ┌─────────────────────────────────────────┐            │
│  │      PostgreSQL Database (Port 5000)    │            │
│  │  - Admins, Zones, Cameras               │            │
│  │  - Teachers, Students                    │            │
│  │  - TimeTable (Entry/Exit logs)          │            │
│  └─────────────────────────────────────────┘            │
└─────────────────────────────────────────────────────────┘
```

## 📦 Project Components

### 1. Backend API (Node.js)
- **Location**: `./` (root directory)
- **Tech Stack**: Express.js, Prisma ORM, PostgreSQL, JWT
- **Port**: 3000
- **Documentation**: This README

### 2. Face Recognition System (Python)
- **Location**: `./face-recognition/`
- **Tech Stack**: OpenCV, face_recognition, dlib, NumPy
- **Documentation**: `face-recognition/README.md`, `face-recognition/QUICKSTART.md`

## 🔧 Prerequisites

### Backend Requirements
- **Node.js** >= 18.x (recommended: v18.17.0+)
- **npm** >= 9.x
- **PostgreSQL** >= 14.x (running on port 5000)
- **Git** (for version control)

### Face Recognition Requirements
- **Python** >= 3.8 (recommended: 3.10+)
- **pip** (Python package manager)
- **CMake** (for building dlib)
- **Visual Studio Build Tools** (Windows only)
- **Webcam** or IP camera

## 🚀 Complete Setup Guide

### Part 1: Backend Setup (5 minutes)

#### 1. Clone and Install Backend

```bash
# Navigate to project directory
cd d:\FYPprojectIntelisight

# Install dependencies
npm install
```

#### 2. Configure Environment

```bash
# Copy environment template
cp .env.example .env

# Edit .env with your settings (already configured for local PostgreSQL)
```

Default `.env` values:
```env
DATABASE_URL="postgresql://postgres:zeeshan@localhost:5000/FYP_Intellisight?schema=public"
JWT_SECRET="your-super-secret-jwt-key-change-this-in-production"
JWT_EXPIRES_IN="7d"
BCRYPT_ROUNDS=10
PORT=3000
NODE_ENV="development"
```

#### 3. Setup Database

```bash
# Generate Prisma Client
npx prisma generate

# Run database migrations
npx prisma migrate dev --name init

# Seed sample data
npm run seed
```

### 4. Start Development Server

```bash
# Start server with hot-reload
npm run dev

# Server runs on http://localhost:3000
```

### 5. Verify Installation

```bash
# Test server health
curl http://localhost:3000/health

# Expected response:
# {"status":"ok","timestamp":"2025-11-19T...","database":"connected"}
```

### Part 2: Face Recognition Setup (10 minutes)

#### 1. Install Python Dependencies

**Windows:**
```powershell
# Install CMake (required for dlib)
choco install cmake

# Or download from https://cmake.org/download/

# Install Visual Studio Build Tools
# Download from https://visualstudio.microsoft.com/downloads/
# Select "Desktop development with C++"

# Navigate to face recognition directory
cd face-recognition

# Install Python packages
pip install -r requirements.txt
```

**Linux/Ubuntu:**
```bash
cd face-recognition

# Install system dependencies
sudo apt-get update
sudo apt-get install -y python3-pip cmake build-essential

# Install Python dependencies
pip3 install -r requirements.txt
```

#### 2. Configure Face Recognition

```bash
# Copy environment template
cp .env.example .env

# Default settings work out-of-the-box!
# Edit only if you need to change camera, zone, or backend URL
```

#### 3. Collect Training Images

**Option A: Use Capture Tool (Recommended)**
```bash
# Capture 10 images for student ID 1
python capture_images.py --person student_1 --count 10

# Capture 10 images for student ID 2
python capture_images.py --person student_2 --count 10

# Capture 10 images for teacher ID 1
python capture_images.py --person teacher_1 --count 10
```

**Option B: Manual Upload**
1. Create folders: `dataset/student_1/`, `dataset/student_2/`, etc.
2. Add 5-10 clear photos per person
3. Images should be JPG, PNG, or BMP format

See `face-recognition/dataset/README.md` for detailed guidelines.

#### 4. Train Face Recognition Model

```bash
# Train encodings (takes 30-60 seconds)
python train_encodings.py --validate

# Expected output: "✅ Training Complete! Total encodings: XX"
```

#### 5. Start Live Recognition

```bash
# Make sure backend is running on http://localhost:3000
# Then start face recognition
python live_recognition.py

# A window will open showing live camera feed
# Recognized faces will have green boxes with labels
```

**Controls:**
- `q` - Quit
- `s` - Sync offline entries
- `r` - Reset tracker

### Part 3: Testing the Complete System (2 minutes)

#### Test Face Recognition Integration

1. **Backend Should Be Running**: `http://localhost:3000`
2. **Face Recognition Running**: Camera window showing live feed
3. **Stand in front of camera**: You should see:
   - Green box around your face
   - Label showing "STUDENT_1" or "TEACHER_1"
   - Console log: "👋 NEW ENTRY: STUDENT_1"
   - Console log: "✅ Entry logged: STUDENT_1"

4. **Move away from camera**: After 3 seconds you should see:
   - Console log: "👋 NEW EXIT: STUDENT_1"
   - Console log: "✅ Exit logged: STUDENT_1"

5. **Verify in Database**:
```powershell
# Login to backend
$body = '{"email":"john.admin@intellisight.com","password":"admin123"}'
$login = Invoke-RestMethod -Uri http://localhost:3000/api/auth/login -Method Post -Body $body -ContentType 'application/json'
$token = $login.data.token

# Get active persons
$headers = @{Authorization="Bearer $token"}
$active = Invoke-RestMethod -Uri http://localhost:3000/api/timetable/active -Headers $headers
$active.data | Format-Table
```

✅ **Success!** Your complete IntelliSight system is now operational.

## 📝 Quick Reference

### Starting the System Daily

**Terminal 1 - Backend:**
```bash
npm run dev
```

**Terminal 2 - Face Recognition:**
```bash
cd face-recognition
python live_recognition.py
```

### Adding New People

```bash
# Capture training images
cd face-recognition
python capture_images.py --person student_5 --count 10

# Retrain model
python train_encodings.py

# Recognition will automatically pick up new people
```

### Monitoring

- **Backend logs**: Terminal running `npm run dev`
- **Face recognition logs**: `face-recognition/logs/system.log`
- **Offline entries**: `face-recognition/logs/offline_entries.json`
- **Active persons**: `http://localhost:3000/api/timetable/active`

## 📚 Documentation

### Backend Documentation
- **Main Guide**: This README
- **Testing Guide**: `TESTING.md`
- **Sample Requests**: `SAMPLE_REQUESTS.md`
- **Quick Start**: `QUICKSTART.md`
- **Deployment**: `DEPLOYMENT.md`

### Face Recognition Documentation
- **Complete Guide**: `face-recognition/README.md`
- **Quick Start**: `face-recognition/QUICKSTART.md`
- **Dataset Guide**: `face-recognition/dataset/README.md`

### 2. Configure Environment

```bash
# Copy environment template
cp .env.example .env

# Edit .env with your settings (already configured for local PostgreSQL)
```

```bash
# Copy environment template
cp .env.example .env

# Edit .env with your settings (already configured for local PostgreSQL)
```

Default `.env` values:
```env
DATABASE_URL="postgresql://postgres:zeeshan@localhost:5000/FYP_Intellisight?schema=public"
JWT_SECRET="your-super-secret-jwt-key-change-this-in-production"
JWT_EXPIRES_IN="7d"
BCRYPT_ROUNDS=10
PORT=3000
NODE_ENV="development"
```

### 3. Setup Database

```bash
# Generate Prisma Client
npx prisma generate

# Run database migrations
npx prisma migrate dev --name init

# Seed sample data
npm run seed
```

### 4. Start Development Server

```bash
# Start server with hot-reload
npm run dev

# Server runs on http://localhost:3000
```

### 5. Verify Installation

```bash
# Test server health
curl http://localhost:3000/health

# Expected response:
# {"status":"ok","timestamp":"2025-11-19T...","database":"connected"}
```

## 📁 Project Structure

```
d:\FYPprojectIntelisight\
├── .env                          # Environment variables (DO NOT commit)
├── .env.example                  # Environment template
├── .gitignore                    # Git ignore rules
├── package.json                  # Dependencies and scripts
├── docker-compose.yml            # Docker orchestration
├── Dockerfile                    # Backend container image
├── README.md                     # This file
├── jest.config.js                # Test configuration
├── prisma/
│   ├── schema.prisma            # Database schema
│   ├── seed.js                  # Sample data seeder
│   └── migrations/              # Database migrations
│       └── 20251119_init/
│           └── migration.sql
├── src/
│   ├── server.js                # Entry point
│   ├── app.js                   # Express app configuration
│   ├── config/
│   │   ├── database.js          # Prisma client instance
│   │   └── constants.js         # App constants
│   ├── middlewares/
│   │   ├── auth.js              # JWT authentication
│   │   ├── errorHandler.js      # Global error handling
│   │   ├── validateRequest.js   # Zod validation middleware
│   │   └── upload.js            # File upload handling
│   ├── routes/
│   │   ├── index.js             # Route aggregator
│   │   ├── auth.routes.js       # Authentication routes
│   │   ├── admin.routes.js      # Admin CRUD
│   │   ├── zone.routes.js       # Zone CRUD
│   │   ├── camera.routes.js     # Camera CRUD
│   │   ├── teacher.routes.js    # Teacher CRUD
│   │   ├── student.routes.js    # Student CRUD
│   │   └── timetable.routes.js  # Entry/Exit tracking
│   ├── controllers/
│   │   ├── auth.controller.js
│   │   ├── admin.controller.js
│   │   ├── zone.controller.js
│   │   ├── camera.controller.js
│   │   ├── teacher.controller.js
│   │   ├── student.controller.js
│   │   └── timetable.controller.js
│   ├── services/
│   │   ├── auth.service.js      # JWT & bcrypt logic
│   │   ├── timetable.service.js # Entry/exit business logic
│   │   └── upload.service.js    # File processing
│   ├── validators/
│   │   ├── auth.validator.js
│   │   ├── admin.validator.js
│   │   ├── zone.validator.js
│   │   ├── camera.validator.js
│   │   ├── teacher.validator.js
│   │   ├── student.validator.js
│   │   └── timetable.validator.js
│   └── utils/
│       ├── response.js          # Standardized API responses
│       ├── errors.js            # Custom error classes
│       └── logger.js            # Logging utility
└── tests/
    ├── setup.js                 # Test environment setup
    ├── auth.test.js             # Auth endpoint tests
    ├── admin.test.js            # Admin CRUD tests
    ├── zone.test.js             # Zone CRUD tests
    ├── camera.test.js           # Camera CRUD tests
    ├── teacher.test.js          # Teacher CRUD tests
    ├── student.test.js          # Student CRUD tests
    └── timetable.test.js        # Entry/exit logic tests
```

## 📦 NPM Scripts

```bash
npm run dev          # Start development server with nodemon
npm start            # Start production server
npm run seed         # Populate database with sample data
npm test             # Run all tests
npm run test:watch   # Run tests in watch mode
npm run migrate      # Run Prisma migrations
npm run studio       # Open Prisma Studio (database GUI)
npm run docker:up    # Start Docker containers
npm run docker:down  # Stop Docker containers
```

## 🔐 Authentication Flow

### 1. Admin Registration

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Admin",
    "email": "john@intellisight.com",
    "password": "SecurePass123!",
    "role": "Super Admin"
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "admin": {
      "Admin_ID": 1,
      "Name": "John Admin",
      "Email": "john@intellisight.com",
      "Role": "Super Admin"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  },
  "message": "Admin registered successfully"
}
```

### 2. Admin Login

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@intellisight.com",
    "password": "SecurePass123!"
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "admin": {
      "Admin_ID": 1,
      "Name": "John Admin",
      "Email": "john@intellisight.com",
      "Role": "Super Admin"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  },
  "message": "Login successful"
}
```

### 3. Using JWT Token

Add `Authorization` header to all protected routes:

```bash
curl -X GET http://localhost:3000/api/zones \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE"
```

## 🌐 API Endpoints

### Health Check
- `GET /health` - Server health status

### Authentication (Public)
- `POST /api/auth/register` - Register new admin
- `POST /api/auth/login` - Admin login

### Admin Management (Protected)
- `GET /api/admins` - List all admins
- `GET /api/admins/:id` - Get admin by ID
- `PUT /api/admins/:id` - Update admin
- `DELETE /api/admins/:id` - Delete admin

### Zone Management (Protected)
- `GET /api/zones` - List all zones
- `GET /api/zones/:id` - Get zone by ID
- `POST /api/zones` - Create new zone
- `PUT /api/zones/:id` - Update zone
- `DELETE /api/zones/:id` - Delete zone

### Camera Management (Protected)
- `GET /api/cameras` - List all cameras
- `GET /api/cameras/:id` - Get camera by ID
- `POST /api/cameras` - Create new camera
- `PUT /api/cameras/:id` - Update camera
- `DELETE /api/cameras/:id` - Delete camera

### Teacher Management (Protected)
- `GET /api/teachers` - List all teachers
- `GET /api/teachers/:id` - Get teacher details
- `POST /api/teachers` - Create new teacher
- `PUT /api/teachers/:id` - Update teacher
- `DELETE /api/teachers/:id` - Delete teacher
- `POST /api/teachers/:id/face-picture` - Upload face picture (base64)

### Student Management (Protected)
- `GET /api/students` - List all students
- `GET /api/students/:id` - Get student details
- `POST /api/students` - Create new student
- `PUT /api/students/:id` - Update student
- `DELETE /api/students/:id` - Delete student
- `POST /api/students/:id/face-picture` - Upload face picture (base64)

### TimeTable / Entry-Exit Tracking (Protected)
- `POST /api/timetable/entry` - Record entry event
- `POST /api/timetable/exit` - Record exit event
- `GET /api/timetable` - Query entry/exit logs (with filters)
- `GET /api/timetable/active` - Get currently active persons (no exit)
- `GET /api/timetable/analytics` - Analytics dashboard data

## 📝 Detailed API Examples

### Create Zone

```bash
curl -X POST http://localhost:3000/api/zones \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "Zone_Name": "Science Lab - Floor 3"
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "Zone_id": 6,
    "Zone_Name": "Science Lab - Floor 3"
  },
  "message": "Zone created successfully"
}
```

### Create Camera

```bash
curl -X POST http://localhost:3000/api/cameras \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "Password": "cam_secure_007",
    "Zone_id": 6
  }'
```

### Create Student with Face Picture

```bash
curl -X POST http://localhost:3000/api/students \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "Name": "Alice Johnson",
    "Email": "alice.j@student.intellisight.edu",
    "Camara_Id": 1,
    "Zone_id": 1,
    "Face_Pictures": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
  }'
```

### Record Entry Event

```bash
curl -X POST http://localhost:3000/api/timetable/entry \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "personType": "STUDENT",
    "personId": 1,
    "zoneId": 1,
    "cameraId": 1
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "TimeTable_ID": 15,
    "EntryTime": "2025-11-19T10:30:00.000Z",
    "ExitTime": null,
    "PersonType": "STUDENT",
    "Student_ID": 1,
    "Zone_id": 1
  },
  "message": "Entry recorded successfully"
}
```

### Record Exit Event

```bash
curl -X POST http://localhost:3000/api/timetable/exit \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "personType": "STUDENT",
    "personId": 1,
    "zoneId": 1
  }'
```

### Query TimeTable with Filters

```bash
# Get all entries for a specific zone today
curl -X GET "http://localhost:3000/api/timetable?zoneId=1&from=2025-11-19T00:00:00Z&to=2025-11-19T23:59:59Z" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Get all entries for a specific student
curl -X GET "http://localhost:3000/api/timetable?personType=STUDENT&personId=1" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Get currently active users
curl -X GET "http://localhost:3000/api/timetable/active" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 🐳 Docker Deployment

### Using Docker Compose (Recommended)

```bash
# Start PostgreSQL + Backend
npm run docker:up

# Or manually:
docker-compose up -d

# View logs
docker-compose logs -f backend

# Stop containers
npm run docker:down
```

### Build and Run Manually

```bash
# Build backend image
docker build -t intellisight-backend .

# Run container
docker run -p 3000:3000 \
  -e DATABASE_URL="postgresql://postgres:zeeshan@host.docker.internal:5000/FYP_Intellisight" \
  -e JWT_SECRET="your-secret-key" \
  intellisight-backend
```

## 🧪 Testing

### Run All Tests

```bash
npm test
```

### Run Specific Test Suite

```bash
npm test -- auth.test.js
npm test -- timetable.test.js
```

### Test with Coverage

```bash
npm test -- --coverage
```

## 🔒 Security Best Practices

1. **Environment Variables**: Never commit `.env` file. Always use `.env.example` as template.

2. **Password Hashing**: All passwords hashed with bcrypt (10 rounds by default).

3. **JWT Tokens**: 
   - Expire after 7 days (configurable)
   - Store securely on client (httpOnly cookies recommended for production)
   - Use strong JWT_SECRET (min 32 characters)

4. **Face Picture Storage**:
   - **Current Implementation**: Base64 → Buffer → PostgreSQL BYTEA
   - **Production Recommendation**: Use AWS S3, Azure Blob, or Cloudinary
   - **Why**: Database bloat, better CDN support, cost efficiency

5. **CORS**: Configure allowed origins in production (currently allows all in dev)

6. **Rate Limiting**: Implement rate limiting for auth endpoints in production

7. **Input Validation**: All requests validated with Zod schemas

## 📊 Database Schema Notes

### Face Picture Storage Options

**Current (Development):**
- Stored as `BYTEA` in PostgreSQL
- Accepts base64 strings, converts to Buffer
- Max recommended size: 1MB per picture

**Production Recommendation:**
```javascript
// Option 1: Store S3 URLs instead of bytes
model Teacher {
  Face_Pictures String? // URL to S3 object
}

// Option 2: Separate media table
model Media {
  id        Int     @id @default(autoincrement())
  url       String
  type      String
  teacherId Int?
  studentId Int?
}
```

### Entry/Exit Logic

**Algorithm:**
1. **Entry Event**: Create new TimeTable record with EntryTime
2. **Exit Event**: Find most recent TimeTable with null ExitTime for person, update ExitTime
3. **Duplicate Prevention**: Check for existing open entry before creating new one
4. **Edge Cases**:
   - Exit without entry: Create record with null EntryTime (logs anomaly)
   - Multiple open entries: Close oldest first (FIFO)

## 🚢 Production Deployment

### Environment Variables (Production)

```env
DATABASE_URL="postgresql://user:password@prod-host:5432/dbname?ssl=true"
JWT_SECRET="min-32-char-cryptographically-secure-random-string"
JWT_EXPIRES_IN="24h"
NODE_ENV="production"
PORT=3000
BCRYPT_ROUNDS=12
```

### Deployment Platforms

#### 1. Railway.app
```bash
# Install Railway CLI
npm i -g @railway/cli

# Login and deploy
railway login
railway init
railway up
```

#### 2. Heroku
```bash
# Add PostgreSQL addon
heroku addons:create heroku-postgresql:hobby-dev

# Deploy
git push heroku main
```

#### 3. VPS (Ubuntu)
```bash
# Install Node.js, PostgreSQL
# Clone repo
# Install dependencies
npm ci --production
npx prisma generate
npx prisma migrate deploy

# Use PM2 for process management
npm i -g pm2
pm2 start src/server.js --name intellisight
pm2 save
pm2 startup
```

## ✅ Verification Checklist

After setup, verify:

- [ ] PostgreSQL is running on port 5000
- [ ] `npm install` completes without errors
- [ ] `.env` file exists with correct DATABASE_URL
- [ ] `npx prisma generate` succeeds
- [ ] `npx prisma migrate dev` creates tables
- [ ] `npm run seed` inserts sample data
- [ ] `npm run dev` starts server on port 3000
- [ ] `curl http://localhost:3000/health` returns `{"status":"ok"}`
- [ ] Admin registration works
- [ ] Admin login returns JWT token
- [ ] Protected routes reject requests without token
- [ ] Protected routes accept valid JWT token
- [ ] Entry/exit recording works
- [ ] Tests pass with `npm test`

## 📞 Troubleshooting

### Database Connection Failed
```
Error: P1001: Can't reach database server
```
**Solution**: Verify PostgreSQL is running on port 5000:
```bash
# Windows
Get-Service -Name postgresql*
# Check port
netstat -ano | findstr :5000
```

### Prisma Generate Failed
```
Error: @prisma/client did not initialize yet
```
**Solution**: Run prisma generate manually:
```bash
npx prisma generate
```

### Port Already in Use
```
Error: listen EADDRINUSE: address already in use :::3000
```
**Solution**: Change PORT in `.env` or kill process on port 3000:
```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

### JWT Token Invalid
```
Error: jwt malformed
```
**Solution**: Ensure JWT_SECRET in `.env` matches server and token not expired.

## 📚 Additional Resources

- [Prisma Documentation](https://www.prisma.io/docs)
- [Express.js Guide](https://expressjs.com/en/guide/routing.html)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)

## 📄 License

MIT License - see LICENSE file

## 👥 Support

For issues or questions, contact the development team or open an issue on the repository.

---

**Built with ❤️ for IntelliSight Project**
