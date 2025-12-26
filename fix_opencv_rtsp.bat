@echo off
echo ============================================================
echo OpenCV RTSP Fix Script
echo ============================================================
echo.

echo Step 1: Checking current OpenCV installation...
python -c "import cv2; print('Current OpenCV:', cv2.__version__)"
echo.

echo Step 2: Uninstalling existing OpenCV packages...
pip uninstall -y opencv-python opencv-python-headless opencv-contrib-python opencv-contrib-python-headless
echo.

echo Step 3: Installing OpenCV with FFMPEG support...
pip install opencv-contrib-python
echo.

echo Step 4: Verifying installation...
python -c "import cv2; print('New OpenCV:', cv2.__version__); print('Checking FFMPEG...'); build = cv2.getBuildInformation(); print('FFMPEG: YES' if 'FFMPEG' in build else 'FFMPEG: NO - Still Missing!')"
echo.

echo ============================================================
echo Fix Complete!
echo ============================================================
echo.
echo Now test your RTSP camera:
echo   cd Facerecongination
echo   python fix_camera_connection.py "your_rtsp_url"
echo.
pause
