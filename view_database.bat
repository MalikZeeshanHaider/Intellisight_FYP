@echo off
REM IntelliSight Database Query Script for Windows
REM Double-click to run and view all database records

echo ====================================================
echo    IntelliSight Database Viewer (Windows)
echo ====================================================
echo.

REM Set PostgreSQL path (adjust if needed)
set PGPASSWORD=ozair
set PGHOST=localhost
set PGPORT=5000
set PGUSER=postgres
set PGDATABASE=FYP_Intellisight

echo Connecting to: %PGHOST%:%PGPORT%/%PGDATABASE%
echo.

REM Check if psql is available
where psql >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: psql not found!
    echo Please add PostgreSQL bin folder to PATH
    echo Example: C:\Program Files\PostgreSQL\16\bin
    echo.
    pause
    exit /b 1
)

echo ====================================================
echo TEST 1: Connection Test
echo ====================================================
psql -c "SELECT version();"
echo.

echo ====================================================
echo TEST 2: List All Tables
echo ====================================================
psql -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name;"
echo.

echo ====================================================
echo TEST 3: Admin Users
echo ====================================================
psql -c "SELECT \"Admin_ID\", \"Name\", \"Email\", \"Role\" FROM \"Admin\" ORDER BY \"Admin_ID\";"
echo.

echo ====================================================
echo TEST 4: Teachers
echo ====================================================
psql -c "SELECT \"Teacher_ID\", \"Name\", \"Email\", \"Zone_id\" FROM \"Teacher\" ORDER BY \"Teacher_ID\";"
echo.

echo ====================================================
echo TEST 5: Students (First 10)
echo ====================================================
psql -c "SELECT \"Student_ID\", \"Name\", \"Email\", \"Zone_id\" FROM \"Students\" ORDER BY \"Student_ID\" LIMIT 10;"
echo.

echo ====================================================
echo TEST 6: Zones
echo ====================================================
psql -c "SELECT \"Zone_id\", \"Zone_Name\" FROM \"Zone\" ORDER BY \"Zone_id\";"
echo.

echo ====================================================
echo TEST 7: Cameras
echo ====================================================
psql -c "SELECT \"Camara_Id\", \"Zone_id\", \"CameraURL\" FROM \"Camara\" ORDER BY \"Camara_Id\";"
echo.

echo ====================================================
echo TEST 8: Record Counts
echo ====================================================
psql -c "SELECT 'Admin' as table_name, COUNT(*) as count FROM \"Admin\" UNION ALL SELECT 'Teacher', COUNT(*) FROM \"Teacher\" UNION ALL SELECT 'Students', COUNT(*) FROM \"Students\" UNION ALL SELECT 'Zone', COUNT(*) FROM \"Zone\" UNION ALL SELECT 'Camara', COUNT(*) FROM \"Camara\" UNION ALL SELECT 'AttendanceLog', COUNT(*) FROM \"AttendanceLog\" UNION ALL SELECT 'ActivePresence', COUNT(*) FROM \"ActivePresence\";"
echo.

echo ====================================================
echo TEST 9: Recent Attendance Logs (Last 10)
echo ====================================================
psql -c "SELECT \"AttendanceLog_ID\", \"person_type\", \"person_id\", \"Zone_id\", \"entry_time\" FROM \"AttendanceLog\" ORDER BY \"entry_time\" DESC LIMIT 10;"
echo.

echo ====================================================
echo TEST 10: Current Active Presence
echo ====================================================
psql -c "SELECT \"person_type\", \"person_id\", \"Zone_id\", \"entry_time\" FROM \"ActivePresence\" ORDER BY \"entry_time\" DESC;"
echo.

echo ====================================================
echo                  COMPLETE!
echo ====================================================
echo.
echo Database: %PGDATABASE%
echo Host: %PGHOST%:%PGPORT%
echo User: %PGUSER%
echo.
echo To open psql interactive shell, run:
echo   psql -h %PGHOST% -p %PGPORT% -U %PGUSER% -d %PGDATABASE%
echo.
pause
