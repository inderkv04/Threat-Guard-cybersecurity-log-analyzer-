# Log Analyser

A FastAPI backend that ingests web server log files, stores them on disk, enqueues a job to Redis, and returns immediately (202 Accepted). A **separate worker process** consumes the queue, parses files, stores entries in PostgreSQL, and runs anomaly detection to flag suspicious activity (e.g. brute force, URL probing, IP bursts).

## Features

- **Log upload**: Accept `.txt` or `.log` files via multipart upload. The API saves the file to disk (e.g. `./uploads`), creates an `UploadedLog` row, pushes a message to Redis, and responds with **202 Accepted** and `log_id` / `filename` / `status: "processing"`. No parsing or detection in the API.
- **Worker**: A separate process runs `python -m app.worker`. It blocks on Redis (BLPOP on `log_analyser:upload_queue`), then for each message reads the file from the path in the message, parses lines, inserts `LogEntry` rows, runs anomaly detection, and commits. **Redis must be running** before starting the API and the worker.
- **Parsers**: Supports **Apache/Nginx-style** access logs and **Zscaler NSS** web log CSV format. Each non-empty line becomes a `LogEntry` with timestamp, IP, URL, method, and status code.
- **Anomaly detection**: The worker runs detectors and creates `Alert` records:
  - **Brute force**: Many 401/403 responses from the same IP (threshold: 10).
  - **URL scanning**: Access to sensitive paths (e.g. `/admin`, `/login`, `/wp-admin`, `/phpmyadmin`).
  - **IP burst**: Unusually high request count from a single IP (threshold: 100).
- **API**: Upload logs, then fetch log entries for an upload with anomaly info (alert type, reason, confidence, `is_anomalous`).

## Tech stack

- **Python 3**, **FastAPI**, **Uvicorn**
- **SQLAlchemy 2** + **PostgreSQL** (psycopg2)
- **Redis** – upload queue (`log_analyser:upload_queue`); API pushes, worker consumes with BLPOP.
- All timestamps stored as UTC with timezone (`timestamptz`).

## Project structure

```
log_analyser/
├── README.md
└── backend/
    ├── app/
    │   ├── main.py          # FastAPI app, routes; upload saves file and enqueues to Redis
    │   ├── database.py       # SQLAlchemy engine, session, DATABASE_URL
    │   ├── models.py         # User, UploadedLog, LogEntry, Alert
    │   ├── anomaly.py        # Detection rules (bruteforce, URL scanning, IP burst)
    │   ├── log_processing.py # Parsing (Apache/Zscaler) + process_log_file() for worker
    │   ├── redis_client.py   # Redis connection, UPLOAD_QUEUE_KEY
    │   └── worker.py         # BLPOP loop, process_log_file(), commit
    ├── requirements.txt
    ├── run_server.bat        # Windows: run API (uses ..\venv)
    ├── run_worker.bat        # Windows: run worker (Redis queue consumer)
    └── run_server.ps1        # PowerShell variant (port 8001)
```

## Prerequisites

- **Python 3.10+**
- **PostgreSQL** running with a database (e.g. `log_db`) and a user with access (default in code: `inder` / `password1234`).
- **Redis** running (e.g. `redis-server` on port 6379). Required for uploads and for the worker. Set `REDIS_URL` if needed (default: `redis://localhost:6379/0`).

## Setup

1. **Clone or open the project** and go to the backend:

   ```bash
   cd log_analyser/backend
   ```

2. **Create a virtual environment** (optional but recommended):

   ```bash
   python -m venv venv
   venv\Scripts\activate
   ```

3. **Install dependencies**:

   ```bash
   pip install -r requirements.txt
   ```

4. **Configure the database**  
   The app uses PostgreSQL by default. Connection is set in `app/database.py`:

   - Default URL: `postgresql://inder:password1234@localhost:5432/log_db`
   - To override: set the `DATABASE_URL` environment variable.

   Ensure the database and user exist and that the `alerts` table has a `reason` column (the app can add it automatically on first request if missing).

   Optional: `UPLOAD_DIR` (default: `./uploads` relative to backend), `REDIS_URL` (default: `redis://localhost:6379/0`).

## Run the API and worker

1. **Start Redis** (if not already running), e.g. `redis-server`.

2. **Run the API** from the **backend** directory:

   ```bash
   uvicorn app.main:app --host 127.0.0.1 --port 8000
   ```

   - **Root**: http://127.0.0.1:8000  
   - **Swagger UI**: http://127.0.0.1:8000/docs  

   On Windows: `run_server.bat` (uses `..\venv\Scripts\python.exe` and port 8000) or `run_server.ps1` (port 8001).

3. **Run the worker** in a **separate terminal** from the **backend** directory:

   ```bash
   python -m app.worker
   ```

   On Windows: `run_worker.bat`. The worker blocks on Redis (BLPOP); when you upload a file via the API, the worker processes it (parse + insert entries + run detection).

## API endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Health check: `{"message": "API running successfully"}` |
| POST | `/logs/upload` | Upload a log file (`.txt` or `.log`). Body: `file` (multipart). Saves to disk, enqueues to Redis, returns **202 Accepted** with `log_id`, `filename`, `status: "processing"`. Entries and alerts appear after the worker processes the file. |
| GET | `/logs/{log_id}/entries` | List all log entries for an upload, with `anomalies[]` and `is_anomalous` per entry. |
| GET | `/logs` | List uploads. |
| GET | `/logs/{log_id}/summary` | Aggregates (entries_total, alerts_total, alerts_by_severity, etc.). |
| GET | `/logs/{log_id}/alerts` | Flat list of alerts with entry_preview. |

### Example: upload and fetch entries

```bash
# Upload (replace path with your file). Returns 202 Accepted.
curl -X POST "http://127.0.0.1:8000/logs/upload" \
  -u "admin:admin123" \
  -F "file=@apache_web_logs.txt;type=text/plain"

# Response: {"log_id": 1, "filename": "apache_web_logs.txt", "status": "processing"}

# After the worker processes the file, get entries for that upload
curl -u "admin:admin123" "http://127.0.0.1:8000/logs/1/entries"
```

## Database

- **PostgreSQL only** (no SQLite). Tables: `users`, `uploaded_logs`, `log_entries`, `alerts`.
- Tables are created on first use via `Base.metadata.create_all`. If the `alerts` table exists but is missing the `reason` column, the app adds it automatically when using PostgreSQL.
- Large uploads are flushed in batches (1000 log entries per flush) to stay under PostgreSQL’s parameter limit per statement.

## Log formats

- **Apache/Nginx**: One line per request, e.g.  
  `127.0.0.1 - - [10/Oct/2000:13:55:36 -0700] "GET /path HTTP/1.0" 200 2326`
- **Zscaler NSS**: CSV with quoted fields; the parser expects at least 24 fields and uses time, URL, source IP, method, status from fixed indices.

## License

Use as needed for your project.
