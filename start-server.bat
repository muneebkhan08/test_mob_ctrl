@echo off
echo ========================================
echo   SPIDER_CTRL Server - Starting...
echo ========================================
echo.

:: Build frontend if not already built
if not exist "%~dp0frontend\out\index.html" (
    echo [*] Frontend not built yet. Building...
    cd /d "%~dp0frontend"
    call npm run build
    echo [*] Frontend build complete.
    echo.
)

cd /d "%~dp0server"

if exist venv\Scripts\activate.bat (
    call venv\Scripts\activate.bat
) else (
    echo [!] Virtual environment not found.
    echo [!] Run: python -m venv venv
    echo [!] Then: venv\Scripts\activate ^& pip install -r requirements.txt
    pause
    exit /b
)

python server.py
pause
