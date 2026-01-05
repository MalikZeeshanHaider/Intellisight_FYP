#!/bin/bash

# Quick Database Test Script for IntelliSight
# Tests connection and shows all data from Windows PostgreSQL

echo "=================================================="
echo "   IntelliSight Database Connection Test"
echo "=================================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

cd /mnt/e/FYP/Intellisight_FYP/new/Intellisight_FYP

# Test 1: Backend Health Check
echo -e "${BLUE}TEST 1: Backend Health & Database Status${NC}"
echo "---------------------------------------------------"
curl -s http://localhost:3000/api/health 2>/dev/null | python3 -m json.tool 2>/dev/null || echo -e "${RED}❌ Backend not responding${NC}"
echo ""

# Test 2: List all tables
echo -e "${BLUE}TEST 2: Database Tables${NC}"
echo "---------------------------------------------------"
npx prisma db execute --stdin 2>/dev/null <<< "
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_type = 'BASE TABLE'
ORDER BY table_name;
" || echo -e "${RED}❌ Cannot query database${NC}"
echo ""

# Test 3: Count all records
echo -e "${BLUE}TEST 3: Record Counts${NC}"
echo "---------------------------------------------------"
npx prisma db execute --stdin 2>/dev/null <<< "
SELECT 
  'Admin' as table_name,
  (SELECT COUNT(*) FROM \"Admin\") as count
UNION ALL
SELECT 
  'Teacher' as table_name,
  (SELECT COUNT(*) FROM \"Teacher\") as count
UNION ALL
SELECT 
  'Students' as table_name,
  (SELECT COUNT(*) FROM \"Students\") as count
UNION ALL
SELECT 
  'Zone' as table_name,
  (SELECT COUNT(*) FROM \"Zone\") as count
UNION ALL
SELECT 
  'Camara' as table_name,
  (SELECT COUNT(*) FROM \"Camara\") as count
UNION ALL
SELECT 
  'AttendanceLog' as table_name,
  (SELECT COUNT(*) FROM \"AttendanceLog\") as count
UNION ALL
SELECT 
  'ActivePresence' as table_name,
  (SELECT COUNT(*) FROM \"ActivePresence\") as count
UNION ALL
SELECT 
  'ProcessedFaceImages' as table_name,
  (SELECT COUNT(*) FROM \"ProcessedFaceImages\") as count;
" || echo -e "${RED}❌ Cannot count records${NC}"
echo ""

# Test 4: Show Admin users
echo -e "${BLUE}TEST 4: Admin Users${NC}"
echo "---------------------------------------------------"
npx prisma db execute --stdin 2>/dev/null <<< '
SELECT 
  "Admin_ID", 
  "Name", 
  "Email", 
  "Role" 
FROM "Admin"
ORDER BY "Admin_ID";
' || echo -e "${RED}❌ Cannot query Admin table${NC}"
echo ""

# Test 5: Show Teachers
echo -e "${BLUE}TEST 5: Teachers${NC}"
echo "---------------------------------------------------"
npx prisma db execute --stdin 2>/dev/null <<< '
SELECT 
  "Teacher_ID", 
  "Name", 
  "Email",
  "Zone_id"
FROM "Teacher"
ORDER BY "Teacher_ID";
' || echo -e "${RED}❌ Cannot query Teacher table${NC}"
echo ""

# Test 6: Show Students
echo -e "${BLUE}TEST 6: Students (First 5)${NC}"
echo "---------------------------------------------------"
npx prisma db execute --stdin 2>/dev/null <<< '
SELECT 
  "Student_ID", 
  "Name", 
  "Email",
  "Zone_id"
FROM "Students"
ORDER BY "Student_ID"
LIMIT 5;
' || echo -e "${RED}❌ Cannot query Students table${NC}"
echo ""

# Test 7: Show Zones
echo -e "${BLUE}TEST 7: Zones${NC}"
echo "---------------------------------------------------"
npx prisma db execute --stdin 2>/dev/null <<< '
SELECT 
  "Zone_id", 
  "Zone_Name"
FROM "Zone"
ORDER BY "Zone_id";
' || echo -e "${RED}❌ Cannot query Zone table${NC}"
echo ""

# Test 8: Recent Attendance Logs
echo -e "${BLUE}TEST 8: Recent Attendance Logs (Last 5)${NC}"
echo "---------------------------------------------------"
npx prisma db execute --stdin 2>/dev/null <<< '
SELECT 
  "AttendanceLog_ID",
  "person_type",
  "person_id",
  "Zone_id",
  "entry_time"
FROM "AttendanceLog"
ORDER BY "entry_time" DESC
LIMIT 5;
' || echo -e "${RED}❌ Cannot query AttendanceLog table${NC}"
echo ""

# Test 9: Current Active Presence
echo -e "${BLUE}TEST 9: Current Active Presence${NC}"
echo "---------------------------------------------------"
npx prisma db execute --stdin 2>/dev/null <<< '
SELECT 
  "person_type",
  "person_id",
  "Zone_id",
  "entry_time"
FROM "ActivePresence"
ORDER BY "entry_time" DESC;
' || echo -e "${RED}❌ Cannot query ActivePresence table${NC}"
echo ""

# Test 10: API Endpoints
echo -e "${BLUE}TEST 10: Backend API Endpoints${NC}"
echo "---------------------------------------------------"

echo "GET /api/students:"
curl -s http://localhost:3000/api/students 2>/dev/null | python3 -c "import sys, json; data=json.load(sys.stdin); print(f'✅ Success: {len(data.get(\"data\", []))} students') if data.get('success') else print('❌ Failed')" 2>/dev/null || echo -e "${RED}❌ API not responding${NC}"

echo "GET /api/teachers:"
curl -s http://localhost:3000/api/teachers 2>/dev/null | python3 -c "import sys, json; data=json.load(sys.stdin); print(f'✅ Success: {len(data.get(\"data\", []))} teachers') if data.get('success') else print('❌ Failed')" 2>/dev/null || echo -e "${RED}❌ API not responding${NC}"

echo "GET /api/zones:"
curl -s http://localhost:3000/api/zones 2>/dev/null | python3 -c "import sys, json; data=json.load(sys.stdin); print(f'✅ Success: {len(data.get(\"data\", []))} zones') if data.get('success') else print('❌ Failed')" 2>/dev/null || echo -e "${RED}❌ API not responding${NC}"

echo ""

# Summary
echo "=================================================="
echo "                    SUMMARY"
echo "=================================================="
echo ""
echo -e "Database Connection: ${GREEN}127.0.0.1:5000${NC}"
echo -e "Database Name: ${GREEN}FYP_Intellisight${NC}"
echo -e "Username: ${GREEN}postgres${NC}"
echo ""
echo "To connect from Windows Command Prompt:"
echo "  psql -h localhost -p 5000 -U postgres -d FYP_Intellisight"
echo ""
echo "To view in pgAdmin:"
echo "  Host: localhost"
echo "  Port: 5000"
echo "  Database: FYP_Intellisight"
echo ""
echo "To access via Frontend:"
echo "  http://localhost:3001"
echo ""
echo "=================================================="
