@echo off
echo Starting IntelliSight Camera Service...
echo.
call conda activate intellisight_gpu
if errorlevel 1 (
    echo ERROR: Failed to activate conda environment
    pause
    exit /b 1
)

echo Environment activated: intellisight_gpu
echo Running camera_streaming_service.py...
echo.

python camera_streaming_service.py

pause
