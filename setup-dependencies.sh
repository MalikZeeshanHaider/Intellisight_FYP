#!/bin/bash
# ============================================================
#  IntelliSight - System Setup Script for Ubuntu/Linux
#  Installs all required dependencies
# ============================================================

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo ""
echo "  ================================================================"
echo "  |         INTELLISIGHT - DEPENDENCY SETUP SCRIPT               |"
echo "  ================================================================"
echo ""

# Check if running with sudo for system packages
if [ "$EUID" -eq 0 ]; then 
    echo -e "${YELLOW}[WARNING]${NC} Running as root. This is okay for system package installation."
fi

echo -e "${BLUE}[*]${NC} Updating package lists..."
sudo apt-get update

# ============================================================
#  Install Node.js (LTS version via NodeSource)
# ============================================================
echo ""
echo -e "${BLUE}[*]${NC} Installing Node.js..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    echo -e "${GREEN}[OK]${NC} Node.js $NODE_VERSION already installed"
else
    echo -e "${BLUE}[*]${NC} Installing Node.js 20.x LTS..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
    
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node -v)
        echo -e "${GREEN}[OK]${NC} Node.js $NODE_VERSION installed successfully"
    else
        echo -e "${RED}[ERROR]${NC} Failed to install Node.js"
        exit 1
    fi
fi

# ============================================================
#  Install PostgreSQL
# ============================================================
echo ""
echo -e "${BLUE}[*]${NC} Installing PostgreSQL..."
if command -v psql &> /dev/null; then
    PG_VERSION=$(psql --version | awk '{print $3}')
    echo -e "${GREEN}[OK]${NC} PostgreSQL $PG_VERSION already installed"
else
    echo -e "${BLUE}[*]${NC} Installing PostgreSQL 16..."
    sudo apt-get install -y postgresql postgresql-contrib
    
    if command -v psql &> /dev/null; then
        echo -e "${GREEN}[OK]${NC} PostgreSQL installed successfully"
        
        # Start PostgreSQL service
        sudo systemctl start postgresql
        sudo systemctl enable postgresql
        
        echo -e "${BLUE}[*]${NC} PostgreSQL service started"
    else
        echo -e "${RED}[ERROR]${NC} Failed to install PostgreSQL"
        exit 1
    fi
fi

# ============================================================
#  Install Python development tools
# ============================================================
echo ""
echo -e "${BLUE}[*]${NC} Installing Python development tools..."
sudo apt-get install -y python3-pip python3-venv python3-dev

# ============================================================
#  Install system libraries for OpenCV and face recognition
# ============================================================
echo ""
echo -e "${BLUE}[*]${NC} Installing system libraries for face recognition..."
sudo apt-get install -y \
    build-essential \
    cmake \
    libopencv-dev \
    libopenblas-dev \
    liblapack-dev \
    libx11-dev \
    libgtk-3-dev \
    libboost-python-dev \
    libavcodec-dev \
    libavformat-dev \
    libswscale-dev \
    libv4l-dev \
    libxvidcore-dev \
    libx264-dev

echo -e "${GREEN}[OK]${NC} System libraries installed"

# ============================================================
#  Setup PostgreSQL Database
# ============================================================
echo ""
echo -e "${BLUE}[*]${NC} Setting up PostgreSQL database..."
echo -e "${YELLOW}[!]${NC} You need to create the database manually."
echo ""
echo "Run these commands as postgres user:"
echo -e "${BLUE}sudo -u postgres psql${NC}"
echo "Then execute:"
echo -e "${BLUE}CREATE DATABASE \"FYP_Intellisight\";${NC}"
echo -e "${BLUE}CREATE USER postgres WITH PASSWORD 'ozair';${NC}"
echo -e "${BLUE}GRANT ALL PRIVILEGES ON DATABASE \"FYP_Intellisight\" TO postgres;${NC}"
echo -e "${BLUE}\\q${NC}"
echo ""

# ============================================================
#  Summary
# ============================================================
echo ""
echo "  ================================================================"
echo "  |                   SETUP COMPLETE                             |"
echo "  ================================================================"
echo ""
echo -e "${GREEN}✓${NC} Node.js: $(node -v 2>/dev/null || echo 'Not installed')"
echo -e "${GREEN}✓${NC} npm: $(npm -v 2>/dev/null || echo 'Not installed')"
echo -e "${GREEN}✓${NC} Python: $(python3 --version 2>/dev/null || echo 'Not installed')"
echo -e "${GREEN}✓${NC} PostgreSQL: $(psql --version 2>/dev/null | awk '{print $3}' || echo 'Not installed')"
echo ""
echo -e "${BLUE}[*]${NC} Next steps:"
echo "  1. Setup PostgreSQL database (see instructions above)"
echo "  2. Configure PostgreSQL to listen on port 5000 (default is 5432)"
echo "  3. Run: ./start.sh"
echo ""
