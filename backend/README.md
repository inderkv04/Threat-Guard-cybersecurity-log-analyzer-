# Threat Guard – Cybersecurity Log Analyzer

Threat Guard is a backend system that ingests web server log files, parses them asynchronously, and detects suspicious activity such as brute-force login attempts, endpoint probing, and abnormal traffic bursts.

The system uses a **queue-based architecture** where the API handles uploads and a background worker performs log parsing and anomaly detection.

---

# Architecture

1. A client uploads a log file using the API.
2. The API saves the file locally and pushes a processing job to Redis.
3. A background worker consumes the Redis queue.
4. The worker parses log lines and stores structured entries in PostgreSQL.
5. Anomaly detection rules analyze the logs and generate alerts.

```
Client
  │
  ▼
FastAPI API
  │
  ▼
Redis Queue
  │
  ▼
Worker Process
  │
  ▼
PostgreSQL Database
```

---

# Features

* Upload `.log` or `.txt` web server logs
* Asynchronous log processing via Redis queue
* Apache / Nginx access log parsing
* Structured log storage in PostgreSQL
* Rule-based anomaly detection
* REST API for querying logs, entries, summaries, and alerts
* HTTP Basic auth on all endpoints (configure via `APP_USER` / `APP_PASS`)

---

# Detection Rules

The worker analyzes parsed log entries and generates alerts based on predefined security rules.

| Rule                               | Description                                                                                                                                                                              |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Possible Brute Force Attack**    | Multiple authentication failures (401/403 responses) from the same IP address (threshold: ≥ 10).                                                                                        |
| **Sensitive Endpoint Probing**     | Requests targeting suspicious administrative endpoints such as `/admin`, `/login`, `/wp-admin`, or `/phpmyadmin`.                                                                        |
| **High Traffic From Single IP**    | Detects unusually high request volume from a single IP address (threshold ≥ 20 requests). Generates an aggregate alert without a specific log entry.                                     |
| **Sensitive File / Config Access** | Detects attempts to access sensitive files such as `.env`, `.git/`, `web.config`, `config.php`, `.well-known/`, `/debug`, `/trace`, `/actuator`, `.bak`, `.old`, `.sql`, or `wp-config`. |
| **404 Enumeration**                | Detects repeated `404 Not Found` responses from the same IP in a 5-minute window (threshold ≥ 15), which may indicate directory or endpoint enumeration.                               |

Alerts are stored with:

* `alert_type`
* `reason`
* `confidence_score`

---

# Tech Stack

* **Python**
* **FastAPI**
* **PostgreSQL**
* **Redis**
* **SQLAlchemy**

---

# Project Structure

```
backend/
 ├── app/
 │   ├── main.py           # FastAPI routes and upload handling
 │   ├── database.py       # SQLAlchemy engine, session, DATABASE_URL
 │   ├── worker.py         # Redis queue worker
 │   ├── models.py         # Database models
 │   ├── anomaly.py        # Detection rules
 │   ├── log_processing.py # Log parsing and processing
 │   └── redis_client.py   # Redis connection
 └── requirements.txt
```

---

# Setup

## 1. Install dependencies

```
pip install -r requirements.txt
```

## 2. Configure environment (required for API)

Set HTTP Basic auth credentials (all endpoints require these), or use the backend `.env` file (see below):

```
set APP_USER=inder
set APP_PASS=threat@123
```

On Linux/macOS: `export APP_USER=inder` and `export APP_PASS=threat@123`.  
Default credentials are also loaded from `backend/.env` if present (username: inder, password: threat@123).

Optional: `DATABASE_URL` (default: `postgresql://...`), `REDIS_URL` (default: `redis://localhost:6379/0`), `UPLOAD_DIR`.

## 3. Start Redis

```
redis-server
```

## 4. Start the API

```
uvicorn app.main:app --reload
```

API will run at:

```
http://localhost:8000
```

Swagger documentation:

```
http://localhost:8000/docs
```

## 5. Start the worker

Run in another terminal:

```
python -m app.worker
```

The worker consumes log processing jobs from Redis.

---

# Example API Usage

Upload a log file (use the same `APP_USER` / `APP_PASS` you configured, e.g. inder / threat@123):

```
curl -u inder:threat@123 -X POST http://localhost:8000/logs/upload -F "file=@apache_logs.txt"
```

Fetch parsed entries:

```
GET /logs/{log_id}/entries
```

Fetch alerts:

```
GET /logs/{log_id}/alerts
```

All endpoints require HTTP Basic auth.

---

# Database

The system stores data in PostgreSQL with the following main tables:

* `users`
* `uploaded_logs`
* `log_entries`
* `alerts`

Large uploads are processed in batches to avoid large database transactions.

---

# License

This project was built for educational and demonstration purposes.
