@echo off
setlocal
cd /d "%~dp0"
where py >nul 2>nul && (py -3 -m http.server 8765 & start "" http://localhost:8765/ & exit /b)
where python >nul 2>nul && (python -m http.server 8765 & start "" http://localhost:8765/ & exit /b)
echo Python not found. Install Python from python.org or run any other static server in this folder.
pause
