@echo off
REM IntelliSight - Quick Start Script for Camera Testing and Face Recognition
REM This script helps you quickly test RTSP cameras and start the system

echo ============================================================
echo  IntelliSight - RTSP Camera Testing and Recognition
echo ============================================================
echo.

REM Check if virtual environment exists
if not exist "Facerecongination\venv\" (
    echo [!] Virtual environment not found. Creating...
    cd Facerecongination
    python -m venv venv
    call venv\Scripts\activate
    echo [*] Installing dependencies...
    pip install -r requirements.txt
    cd ..
    echo [+] Setup complete!
    echo.
)

:menu
echo.
echo What would you like to do?
echo.
echo  1. Test RTSP Camera Connection
echo  2. Train Face Recognition (Enroll faces)
echo  3. Start Camera Streaming Service
echo  4. Test Webcam Recognition
echo  5. Run Full System (Zone-based)
echo  6. Check System Health
echo  7. Exit
echo.
set /p choice="Enter your choice (1-7): "

if "%choice%"=="1" goto test_camera
if "%choice%"=="2" goto train
if "%choice%"=="3" goto start_streaming
if "%choice%"=="4" goto test_webcam
if "%choice%"=="5" goto run_system
if "%choice%"=="6" goto health_check
if "%choice%"=="7" goto end

goto menu

:test_camera
echo.
echo ============================================================
echo  Testing RTSP Camera Connection
echo ============================================================
set /p rtsp_url="Enter RTSP URL (e.g., rtsp://admin:password@192.168.1.100/stream): "
cd Facerecongination
call venv\Scripts\activate
python test_rtsp_camera.py --url "%rtsp_url%" --duration 10
cd ..
pause
goto menu

:train
echo.
echo ============================================================
echo  Training Face Recognition System
echo ============================================================
echo [*] This will generate face embeddings from database images...
cd Facerecongination
call venv\Scripts\activate
python enrollment.py --train
cd ..
pause
goto menu

:start_streaming
echo.
echo ============================================================
echo  Starting Camera Streaming Service (Port 5001)
echo ============================================================
echo [*] This service will:
echo     - Connect to RTSP cameras from database
echo     - Perform face recognition
echo     - Stream video to frontend
echo     - Log entries/exits to database
echo.
echo [!] Press Ctrl+C to stop the service
echo.
cd Facerecongination
call venv\Scripts\activate
python camera_streaming_service.py
cd ..
goto menu

:test_webcam
echo.
echo ============================================================
echo  Testing Face Recognition on Webcam
echo ============================================================
echo [*] Press 'q' to quit
cd Facerecongination
call venv\Scripts\activate
python recognize.py
cd ..
pause
goto menu

:run_system
echo.
echo ============================================================
echo  Running Full System with Zone Cameras
echo ============================================================
set /p zone_id="Enter Zone ID (e.g., 1): "
cd Facerecongination
call venv\Scripts\activate
python recognition_live.py --zone %zone_id%
cd ..
pause
goto menu

:health_check
echo.
echo ============================================================
echo  System Health Check
echo ============================================================
echo.
echo [*] Checking Backend API (Port 3000)...
curl -s http://localhost:3000/api/health
echo.
echo.
echo [*] Checking Camera Streaming Service (Port 5001)...
curl -s http://localhost:5001/health
echo.
echo.
echo [*] Checking Frontend (Port 3001)...
curl -s http://localhost:3001
echo.
echo.
echo [+] Health check complete!
pause
goto menu

:end
echo.
echo Thank you for using IntelliSight!
echo.
exit
