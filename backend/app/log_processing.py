"""
Log parsing and file processing for the worker.

This module:
1. Parses Apache/Nginx-style access logs
2. Converts each log line into LogEntry database rows
3. Runs anomaly detection after processing
"""
import re
from datetime import datetime
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
from app import models
from app import anomaly


# -------------------------------------------------------
# Configuration
# -------------------------------------------------------

# Number of LogEntry rows inserted before flushing to DB.
# This prevents excessive memory usage during large log imports.
LOG_ENTRY_BATCH_SIZE = 1000

# Apache/Nginx access log timestamp format
APACHE_TS_FMT = "%d/%b/%Y:%H:%M:%S %z"


# -------------------------------------------------------
# Apache/Nginx Access Log Regex
# -------------------------------------------------------

# Example log line:
# 192.168.1.1 - - [10/Oct/2023:13:55:36 +0000] "GET /admin HTTP/1.1" 404 123

APACHE_ACCESS_LOG_PATTERN = re.compile(
    r'^(?P<ip>\S+)\s+\S+\s+\S+\s+\[(?P<timestamp>[^\]]+)\]\s+'
    r'"(?P<method>\S+)\s+(?P<url>\S+)\s+(?P<protocol>[^"]+)"\s+'
    r'(?P<status>\d{3})\s+\S+'
)


# -------------------------------------------------------
# Timestamp Parser
# -------------------------------------------------------

def _parse_apache_timestamp(s: Optional[str]) -> Optional[datetime]:
    """Parse timestamp from Apache/Nginx access log."""
    if not s or not s.strip():
        return None

    try:
        return datetime.strptime(s.strip(), APACHE_TS_FMT)
    except ValueError:
        return None


# -------------------------------------------------------
# Log Line Parser
# -------------------------------------------------------

def parse_log_line(line: str) -> Dict[str, Any]:
    """
    Parse a single Apache/Nginx log line into structured fields.

    Returns dictionary containing:
        timestamp
        ip_address
        url
        action (HTTP method)
        status_code
    """

    match = APACHE_ACCESS_LOG_PATTERN.match(line)

    if not match:
        return {}

    data = match.groupdict()

    return {
        "timestamp": _parse_apache_timestamp(data.get("timestamp")),
        "ip_address": data.get("ip"),
        "url": data.get("url"),
        "action": data.get("method"),
        "status_code": int(data["status"]) if data.get("status") else None,
    }


# -------------------------------------------------------
# File Processing Worker
# -------------------------------------------------------

def process_log_file(db: Session, log_id: int, file_path: str) -> tuple[int, int]:
    """
    Process a log file and insert parsed entries into the database.

    Steps:
    1. Validate file type
    2. Read file line-by-line
    3. Parse each log line
    4. Insert LogEntry rows
    5. Run anomaly detection

    Args:
        db: SQLAlchemy database session
        log_id: ID of the uploaded log file
        file_path: path to the log file on disk

    Returns:
        (entries_created, alerts_created)
    """

    # Only allow supported log file types
    if not file_path.endswith((".log", ".txt")):
        raise ValueError("Unsupported file type. Only .log and .txt allowed.")

    entries_created = 0

    # Read file in binary so we can try UTF-8 first, then fall back to Latin-1 per line
    with open(file_path, "rb") as f:

        for raw_line in f:

            try:
                line = raw_line.decode("utf-8")
            except UnicodeDecodeError:
                line = raw_line.decode("latin-1", errors="replace")

            # Skip empty lines
            if not line.strip():
                continue

            parsed = parse_log_line(line)

            log_entry = models.LogEntry(
                log_id=log_id,
                raw_log=line,
                timestamp=parsed.get("timestamp"),
                ip_address=parsed.get("ip_address"),
                url=parsed.get("url"),
                action=parsed.get("action"),
                status_code=parsed.get("status_code"),
            )

            db.add(log_entry)
            entries_created += 1

            # Periodically flush inserts to avoid large transactions
            if entries_created % LOG_ENTRY_BATCH_SIZE == 0:
                db.flush()

    # Final flush to ensure remaining entries are saved
    db.flush()

    # Run anomaly detection on the processed log entries
    alerts_created = anomaly.run_detection(db, log_id)

    return entries_created, alerts_created