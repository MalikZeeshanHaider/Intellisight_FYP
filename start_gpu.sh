#!/bin/bash

# =============================================================================
# IntelliSight - GPU-Enabled Startup Script
# Starts all services: PostgreSQL, Backend, Frontend, GPU Face Service
# =============================================================================

set -e

echo ""
echo "  ================================================================"
echo "  |                                                              |"
echo "  |              INTELLISIGHT - GPU FACE RECOGNITION             |"
echo "  |                  ATTENDANCE SYSTEM                           |"
echo "  |                                                              |"
echo "  ================================================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

PROJECT_DIR="/mnt/e/FYP/Intellisight_FYP/new/Intellisight_FYP"
PYTHON_VENV="$PROJECT_DIR/Facerecongination/.venv"

log_info() { echo -e "${BLUE}[*]${NC} $1"; }
log_success() { echo -e "${GREEN}[✓]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[!]${NC} $1"; }
log_error() { echo -e "${RED}[✗]${NC} $1"; }

# Function to check if a service is running on a port
check_port() {
    if lsof -Pi :$1 -sTCP:LISTEN -t >/dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# Function to kill process on port
kill_port() {
    if check_port $1; then
        log_warn "Killing existing process on port $1"
        fuser -k $1/tcp 2>/dev/null || true
        sleep 1
    fi
}

# Cleanup function
cleanup() {
    echo ""
    log_info "Stopping all services..."
    
    # Kill processes
    pkill -f "nodemon src/server.js" 2>/dev/null || true
    pkill -f "vite" 2>/dev/null || true
    pkill -f "gpu_face_service.py" 2>/dev/null || true
    
    log_success "All services stopped"
    exit 0
}

# Set trap for cleanup
trap cleanup SIGINT SIGTERM

# =============================================================================
# CHECK PREREQUISITES
# =============================================================================

log_info "Checking prerequisites..."

# Check Node.js
if ! command -v node &> /dev/null; then
    log_error "Node.js not found. Please install Node.js v18+"
    exit 1
fi
log_success "Node.js $(node -v) found"

# Check Python
if ! command -v python3 &> /dev/null; then
    log_error "Python3 not found. Please install Python 3.10+"
    exit 1
fi
log_success "Python $(python3 --version | cut -d' ' -f2) found"

# Check GPU
log_info "Checking GPU availability..."
if [ -f "$PYTHON_VENV/bin/activate" ]; then
    source "$PYTHON_VENV/bin/activate"
    GPU_COUNT=$(python3 -c "import tensorflow as tf; print(len(tf.config.list_physical_devices('GPU')))" 2>/dev/null || echo "0")
    if [ "$GPU_COUNT" -gt 0 ]; then
        log_success "GPU detected ($GPU_COUNT device(s))"
    else
        log_warn "No GPU detected - running on CPU"
    fi
    deactivate
fi

# =============================================================================
# START POSTGRESQL
# =============================================================================

log_info "Checking PostgreSQL..."

if check_port 5000; then
    log_success "PostgreSQL already running on port 5000"
else
    log_info "Starting PostgreSQL..."
    sudo pg_ctlcluster 16 main start 2>/dev/null || sudo service postgresql start || true
    sleep 2
    
    if check_port 5000; then
        log_success "PostgreSQL started on port 5000"
    else
        log_warn "PostgreSQL may not be running on port 5000"
    fi
fi

# =============================================================================
# START BACKEND
# =============================================================================

log_info "Starting Backend Server (Port 3000)..."

cd "$PROJECT_DIR"

# Kill existing backend
kill_port 3000

# Start backend in background
npm run dev > /tmp/intellisight-backend.log 2>&1 &
BACKEND_PID=$!

sleep 3

if ps -p $BACKEND_PID > /dev/null; then
    log_success "Backend started (PID: $BACKEND_PID)"
else
    log_error "Backend failed to start. Check /tmp/intellisight-backend.log"
fi

# =============================================================================
# START FRONTEND
# =============================================================================

log_info "Starting Frontend Server (Port 3001)..."

cd "$PROJECT_DIR/admin-dashboard"

# Kill existing frontend
kill_port 3001

# Start frontend in background
npm run dev > /tmp/intellisight-frontend.log 2>&1 &
FRONTEND_PID=$!

sleep 3

if ps -p $FRONTEND_PID > /dev/null; then
    log_success "Frontend started (PID: $FRONTEND_PID)"
else
    log_error "Frontend failed to start. Check /tmp/intellisight-frontend.log"
fi

# =============================================================================
# START GPU FACE RECOGNITION SERVICE
# =============================================================================

log_info "Starting GPU Face Recognition Service (Port 5001)..."

cd "$PROJECT_DIR/Facerecongination"

# Kill existing service
kill_port 5001

# Activate virtual environment and start service
if [ -f "$PYTHON_VENV/bin/activate" ]; then
    source "$PYTHON_VENV/bin/activate"
    
    # Install missing packages if needed
    pip install flask flask-cors psycopg2-binary pillow --quiet 2>/dev/null || true
    
    python3 gpu_face_service.py > /tmp/intellisight-gpu.log 2>&1 &
    GPU_PID=$!
    
    sleep 5
    
    if ps -p $GPU_PID > /dev/null; then
        log_success "GPU Face Service started (PID: $GPU_PID)"
    else
        log_error "GPU Face Service failed. Check /tmp/intellisight-gpu.log"
    fi
else
    log_error "Python virtual environment not found at $PYTHON_VENV"
fi

# =============================================================================
# VERIFY SERVICES
# =============================================================================

echo ""
echo "  ================================================================"
echo "  |                  SERVICE STATUS                              |"
echo "  ================================================================"
echo ""

sleep 2

# Check Backend
if curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
    log_success "Backend API: http://localhost:3000 ✓"
else
    log_warn "Backend API: http://localhost:3000 (starting...)"
fi

# Check Frontend
if curl -s http://localhost:3001 > /dev/null 2>&1; then
    log_success "Frontend App: http://localhost:3001 ✓"
else
    log_warn "Frontend App: http://localhost:3001 (starting...)"
fi

# Check GPU Service
GPU_HEALTH=$(curl -s http://localhost:5001/health 2>/dev/null || echo "{}")
if echo "$GPU_HEALTH" | grep -q "healthy"; then
    GPU_STATUS=$(echo "$GPU_HEALTH" | grep -o '"gpu":[^,}]*' | cut -d':' -f2)
    log_success "GPU Service: http://localhost:5001 ✓ (GPU: $GPU_STATUS)"
else
    log_warn "GPU Service: http://localhost:5001 (starting...)"
fi

echo ""
echo "  ================================================================"
echo "  |                  SYSTEM IS RUNNING                           |"
echo "  ================================================================"
echo ""
echo "  🌐 Frontend Dashboard: http://localhost:3001"
echo "  🔌 Backend API:        http://localhost:3000"
echo "  🎥 GPU Face Service:   http://localhost:5001"
echo ""
echo "  📝 Logs:"
echo "     Backend:  tail -f /tmp/intellisight-backend.log"
echo "     Frontend: tail -f /tmp/intellisight-frontend.log"
echo "     GPU:      tail -f /tmp/intellisight-gpu.log"
echo ""
echo "  🔑 Default Login:"
echo "     Email: john.admin@intellisight.com"
echo "     Password: admin123"
echo ""
echo "  ================================================================"
echo "  Press Ctrl+C to stop all services"
echo "  ================================================================"
echo ""

# Keep script running
while true; do
    sleep 10
    
    # Health check
    if ! ps -p $BACKEND_PID > /dev/null 2>&1; then
        log_warn "Backend stopped. Restarting..."
        cd "$PROJECT_DIR"
        npm run dev > /tmp/intellisight-backend.log 2>&1 &
        BACKEND_PID=$!
    fi
done
