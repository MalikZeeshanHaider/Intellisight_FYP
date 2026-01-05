# 🚀 IntelliSight - Quick Start Guide for Linux

This guide will help you set up and run the IntelliSight Face Recognition Attendance System on Ubuntu/Linux.

---

## ⚠️ Current Status

**Analysis Complete**: December 28, 2025

### Issues Found:
❌ **Node.js** - Not installed  
❌ **PostgreSQL** - Not installed  
✅ **Python** - Installed (v3.12.3)  
✅ **.env file** - Created  
✅ **Linux scripts** - Created  

---

## 📋 Prerequisites Installation

### Step 1: Install System Dependencies

Run the automated setup script:

```bash
cd /mnt/e/FYP/Intellisight_FYP/new/Intellisight_FYP
./setup-dependencies.sh
```

This will install:
- Node.js 20.x LTS
- PostgreSQL 16
- Python development tools
- OpenCV system libraries
- Build tools (CMake, GCC, etc.)

**Estimated time**: 10-15 minutes

---

## 🗄️ PostgreSQL Database Setup

### Step 2: Configure PostgreSQL

#### 2.1 Change PostgreSQL Port to 5000

```bash
# Edit PostgreSQL configuration
sudo nano /etc/postgresql/16/main/postgresql.conf
```

Find and change:
```
port = 5432    # Change this to 5000
```

Save and restart:
```bash
sudo systemctl restart postgresql
```

#### 2.2 Create Database and User

```bash
# Switch to postgres user
sudo -u postgres psql

# Run these SQL commands:
CREATE DATABASE "FYP_Intellisight";
ALTER USER postgres WITH PASSWORD 'ozair';
GRANT ALL PRIVILEGES ON DATABASE "FYP_Intellisight" TO postgres;
\q
```

#### 2.3 Configure PostgreSQL Authentication

```bash
# Edit pg_hba.conf
sudo nano /etc/postgresql/16/main/pg_hba.conf
```

Add this line before other rules:
```
local   all             postgres                                md5
host    all             postgres        127.0.0.1/32            md5
```

Restart PostgreSQL:
```bash
sudo systemctl restart postgresql
```

---

## 🔧 Application Setup

### Step 3: Install Project Dependencies

```bash
cd /mnt/e/FYP/Intellisight_FYP/new/Intellisight_FYP

# Install backend dependencies
npm install

# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate dev

# Install frontend dependencies
cd admin-dashboard
npm install
cd ..

# Setup Python virtual environment
cd Facerecongination
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
deactivate
cd ..
```

---

## ▶️ Running the System

### Step 4: Start All Services

```bash
cd /mnt/e/FYP/Intellisight_FYP/new/Intellisight_FYP
./start.sh
```

This will start:
- **Backend API** on http://localhost:3000
- **Frontend Dashboard** on http://localhost:3001
- **Camera Service** on http://localhost:5001

### Stop Services

Press `Ctrl+C` in the terminal where start.sh is running.

---

## 🔍 Verify Installation

### Check Services are Running

```bash
# Backend
curl http://localhost:3000/health

# Frontend (in browser)
# Open: http://localhost:3001

# Camera service
curl http://localhost:5001/health
```

---

## 📊 System Architecture

```
┌─────────────────────────────────────────────────────────┐
│         Python Face Recognition System                  │
│         (Port 5001)                                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │ OpenCV   │→ │ DeepFace │→ │  Person  │              │
│  │ Detector │  │ FaceNet  │  │ Tracker  │              │
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
                      ↓
┌─────────────────────────────────────────────────────────┐
│         React Frontend (Port 3001)                      │
│  - Admin Dashboard                                       │
│  - User Management                                       │
│  - Camera Management                                     │
│  - Attendance Reports                                    │
└─────────────────────────────────────────────────────────┘
```

---

## 🎯 First Time Setup Checklist

- [ ] Install Node.js (`./setup-dependencies.sh`)
- [ ] Install PostgreSQL (`./setup-dependencies.sh`)
- [ ] Configure PostgreSQL port to 5000
- [ ] Create database "FYP_Intellisight"
- [ ] Setup PostgreSQL authentication
- [ ] Copy `.env.example` to `.env` ✅ (Done)
- [ ] Install backend dependencies (`npm install`)
- [ ] Run Prisma migrations (`npx prisma migrate dev`)
- [ ] Install frontend dependencies (`cd admin-dashboard && npm install`)
- [ ] Setup Python venv (`cd Facerecongination && python3 -m venv .venv`)
- [ ] Install Python dependencies (`pip install -r requirements.txt`)
- [ ] Run the system (`./start.sh`)

---

## 📝 Configuration Files

### Environment Variables (.env)
Already created with default values:
- Database URL: postgresql://postgres:ozair@localhost:5000/FYP_Intellisight
- JWT Secret: Auto-generated
- Server Port: 3000

### Python Configuration (Facerecongination/config.py)
- Database connection settings
- Face recognition parameters
- Camera settings

---

## 🔒 Default Credentials

After running seed script:
```
Email: admin@intellisight.com
Password: admin123
```

**⚠️ Change these credentials immediately in production!**

---

## 🐛 Troubleshooting

### Issue: "Node.js not found"
```bash
./setup-dependencies.sh
```

### Issue: "Cannot connect to database"
1. Check PostgreSQL is running:
   ```bash
   sudo systemctl status postgresql
   ```
2. Verify port 5000 in postgresql.conf
3. Check authentication in pg_hba.conf

### Issue: "Python module not found"
```bash
cd Facerecongination
source .venv/bin/activate
pip install -r requirements.txt
```

### Issue: "Port already in use"
```bash
# Find process using port
sudo lsof -i :3000

# Kill process
kill -9 <PID>
```

---

## 📚 Documentation

For detailed information, see:
- [SYSTEM_ANALYSIS.md](SYSTEM_ANALYSIS.md) - Complete code analysis
- [README.md](README.md) - General overview
- [ARCHITECTURE_DIAGRAM.md](ARCHITECTURE_DIAGRAM.md) - System architecture
- [DEPLOYMENT.md](DEPLOYMENT.md) - Production deployment

---

## 🆘 Getting Help

1. Check logs in `/tmp/`:
   - `/tmp/intellisight-backend.log`
   - `/tmp/intellisight-frontend.log`
   - `/tmp/intellisight-camera.log`

2. Run health checks:
   ```bash
   curl http://localhost:3000/health
   curl http://localhost:5001/health
   ```

3. View Prisma Studio:
   ```bash
   npx prisma studio
   ```

---

## ✅ Success!

Once all services are running, access:
- 🌐 **Frontend**: http://localhost:3001
- 🔌 **Backend API**: http://localhost:3000
- 📹 **Camera Service**: http://localhost:5001
- 💾 **Prisma Studio**: http://localhost:5555 (run `npx prisma studio`)

---

**Last Updated**: December 28, 2025
