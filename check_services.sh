#!/bin/bash

# IntelliSight Service Status Checker
# Quickly check if all services are running

echo "================================================"
echo "     IntelliSight Service Status Checker"
echo "================================================"
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check functions
check_port() {
    local port=$1
    local name=$2
    if netstat -tlnp 2>/dev/null | grep -q ":$port " || ss -tlnp 2>/dev/null | grep -q ":$port "; then
        echo -e "${GREEN}✅ $name (port $port) - RUNNING${NC}"
        return 0
    else
        echo -e "${RED}❌ $name (port $port) - NOT RUNNING${NC}"
        return 1
    fi
}

check_endpoint() {
    local url=$1
    local name=$2
    if curl -s -f "$url" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ $name - HEALTHY${NC}"
        return 0
    else
        echo -e "${RED}❌ $name - NOT RESPONDING${NC}"
        return 1
    fi
}

# Check all services
echo "1. PostgreSQL Database"
check_port 5000 "PostgreSQL"
echo ""

echo "2. Backend API Server"
check_port 3000 "Backend"
check_endpoint "http://localhost:3000/api/health" "Backend Health"
echo ""

echo "3. Frontend Dashboard"
check_port 3001 "Frontend"
check_endpoint "http://localhost:3001" "Frontend Access"
echo ""

echo "4. GPU Face Recognition Service"
check_port 5001 "GPU Service"
check_endpoint "http://localhost:5001/health" "GPU Service Health"
echo ""

echo "================================================"
echo "              Summary"
echo "================================================"
echo ""

# Overall status
all_good=true
netstat -tlnp 2>/dev/null | grep -q ":5000 " || all_good=false
netstat -tlnp 2>/dev/null | grep -q ":3000 " || all_good=false
netstat -tlnp 2>/dev/null | grep -q ":3001 " || all_good=false
netstat -tlnp 2>/dev/null | grep -q ":5001 " || all_good=false

if [ "$all_good" = true ]; then
    echo -e "${GREEN}✅ All services are running!${NC}"
    echo ""
    echo "Access the application:"
    echo "  🌐 Frontend: http://localhost:3001"
    echo "  🔧 Backend API: http://localhost:3000/api"
    echo "  🤖 GPU Service: http://localhost:5001"
else
    echo -e "${YELLOW}⚠️  Some services are not running${NC}"
    echo ""
    echo "Start missing services with:"
    echo "  ./start.sh"
fi

echo ""
echo "================================================"
