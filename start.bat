@echo off
setlocal enabledelayedexpansion

title IntelliSight Launcher
color 0A

echo.
echo  ================================================================
echo  ^|          INTELLISIGHT - FACE RECOGNITION SYSTEM             ^|
echo  ^|              Abdullah Uzair   Zeeshan Haider                ^|
echo  ^|                    Zainab Moazzam                           ^|
echo  ================================================================
echo.

REM ── Paths ─────────────────────────────────────────────────────────────
set "PROJECT_DIR=%~dp0"
set "PYTHON_EXE=C:\Users\abdul\miniconda3\envs\deepface_env\python.exe"
set "MEDIAMTX_DIR=%~dp0Facerecongination\mediamtx"
set "MEDIAMTX_EXE=%MEDIAMTX_DIR%\mediamtx.exe"
set "MEDIAMTX_CFG=%MEDIAMTX_DIR%\mediamtx.yml"

REM Suppress TF oneDNN spam — inherited by all child processes
set "TF_ENABLE_ONEDNN_OPTS=0"
set "TF_CPP_MIN_LOG_LEVEL=2"

echo [*] Project: %PROJECT_DIR%
echo.

REM ── STEP 1: Kill previous processes on our ports ───────────────────────
echo [*] Killing any processes on ports 3000 3001 5001 8889 9997 ...

powershell -NoProfile -Command ^
  "$ports = 3000,3001,5001,8889,9997; foreach ($p in $ports) { $c = Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue; if ($c) { Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue; Write-Host \"  Killed PID $($c.OwningProcess) on port $p\" } }"

timeout /t 2 /nobreak >nul
echo [OK] Port cleanup done
echo.

REM ── STEP 2: Pre-flight checks ──────────────────────────────────────────
if not exist "%PROJECT_DIR%.env" (
    echo [ERROR] .env file not found - copy .env.example to .env
    pause & exit /b 1
)
echo [OK] .env found

where node >nul 2>nul || (
    echo [ERROR] Node.js not found - install from https://nodejs.org
    pause & exit /b 1
)
for /f "tokens=*" %%v in ('node -v 2^>nul') do echo [OK] Node.js %%v

if not exist "%PYTHON_EXE%" (
    echo [WARN] Python env not found: %PYTHON_EXE%
    echo        Camera AI will not start.
    set "PYTHON_EXE="
) else (
    for /f "tokens=*" %%v in ('"%PYTHON_EXE%" --version 2^>^&1') do echo [OK] %%v
)
echo.

REM ── STEP 3: First-run dependency install ──────────────────────────────
if not exist "%PROJECT_DIR%node_modules\" (
    echo [*] Installing backend npm packages...
    cd /d "%PROJECT_DIR%"
    call npm install || ( echo [ERROR] npm install failed & pause & exit /b 1 )
)
if not exist "%PROJECT_DIR%node_modules\.prisma\" (
    echo [*] Generating Prisma client...
    cd /d "%PROJECT_DIR%"
    call npx prisma generate || ( echo [ERROR] Prisma generate failed & pause & exit /b 1 )
)
if not exist "%PROJECT_DIR%admin-dashboard\node_modules\" (
    echo [*] Installing frontend npm packages...
    cd /d "%PROJECT_DIR%admin-dashboard"
    call npm install || ( echo [ERROR] frontend npm install failed & cd /d "%PROJECT_DIR%" & pause & exit /b 1 )
    cd /d "%PROJECT_DIR%"
)
if not exist "%PROJECT_DIR%admin-dashboard\.env" (
    copy "%PROJECT_DIR%admin-dashboard\.env.example" "%PROJECT_DIR%admin-dashboard\.env" >nul
    echo [OK] Created admin-dashboard\.env
)
echo.

REM ── STEP 4: Start servers ─────────────────────────────────────────────
echo  ================================================================
echo  ^|                  STARTING SERVERS                           ^|
echo  ================================================================
echo.

REM 1. MediaMTX (start first — Python registers paths against it)
if exist "%MEDIAMTX_EXE%" (
    start "MediaMTX [8889]" /d "%MEDIAMTX_DIR%" cmd /k "%MEDIAMTX_EXE%" "%MEDIAMTX_CFG%"
    timeout /t 2 /nobreak >nul
    echo [OK] MediaMTX started   -  WebRTC: http://localhost:8889
) else (
    echo [WARN] mediamtx.exe not found - browser video preview disabled
    echo        Expected: %MEDIAMTX_EXE%
)

REM 2. Node.js Backend  (port 3000)
start "Backend [3000]" /d "%PROJECT_DIR%" cmd /k npm run dev
timeout /t 4 /nobreak >nul
echo [OK] Backend started   -  API:    http://localhost:3000

REM 3. React Frontend   (port 3001)
start "Frontend [3001]" /d "%PROJECT_DIR%admin-dashboard" cmd /k npm run dev
timeout /t 2 /nobreak >nul
echo [OK] Frontend started  -  App:    http://localhost:3001

REM 4. Python Camera AI (port 5001)
if not defined PYTHON_EXE (
    echo [WARN] Camera AI skipped - Python env missing
    goto :done
)
start "Camera AI [5001]" /d "%PROJECT_DIR%Facerecongination" cmd /k "%PYTHON_EXE%" camera_streaming_service.py
echo [OK] Camera AI started -  AI:     http://localhost:5001

:done
echo.
echo  ================================================================
echo  ^|              ALL SERVERS RUNNING                            ^|
echo  ================================================================
echo.
echo    Backend   API  -  http://localhost:3000
echo    Frontend  App  -  http://localhost:3001
echo    Camera    AI   -  http://localhost:5001
echo    MediaMTX       -  http://localhost:8889
echo.
echo  Close any server window to stop it.
echo  Run start.bat again to restart clean.
echo.
echo  Press any key to open the dashboard ...
pause >nul
start http://localhost:3001
