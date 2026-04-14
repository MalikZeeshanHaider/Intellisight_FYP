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
echo  ^|                  ------------------                          ^|
echo  ^|                    Abdullah Uzair - 221083                   ^|
echo  ^|                    Zeeshan Haider - 221093                   ^|
echo  ^|                    Zainab Moazzam - 221095                   ^|
echo  ================================================================
echo.

REM Set project directory (always ends with \)
set "PROJECT_DIR=%~dp0"

REM Python conda env - intellisight_gpu (Python 3.10, deepface/flask/cv2)
set "PYTHON_EXE=C:\Users\abdul\miniconda3\envs\intellisight_gpu\python.exe"

echo [*] Project Directory: %PROJECT_DIR%
echo.

REM ============================================================
REM  Check .env file
REM ============================================================
if not exist "%PROJECT_DIR%.env" (
    echo [ERROR] .env file not found!
    echo         Copy .env.example to .env and fill in your values.
    echo.
    pause
    exit /b 1
)
echo [OK] .env file found

REM ============================================================
REM  Check Node.js
REM ============================================================
echo [*] Checking Node.js...
where node >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js not found. Install from https://nodejs.org
    pause
    exit /b 1
)
for /f "tokens=*" %%v in ('node -v 2^>nul') do echo [OK] Node.js %%v
echo.

REM ============================================================
REM  Check Python (intellisight_gpu conda environment)
REM ============================================================
echo [*] Checking Python environment (intellisight_gpu)...
if not exist "%PYTHON_EXE%" goto :python_missing
for /f "tokens=*" %%v in ('"%PYTHON_EXE%" --version 2^>^&1') do echo [OK] %%v ^(intellisight_gpu env^)
goto :python_ok

:python_missing
echo [WARNING] intellisight_gpu conda env not found at:
echo           %PYTHON_EXE%
echo           Camera streaming service will NOT start.
echo           Setup: conda create -n intellisight_gpu python=3.10
echo                  conda activate intellisight_gpu
echo                  pip install -r Facerecongination\requirements.txt
set "PYTHON_EXE="

:python_ok
echo.

REM ============================================================
REM  Install Backend Dependencies (if needed)
REM ============================================================
if not exist "%PROJECT_DIR%node_modules\" (
    echo [*] Installing backend dependencies...
    cd /d "%PROJECT_DIR%"
    call npm install
    if errorlevel 1 (
        echo [ERROR] Backend npm install failed!
        pause
        exit /b 1
    )
    echo [OK] Backend dependencies installed
    echo.
)

REM ============================================================
REM  Generate Prisma Client (if needed)
REM ============================================================
if not exist "%PROJECT_DIR%node_modules\.prisma\" (
    echo [*] Generating Prisma client...
    cd /d "%PROJECT_DIR%"
    call npx prisma generate
    if errorlevel 1 (
        echo [ERROR] Prisma generate failed!
        pause
        exit /b 1
    )
    echo [OK] Prisma client generated
    echo.
)

REM ============================================================
REM  Install Frontend Dependencies (if needed)
REM ============================================================
if not exist "%PROJECT_DIR%admin-dashboard\node_modules\" (
    echo [*] Installing frontend dependencies...
    cd /d "%PROJECT_DIR%admin-dashboard"
    call npm install
    if errorlevel 1 (
        echo [ERROR] Frontend npm install failed!
        cd /d "%PROJECT_DIR%"
        pause
        exit /b 1
    )
    cd /d "%PROJECT_DIR%"
    echo [OK] Frontend dependencies installed
    echo.
)

REM ============================================================
REM  Auto-create frontend .env if missing
REM ============================================================
if not exist "%PROJECT_DIR%admin-dashboard\.env" (
    echo [*] Creating admin-dashboard\.env from .env.example...
    copy "%PROJECT_DIR%admin-dashboard\.env.example" "%PROJECT_DIR%admin-dashboard\.env" >nul
    echo [OK] admin-dashboard\.env created
    echo.
)

REM ============================================================
REM  Start Services
REM ============================================================
echo.
echo  ================================================================
echo  ^|                  STARTING SERVICES                           ^|
echo  ================================================================
echo.
echo  Backend API:     http://localhost:3000
echo  Frontend App:    http://localhost:3001
echo  Camera Service:  http://localhost:5001
echo.
echo  [!] Each service opens in its own window.
echo.

REM --- Backend (Node.js / nodemon) ---
start "IntelliSight - Backend (Port 3000)" /d "%PROJECT_DIR%" cmd /k "npm run dev"
timeout /t 4 /nobreak >nul

REM --- Frontend (Vite / React) ---
start "IntelliSight - Frontend (Port 3001)" /d "%PROJECT_DIR%admin-dashboard" cmd /k "npm run dev"
timeout /t 2 /nobreak >nul

REM --- Camera Streaming Service (Flask / Python) ---
if not defined PYTHON_EXE goto :skip_camera
start "IntelliSight - Camera Service (Port 5001)" /d "%PROJECT_DIR%Facerecongination" cmd /k ""%PYTHON_EXE%" camera_streaming_service.py"
goto :camera_done

:skip_camera
echo [WARNING] Camera service skipped - intellisight_gpu env not found.

:camera_done

echo.
echo [OK] All services started!
echo.
echo  ================================================================
echo  ^|                  SYSTEM IS RUNNING                           ^|
echo  ================================================================
echo.
echo  Backend API:     http://localhost:3000
echo  Frontend App:    http://localhost:3001
echo  Camera Service:  http://localhost:5001
echo.
echo  Python env:  intellisight_gpu  (FaceNet + RetinaFace)
echo.
echo  Press any key to open the frontend in your browser...
pause >nul

start http://localhost:3001

echo.
echo  Close the individual service windows to stop each service.
echo.
pause
