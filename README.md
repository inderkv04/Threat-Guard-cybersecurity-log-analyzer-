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
* Zscaler NSS log format support
* Structured log storage in PostgreSQL
* Rule-based anomaly detection
* REST API for querying logs, entries, summaries, and alerts

---

# Detection Rules

The worker analyzes parsed log entries and generates alerts based on predefined security rules.

| Rule                               | Description                                                                                                                                                                              |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Possible Brute Force Attack**    | Multiple authentication failures (401/403 responses) from the same IP address.                                                                                                           |
| **Sensitive Endpoint Probing**     | Requests targeting suspicious administrative endpoints such as `/admin`, `/login`, `/wp-admin`, or `/phpmyadmin`.                                                                        |
| **High Traffic From Single IP**    | Detects unusually high request volume from a single IP address (threshold ≥ 20 requests). Generates an aggregate alert without a specific log entry.                                     |
| **Sensitive File / Config Access** | Detects attempts to access sensitive files such as `.env`, `.git/`, `web.config`, `config.php`, `.well-known/`, `/debug`, `/trace`, `/actuator`, `.bak`, `.old`, `.sql`, or `wp-config`. |
| **404 Enumeration**                | Detects repeated `404 Not Found` responses which may indicate directory or endpoint enumeration attempts.                                                                                |

Alerts are stored with:

* `alert_type`
* `reason`
* `confidence_score`
* associated `log_entry_id` (when applicable)

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
 │   ├── main.py          # FastAPI routes and upload handling
 │   ├── worker.py        # Redis queue worker
 │   ├── models.py        # Database models
 │   ├── anomaly.py       # Detection rules
 │   ├── log_processing.py# Log parsing and processing
 │   └── redis_client.py  # Redis connection
 └── requirements.txt
```

---

# Setup

## 1. Install dependencies

```
pip install -r requirements.txt
```

## 2. Start Redis

```
redis-server
```

## 3. Start the API

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

## 4. Start the worker

Run in another terminal:

```
python -m app.worker
```

The worker consumes log processing jobs from Redis.

---

# Example API Usage

Upload a log file:

```
curl -X POST http://localhost:8000/logs/upload \
-F "file=@apache_logs.txt"
```

Fetch parsed entries:

```
GET /logs/{log_id}/entries
```

Fetch alerts:

```
GET /logs/{log_id}/alerts
```

---

# Database

The system stores data in PostgreSQL with the following main tables:

* `uploaded_logs`
* `log_entries`
* `alerts`

Large uploads are processed in batches to avoid large database transactions.

---

# Future Improvements

* Machine learning based anomaly detection
* Behavioral profiling per IP address
* Real-time alert streaming
* Dashboard for security analysts

---

# License

This project was built for educational and demonstration purposes.
