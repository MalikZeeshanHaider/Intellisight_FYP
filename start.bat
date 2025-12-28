@echo off
REM ============================================================
REM  IntelliSight - Complete System Startup Script
REM  Starts Backend (Node.js) + Frontend (React) + Python Services
REM ============================================================

title IntelliSight - System Launcher
color 0A

echo.
echo  ================================================================
echo  ^|                                                              ^|
echo  ^|              INTELLISIGHT - FACE RECOGNITION                 ^|
echo  ^|                  ATTENDANCE SYSTEM                           ^|
echo  ^|                                                              ^|
echo  ================================================================
echo.

REM Set the project directory
set PROJECT_DIR=%~dp0
cd /d "%PROJECT_DIR%"

REM Set environment variables
set DATABASE_URL=postgresql://postgres:zainab@localhost:5000/FYP_Intellisight?schema=public
set NODE_ENV=development
set PORT=3000

echo [*] Project Directory: %PROJECT_DIR%
echo [*] Database URL configured
echo.

REM ============================================================
REM  Check Node.js
REM ============================================================
echo [*] Checking Node.js installation...
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js is not installed or not in PATH!
    echo         Please install Node.js from https://nodejs.org
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('node -v') do set NODE_VERSION=%%i
echo [OK] Node.js %NODE_VERSION% found
echo.

REM ============================================================
REM  Check Python
REM ============================================================
echo [*] Checking Python installation...
where python >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [WARNING] Python is not installed or not in PATH!
    echo           Face recognition features may not work.
) else (
    for /f "tokens=*" %%i in ('python --version 2^>^&1') do set PYTHON_VERSION=%%i
    echo [OK] %PYTHON_VERSION% found
)
echo.

REM ============================================================
REM  Install Backend Dependencies (if needed)
REM ============================================================
if not exist "node_modules\" (
    echo [*] Installing backend dependencies...
    call npm install
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] Failed to install backend dependencies!
        pause
        exit /b 1
    )
    echo [OK] Backend dependencies installed
    echo.
)

REM ============================================================
REM  Generate Prisma Client (if needed)
REM ============================================================
if not exist "node_modules\.prisma\" (
    echo [*] Generating Prisma client...
    call npx prisma generate
    echo [OK] Prisma client generated
    echo.
)

REM ============================================================
REM  Install Frontend Dependencies (if needed)
REM ============================================================
if not exist "admin-dashboard\node_modules\" (
    echo [*] Installing frontend dependencies...
    cd admin-dashboard
    call npm install
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] Failed to install frontend dependencies!
        cd ..
        pause
        exit /b 1
    )
    cd ..
    echo [OK] Frontend dependencies installed
    echo.
)

REM ============================================================
REM  Setup Python Virtual Environment (if needed)
REM ============================================================
if not exist "Facerecongination\.venv\" (
    if not exist "Facerecongination\venv\" (
        echo [*] Creating Python virtual environment...
        cd Facerecongination
        python -m venv .venv
        if %ERRORLEVEL% NEQ 0 (
            echo [WARNING] Failed to create virtual environment
            cd ..
        ) else (
            echo [*] Upgrading pip...
            call .venv\Scripts\activate
            python.exe -m pip install --upgrade pip
            echo [*] Installing Python dependencies...
            pip install -r requirements.txt
            deactivate
            cd ..
            echo [OK] Python environment setup complete
        )
        echo.
    )
)

REM ============================================================
REM  Start Services
REM ============================================================
echo.
echo  ================================================================
echo  ^|                  STARTING SERVICES                           ^|
echo  ================================================================
echo.

echo [*] Starting Backend Server (Port 3000)...
echo [*] Starting Frontend Dev Server (Port 3001)...
echo [*] Starting Camera Streaming Service (Port 5001)...
echo.
echo  ----------------------------------------------------------------
echo  ^| Backend API:    http://localhost:3000                       ^|
echo  ^| Frontend App:   http://localhost:3001                       ^|
echo  ^| Camera Service: http://localhost:5001                       ^|
echo  ^| Prisma Studio:  Run 'npx prisma studio' separately          ^|
echo  ----------------------------------------------------------------
echo.
echo [!] Press Ctrl+C in either window to stop the servers
echo [!] Close this window to stop all services
echo.

REM Start backend in a new window
start "IntelliSight - Backend (Port 3000)" cmd /k "cd /d "%PROJECT_DIR%" && set DATABASE_URL=%DATABASE_URL% && npm run dev"

REM Wait a moment for backend to start
timeout /t 3 /nobreak >nul

REM Start frontend in a new window
start "IntelliSight - Frontend (Port 3001)" cmd /k "cd /d "%PROJECT_DIR%\admin-dashboard" && npm run dev"

REM Wait a moment for frontend to start
timeout /t 2 /nobreak >nul

REM Start Camera Streaming Service in a new window
start "IntelliSight - Camera Service (Port 5001)" cmd /k "cd /d "%PROJECT_DIR%\Facerecongination" && python camera_streaming_service.py"

echo.
echo [OK] All services started!
echo.
echo  ================================================================
echo  ^|                  SYSTEM IS RUNNING                           ^|
echo  ================================================================
echo.
echo  Backend API:      http://localhost:3000
echo  Frontend App:     http://localhost:3001
echo  Camera Service:   http://localhost:5001
echo.
echo  Camera streaming service runs on port 5001 for live video feeds.
echo.
echo  Press any key to open the frontend in your browser...
pause >nul

REM Open browser
start http://localhost:3001

echo.
echo  ----------------------------------------------------------------
echo  This window can be closed. The services will continue running
echo  in their own windows.
echo  ----------------------------------------------------------------
echo.
pause
