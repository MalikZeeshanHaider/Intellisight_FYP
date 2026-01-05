# 🚀 IntelliSight - Complete Setup Guide (Windows + WSL)

**Recommended Setup**: PostgreSQL on Windows + Node.js in WSL

This is the **easiest and best** approach for your environment.

---

## 📋 Overview

Your system setup will be:

```
┌─────────────────────────────────────────────────────────────┐
│                        WINDOWS                               │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  PostgreSQL 16 (Port 5000)                          │   │
│  │  - Database: FYP_Intellisight                       │   │
│  │  - User: postgres                                    │   │
│  │  - Password: ozair                                   │   │
│  │  - pgAdmin 4 (Visual Management)                    │   │
│  └──────────────────────────────────────────────────────┘   │
│                         ↕                                     │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  WSL Ubuntu 24.04                                   │   │
│  │  ┌────────────────────────────────────────────┐     │   │
│  │  │  Node.js Backend API (Port 3000)          │     │   │
│  │  │  React Frontend (Port 3001)               │     │   │
│  │  │  Python Face Recognition (Port 5001)      │     │   │
│  │  └────────────────────────────────────────────┘     │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## ⚡ Quick Start (3 Easy Steps)

### Step 1: Install PostgreSQL on Windows (5 minutes)

1. **Download**: https://www.postgresql.org/download/windows/
2. **Install** with these settings:
   - Port: **5000** (not 5432!)
   - Password: **ozair**
   - Install all components (including pgAdmin 4)
3. **Run setup script** (in Windows Command Prompt):
   ```cmd
   cd E:\FYP\Intellisight_FYP\new\Intellisight_FYP
   setup-postgres-windows.bat
   ```

✅ **Done!** PostgreSQL is now ready.

### Step 2: Install Node.js in WSL (2 minutes)

In WSL Ubuntu terminal:
```bash
cd /mnt/e/FYP/Intellisight_FYP/new/Intellisight_FYP

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify
node -v
npm -v
```

### Step 3: Install Project Dependencies (5 minutes)

```bash
# Still in WSL
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

# Setup Python environment
cd Facerecongination
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
deactivate
cd ..
```

---

## 🎯 Run the System

```bash
cd /mnt/e/FYP/Intellisight_FYP/new/Intellisight_FYP
./start.sh
```

Access:
- 🌐 **Frontend**: http://localhost:3001
- 🔌 **Backend API**: http://localhost:3000
- 📹 **Camera Service**: http://localhost:5001

---

## 📚 Detailed Guides

If you need more details, refer to:

1. **[POSTGRESQL_WINDOWS_SETUP.md](POSTGRESQL_WINDOWS_SETUP.md)** - Complete PostgreSQL on Windows guide
2. **[LINUX_QUICKSTART.md](LINUX_QUICKSTART.md)** - WSL setup guide
3. **[SYSTEM_ANALYSIS.md](SYSTEM_ANALYSIS.md)** - Complete code analysis

---

## ✅ Verification Checklist

### After PostgreSQL Installation (Windows)
- [ ] PostgreSQL service running (check `services.msc`)
- [ ] Port 5000 configured
- [ ] Database "FYP_Intellisight" created
- [ ] pgAdmin 4 can connect
- [ ] Password is "ozair"

### After Node.js Installation (WSL)
- [ ] `node -v` shows v20.x or higher
- [ ] `npm -v` shows v10.x or higher
- [ ] `node_modules/` folder exists after `npm install`

### After Database Setup
- [ ] `npx prisma migrate dev` succeeds
- [ ] Can connect from WSL: `psql -h localhost -p 5000 -U postgres -d FYP_Intellisight`

### After Full Setup
- [ ] Backend starts: `http://localhost:3000/health` returns OK
- [ ] Frontend loads: `http://localhost:3001` opens
- [ ] Camera service runs: `http://localhost:5001/health` returns OK

---

## 🐛 Common Issues & Solutions

### Issue: "Cannot connect to PostgreSQL from WSL"

**Solution 1**: Update pg_hba.conf (Windows)
```
File: C:\Program Files\PostgreSQL\16\data\pg_hba.conf

Add at top:
host    all             all             127.0.0.1/32            md5
host    all             all             172.16.0.0/12           md5

Then restart PostgreSQL service.
```

**Solution 2**: Check Windows Firewall
```cmd
netsh advfirewall firewall add rule name="PostgreSQL" dir=in action=allow protocol=TCP localport=5000
```

**Solution 3**: Use Windows IP instead of localhost
```bash
# In WSL, get Windows IP
cat /etc/resolv.conf | grep nameserver | awk '{print $2}'

# Update .env
DATABASE_URL="postgresql://postgres:ozair@<WINDOWS_IP>:5000/FYP_Intellisight?schema=public"
```

### Issue: "npm install fails"

**Solution**: Install build tools
```bash
sudo apt-get update
sudo apt-get install -y build-essential
npm install
```

### Issue: "Python packages fail to install"

**Solution**: Install system libraries
```bash
sudo apt-get install -y python3-dev build-essential cmake
cd Facerecongination
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

### Issue: "Port already in use"

**Solution**: Find and kill process
```bash
# Find process
sudo lsof -i :3000  # or :3001, :5001

# Kill process
kill -9 <PID>
```

---

## 💡 Why This Setup?

### ✅ Advantages

| Component | Location | Reason |
|-----------|----------|--------|
| PostgreSQL | Windows | Easy GUI (pgAdmin), better performance, persistent |
| Node.js | WSL | Native Linux environment, better compatibility |
| Python | WSL | OpenCV works better on Linux |
| Development | WSL | Same as production (Linux servers) |

### 🎯 Benefits
- ✅ **Easy Database Management**: pgAdmin 4 on Windows
- ✅ **Better Performance**: PostgreSQL runs natively on Windows
- ✅ **Persistent Data**: Survives WSL restarts
- ✅ **Visual Tools**: GUI for database management
- ✅ **Production-like**: WSL simulates Linux servers

---

## 🔧 Configuration Files

### .env (Already created ✅)
```env
DATABASE_URL="postgresql://postgres:ozair@localhost:5000/FYP_Intellisight?schema=public"
JWT_SECRET="f004c56bb2160c1ee10a9d6fe6e26a09709b60508de4864113fe5d48f439f8dc08ee4f2d22c2e368e811410feb5809aed53b5c1d8144efaf91deda02012ab1d5"
JWT_EXPIRES_IN="7d"
PORT=3000
NODE_ENV="development"
```

If localhost doesn't work, replace with Windows IP:
```env
DATABASE_URL="postgresql://postgres:ozair@172.x.x.x:5000/FYP_Intellisight?schema=public"
```

---

## 📊 System Components

### Backend API (Node.js)
- **Port**: 3000
- **Framework**: Express + Prisma
- **Features**: Authentication, CRUD APIs, Face image processing

### Frontend (React)
- **Port**: 3001  
- **Framework**: React + Vite + TailwindCSS
- **Features**: Admin dashboard, User management, Camera feeds

### Face Recognition (Python)
- **Port**: 5001
- **Framework**: Flask + DeepFace + OpenCV
- **Features**: Real-time face detection and recognition

### Database (PostgreSQL)
- **Port**: 5000
- **Location**: Windows
- **Management**: pgAdmin 4

---

## 🎓 Next Steps After Setup

1. **Open pgAdmin 4** (Windows) to explore the database
2. **Run seed script** to add sample data:
   ```bash
   npm run seed
   ```
3. **Login to frontend** at http://localhost:3001
   - Email: `admin@intellisight.com`
   - Password: `admin123`
4. **Add cameras** through the admin dashboard
5. **Enroll faces** for teachers/students
6. **Test face recognition** with webcam

---

## 📞 Get Help

### Check Logs
```bash
# Backend
tail -f /tmp/intellisight-backend.log

# Frontend
tail -f /tmp/intellisight-frontend.log

# Camera
tail -f /tmp/intellisight-camera.log
```

### Database Management
```bash
# Open Prisma Studio (Visual DB editor)
npx prisma studio
# Opens at http://localhost:5555
```

### Test Services
```bash
# Backend
curl http://localhost:3000/health

# Camera service
curl http://localhost:5001/health
```

---

## 🎉 You're All Set!

Once everything is running:
1. ✅ PostgreSQL on Windows (Port 5000)
2. ✅ Node.js backend in WSL (Port 3000)
3. ✅ React frontend in WSL (Port 3001)
4. ✅ Python face recognition in WSL (Port 5001)

**Open**: http://localhost:3001 and start using IntelliSight! 🚀

---

**Last Updated**: December 28, 2025  
**Platform**: Windows 11 + WSL Ubuntu 24.04
