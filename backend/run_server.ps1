# Run the log analyser API on port 8001 (avoids conflict with anything on 8000)
# Open http://127.0.0.1:8001/docs in your browser
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
& "..\venv\Scripts\python.exe" -m uvicorn app.main:app --host 127.0.0.1 --port 8001
