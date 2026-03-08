@echo off
cd /d "%~dp0"
echo Starting Log Analyser API...
echo.
echo When you see "Application startup complete" below, open in browser:
echo   http://127.0.0.1:8000     - API running successfully
echo   http://127.0.0.1:8000/docs - Swagger UI
echo.
"..\venv\Scripts\python.exe" -m uvicorn app.main:app --host 127.0.0.1 --port 8000
pause
