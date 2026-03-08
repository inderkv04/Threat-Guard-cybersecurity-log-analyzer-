@echo off
cd /d "%~dp0"
echo Starting Log Analyser worker (Redis queue consumer)...
echo Ensure Redis is running and API has been started at least once.
echo.
if defined REDIS_URL echo REDIS_URL=%REDIS_URL%
if defined DATABASE_URL echo DATABASE_URL=%DATABASE_URL%
echo.
"..\venv\Scripts\python.exe" -m app.worker
pause
