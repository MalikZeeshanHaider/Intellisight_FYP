#!/bin/bash
# ============================================================
#  IntelliSight - Complete System Startup Script (Linux)
#  Starts Backend (Node.js) + Frontend (React) + Python Services
# ============================================================

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo ""
echo "  ================================================================"
echo "  |                                                              |"
echo "  |              INTELLISIGHT - FACE RECOGNITION                 |"
echo "  |                  ATTENDANCE SYSTEM                           |"
echo "  |                                                              |"
echo "  ================================================================"
echo ""

# Set the project directory
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

# Set environment variables
export DATABASE_URL="postgresql://postgres:ozair@localhost:5000/FYP_Intellisight?schema=public"
export NODE_ENV="development"
export PORT=3000

echo -e "${BLUE}[*]${NC} Project Directory: $PROJECT_DIR"
echo -e "${BLUE}[*]${NC} Database URL configured"
echo ""

# ============================================================
#  Check Node.js
# ============================================================
echo -e "${BLUE}[*]${NC} Checking Node.js installation..."
if ! command -v node &> /dev/null; then
    echo -e "${RED}[ERROR]${NC} Node.js is not installed or not in PATH!"
    echo "        Please install Node.js from https://nodejs.org"
    exit 1
fi
NODE_VERSION=$(node -v)
echo -e "${GREEN}[OK]${NC} Node.js $NODE_VERSION found"
echo ""

# ============================================================
#  Check Python
# ============================================================
echo -e "${BLUE}[*]${NC} Checking Python installation..."
if ! command -v python3 &> /dev/null; then
    echo -e "${YELLOW}[WARNING]${NC} Python is not installed or not in PATH!"
    echo "          Face recognition features may not work."
else
    PYTHON_VERSION=$(python3 --version)
    echo -e "${GREEN}[OK]${NC} $PYTHON_VERSION found"
fi
echo ""

# ============================================================
#  Install Backend Dependencies (if needed)
# ============================================================
if [ ! -d "node_modules" ]; then
    echo -e "${BLUE}[*]${NC} Installing backend dependencies..."
    npm install
    if [ $? -ne 0 ]; then
        echo -e "${RED}[ERROR]${NC} Failed to install backend dependencies!"
        exit 1
    fi
    echo -e "${GREEN}[OK]${NC} Backend dependencies installed"
    echo ""
fi

# ============================================================
#  Generate Prisma Client (if needed)
# ============================================================
if [ ! -d "node_modules/.prisma" ]; then
    echo -e "${BLUE}[*]${NC} Generating Prisma client..."
    npx prisma generate
    echo -e "${GREEN}[OK]${NC} Prisma client generated"
    echo ""
fi

# ============================================================
#  Install Frontend Dependencies (if needed)
# ============================================================
if [ ! -d "admin-dashboard/node_modules" ]; then
    echo -e "${BLUE}[*]${NC} Installing frontend dependencies..."
    cd admin-dashboard
    npm install
    if [ $? -ne 0 ]; then
        echo -e "${RED}[ERROR]${NC} Failed to install frontend dependencies!"
        cd ..
        exit 1
    fi
    cd ..
    echo -e "${GREEN}[OK]${NC} Frontend dependencies installed"
    echo ""
fi

# ============================================================
#  Setup Python Virtual Environment (if needed)
# ============================================================
if [ ! -d "Facerecongination/.venv" ] && [ ! -d "Facerecongination/venv" ]; then
    echo -e "${BLUE}[*]${NC} Creating Python virtual environment..."
    cd Facerecongination
    python3 -m venv .venv
    if [ $? -eq 0 ]; then
        echo -e "${BLUE}[*]${NC} Upgrading pip..."
        source .venv/bin/activate
        python -m pip install --upgrade pip
        echo -e "${BLUE}[*]${NC} Installing Python dependencies..."
        pip install -r requirements.txt
        deactivate
        cd ..
        echo -e "${GREEN}[OK]${NC} Python environment setup complete"
    else
        echo -e "${YELLOW}[WARNING]${NC} Failed to create virtual environment"
        cd ..
    fi
    echo ""
fi

# ============================================================
#  Start Services
# ============================================================
echo ""
echo "  ================================================================"
echo "  |                  STARTING SERVICES                           |"
echo "  ================================================================"
echo ""

echo -e "${BLUE}[*]${NC} Starting Backend Server (Port 3000)..."
echo -e "${BLUE}[*]${NC} Starting Frontend Dev Server (Port 3001)..."
echo -e "${BLUE}[*]${NC} Starting Camera Streaming Service (Port 5001)..."
echo ""
echo "  ----------------------------------------------------------------"
echo "  | Backend API:    http://localhost:3000                       |"
echo "  | Frontend App:   http://localhost:3001                       |"
echo "  | Camera Service: http://localhost:5001                       |"
echo "  | Prisma Studio:  Run 'npx prisma studio' separately          |"
echo "  ----------------------------------------------------------------"
echo ""
echo -e "${YELLOW}[!]${NC} Press Ctrl+C to stop all services"
echo ""

# Function to cleanup on exit
cleanup() {
    echo ""
    echo -e "${YELLOW}[*]${NC} Stopping all services..."
    kill $(jobs -p) 2>/dev/null
    echo -e "${GREEN}[OK]${NC} All services stopped"
    exit 0
}

trap cleanup SIGINT SIGTERM

# Start backend in background
cd "$PROJECT_DIR"
npm run dev > /tmp/intellisight-backend.log 2>&1 &
BACKEND_PID=$!
echo -e "${GREEN}[OK]${NC} Backend started (PID: $BACKEND_PID)"

# Wait for backend to start
sleep 3

# Start frontend in background
cd "$PROJECT_DIR/admin-dashboard"
npm run dev > /tmp/intellisight-frontend.log 2>&1 &
FRONTEND_PID=$!
echo -e "${GREEN}[OK]${NC} Frontend started (PID: $FRONTEND_PID)"

# Wait for frontend to start
sleep 2

# Start Camera Streaming Service in background
cd "$PROJECT_DIR/Facerecongination"
if [ -d ".venv" ]; then
    source .venv/bin/activate
    python camera_streaming_service.py > /tmp/intellisight-camera.log 2>&1 &
    CAMERA_PID=$!
    echo -e "${GREEN}[OK]${NC} Camera service started (PID: $CAMERA_PID)"
elif [ -d "venv" ]; then
    source venv/bin/activate
    python camera_streaming_service.py > /tmp/intellisight-camera.log 2>&1 &
    CAMERA_PID=$!
    echo -e "${GREEN}[OK]${NC} Camera service started (PID: $CAMERA_PID)"
else
    python3 camera_streaming_service.py > /tmp/intellisight-camera.log 2>&1 &
    CAMERA_PID=$!
    echo -e "${GREEN}[OK]${NC} Camera service started (PID: $CAMERA_PID)"
fi

cd "$PROJECT_DIR"

echo ""
echo -e "${GREEN}[OK]${NC} All services started!"
echo ""
echo "  ================================================================"
echo "  |                  SYSTEM IS RUNNING                           |"
echo "  ================================================================"
echo ""
echo "  Backend API:      http://localhost:3000"
echo "  Frontend App:     http://localhost:3001"
echo "  Camera Service:   http://localhost:5001"
echo ""
echo "  Logs:"
echo "  - Backend:  tail -f /tmp/intellisight-backend.log"
echo "  - Frontend: tail -f /tmp/intellisight-frontend.log"
echo "  - Camera:   tail -f /tmp/intellisight-camera.log"
echo ""
echo -e "${YELLOW}[!]${NC} Press Ctrl+C to stop all services"
echo ""

# Wait for all background processes
wait
