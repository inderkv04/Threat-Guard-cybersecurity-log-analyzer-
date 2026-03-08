"""
FastAPI app for the log analyser: upload logs, list uploads, fetch entries/summary/alerts.
All routes require HTTP Basic auth (APP_USER / APP_PASS). Log processing runs in a worker.
"""
import os
from pathlib import Path

# Load .env from backend directory so APP_USER / APP_PASS are set when not in shell
_env_path = Path(__file__).resolve().parent.parent / ".env"
if _env_path.exists():
    from dotenv import load_dotenv
    load_dotenv(_env_path)

import json
import logging
import secrets
from typing import Optional

from fastapi import FastAPI, UploadFile, File, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from sqlalchemy import text, or_, func
from sqlalchemy.orm import Session, joinedload

from app.database import engine, Base, SessionLocal, DATABASE_URL
from app import models
from app.redis_client import get_redis, UPLOAD_QUEUE_KEY

# -----------------------------------------------------------------------------
# Config & logging
# -----------------------------------------------------------------------------

# Where to store uploaded log files (override with UPLOAD_DIR env)
UPLOAD_DIR = os.environ.get("UPLOAD_DIR", os.path.join(os.path.dirname(__file__), "..", "uploads"))

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# -----------------------------------------------------------------------------
# Auth (HTTP Basic)
# -----------------------------------------------------------------------------

security = HTTPBasic()


def require_basic_auth(credentials: HTTPBasicCredentials = Depends(security)) -> str:
    """Validate APP_USER / APP_PASS; return username on success."""
    expected_user = os.environ.get("APP_USER", "")
    expected_pass = os.environ.get("APP_PASS", "")
    if not expected_user or not expected_pass:
        raise HTTPException(status_code=500, detail="APP_USER/APP_PASS not set")
    if not (
        secrets.compare_digest(credentials.username, expected_user)
        and secrets.compare_digest(credentials.password, expected_pass)
    ):
        raise HTTPException(
            status_code=401,
            detail="Unauthorized",
            headers={"WWW-Authenticate": "Basic"},
        )
    return credentials.username


app = FastAPI()


@app.on_event("startup")
def startup_message():
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    logger.info("API ready. Open http://127.0.0.1:8000 for root, http://127.0.0.1:8000/docs for Swagger.")


def _to_iso(value):
    """Convert datetime (or string) to ISO format for JSON; None stays None."""
    if value is None:
        return None
    # SQLAlchemy may return datetime or string depending on driver/version
    if hasattr(value, "isoformat"):
        return value.isoformat()
    if isinstance(value, str):
        return value
    return str(value)


def _sanitize_filename(filename: str) -> str:
    """Strip path components and limit length for safe storage under UPLOAD_DIR."""
    base = os.path.basename(filename)
    if len(base) > 200:
        base = base[:200]
    return base or "upload.log"


# -----------------------------------------------------------------------------
# DB: lazy table creation (allows app to start before Postgres is up)
# -----------------------------------------------------------------------------

_tables_created = False


def _ensure_tables():
    """Create DB tables on first use. For Postgres, run one-time schema fixes (reason, log_id, index)."""
    global _tables_created
    if _tables_created:
        return
    try:
        Base.metadata.create_all(bind=engine)
        logger.info("Database tables created or already exist")
        if "postgresql" in DATABASE_URL:
            with engine.connect() as conn:
                # One-time migrations for alerts table (reason, log_id, index, nullable log_entry_id)
                conn.execute(text("ALTER TABLE alerts ADD COLUMN IF NOT EXISTS reason TEXT"))
                conn.execute(text("ALTER TABLE alerts ADD COLUMN IF NOT EXISTS log_id INTEGER"))
                conn.execute(text("CREATE INDEX IF NOT EXISTS ix_alerts_log_id ON alerts (log_id)"))
                conn.execute(text("ALTER TABLE alerts ALTER COLUMN log_entry_id DROP NOT NULL"))
                conn.commit()
        _tables_created = True
    except Exception as e:
        logger.warning("Could not create database tables (is Postgres running?): %s", e)


def get_db() -> Session:
    """Dependency: ensure tables exist, yield a DB session, close on exit."""
    _ensure_tables()
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# -----------------------------------------------------------------------------
# Routes
# -----------------------------------------------------------------------------

@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled error: %s", exc)
    return JSONResponse(
        status_code=500,
        content={"detail": str(exc), "type": type(exc).__name__},
    )


@app.get("/")
def root(user: str = Depends(require_basic_auth)) -> dict:
    return {"message": "API running successfully"}


@app.post("/logs/upload")
async def upload_log_file(
    file: UploadFile = File(...),
    user_id: Optional[int] = None,
    user: str = Depends(require_basic_auth),
    db: Session = Depends(get_db),
):
    """
    Accept a log file upload, save to disk, create UploadedLog, enqueue job to Redis, return 202.
    Parsing and anomaly detection run in a separate worker process.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="Filename is required")

    ext = (file.filename or "").rsplit(".", 1)[-1].lower() if "." in (file.filename or "") else ""
    if ext not in ("txt", "log"):
        raise HTTPException(
            status_code=400,
            detail="Accepted file formats are .txt and .log",
        )

    uploaded_log = models.UploadedLog(filename=file.filename, user_id=user_id)
    db.add(uploaded_log)
    db.flush()

    safe_name = _sanitize_filename(file.filename)
    relative_path = os.path.join(UPLOAD_DIR, f"{uploaded_log.id}_{safe_name}")
    abs_path = os.path.abspath(relative_path)

    raw_contents = await file.read()
    with open(abs_path, "wb") as f:
        f.write(raw_contents)

    db.commit()

    # Enqueue job for worker (log_id + path)
    payload = {"log_id": uploaded_log.id, "path": abs_path}
    try:
        redis_client = get_redis()
        redis_client.rpush(UPLOAD_QUEUE_KEY, json.dumps(payload))
    except Exception as e:
        logger.exception("Redis rpush failed: %s", e)
        raise HTTPException(status_code=503, detail="Queue unavailable")

    return JSONResponse(
        status_code=202,
        content={
            "log_id": uploaded_log.id,
            "filename": uploaded_log.filename,
            "status": "processing",
        },
    )


@app.get("/logs/{log_id}/entries")
def get_log_entries(
    log_id: int,
    user: str = Depends(require_basic_auth),
    db: Session = Depends(get_db),
) -> dict:
    """
    Return all log entries for an upload, with anomaly info for highlighting.
    Each entry includes anomalies[] (alert_type, reason, confidence_score) and is_anomalous.
    """
    log = db.query(models.UploadedLog).filter(models.UploadedLog.id == log_id).first()
    if not log:
        raise HTTPException(status_code=404, detail="Log not found")

    entries = (
        db.query(models.LogEntry)
        .filter(models.LogEntry.log_id == log_id)
        .order_by(models.LogEntry.id)
        .all()
    )
    # Eager-load alerts to avoid N+1
    entry_ids = [e.id for e in entries]
    alerts_by_entry: dict = {}
    if entry_ids:
        alerts = db.query(models.Alert).filter(models.Alert.log_entry_id.in_(entry_ids)).all()
        for a in alerts:
            alerts_by_entry.setdefault(a.log_entry_id, []).append(a)

    result = []
    for e in entries:
        alerts_list = alerts_by_entry.get(e.id, [])
        result.append({
            "id": e.id,
            "timestamp": _to_iso(e.timestamp),
            "ip_address": e.ip_address,
            "url": e.url,
            "action": e.action,
            "status_code": e.status_code,
            "raw_log": e.raw_log,
            "anomalies": [
                {
                    "alert_type": a.alert_type,
                    "reason": a.reason,
                    "confidence_score": a.confidence_score,
                }
                for a in alerts_list
            ],
            "is_anomalous": len(alerts_list) > 0,
        })
    return {"log_id": log_id, "filename": log.filename, "entries": result}


@app.get("/logs")
def list_uploads(
    limit: int = 50,
    offset: int = 0,
    user: str = Depends(require_basic_auth),
    db: Session = Depends(get_db),
) -> dict:
    total_count = db.query(func.count(models.UploadedLog.id)).scalar() or 0
    uploads = (
        db.query(models.UploadedLog)
        .order_by(models.UploadedLog.id.desc())
        .offset(offset)
        .limit(min(limit, 200))
        .all()
    )
    items = []
    for u in uploads:
        items.append(
            {
                "id": u.id,
                "filename": u.filename,
                "upload_time": _to_iso(u.upload_time),
                "user_id": u.user_id,
            }
        )
    return {"total": total_count, "items": items, "limit": limit, "offset": offset}


# --- Log summary (counts, severity buckets, top IPs, time range) ---

@app.get("/logs/{log_id}/summary")
def get_log_summary(
    log_id: int,
    user: str = Depends(require_basic_auth),
    db: Session = Depends(get_db),
) -> dict:
    log = db.query(models.UploadedLog).filter(models.UploadedLog.id == log_id).first()
    if not log:
        raise HTTPException(status_code=404, detail="Log not found")

    entries_total = (
        db.query(func.count(models.LogEntry.id))
        .filter(models.LogEntry.log_id == log_id)
        .scalar()
        or 0
    )

    alerts_total = (
        db.query(func.count(models.Alert.id))
        .filter(models.Alert.log_id == log_id)
        .scalar()
        or 0
    )

    alerts_by_type_rows = (
        db.query(models.Alert.alert_type, func.count(models.Alert.id))
        .filter(models.Alert.log_id == log_id)
        .group_by(models.Alert.alert_type)
        .order_by(func.count(models.Alert.id).desc())
        .all()
    )
    alerts_by_type = [{"alert_type": t, "count": c} for t, c in alerts_by_type_rows]

    # Severity: high >= 80, medium 60–79, low < 60 (same as /alerts)
    high = (
        db.query(func.count(models.Alert.id))
        .filter(models.Alert.log_id == log_id, models.Alert.confidence_score >= 80)
        .scalar()
        or 0
    )
    medium = (
        db.query(func.count(models.Alert.id))
        .filter(
            models.Alert.log_id == log_id,
            models.Alert.confidence_score >= 60,
            models.Alert.confidence_score < 80,
        )
        .scalar()
        or 0
    )
    low = (
        db.query(func.count(models.Alert.id))
        .filter(models.Alert.log_id == log_id, models.Alert.confidence_score < 60)
        .scalar()
        or 0
    )

    top_ips_rows = (
        db.query(models.LogEntry.ip_address, func.count(models.Alert.id))
        .join(models.Alert, models.Alert.log_entry_id == models.LogEntry.id)
        .filter(models.LogEntry.log_id == log_id)
        .group_by(models.LogEntry.ip_address)
        .order_by(func.count(models.Alert.id).desc())
        .limit(10)
        .all()
    )
    top_ips = [{"ip_address": ip, "alert_count": c} for ip, c in top_ips_rows if ip]

    time_range = (
        db.query(func.min(models.LogEntry.timestamp), func.max(models.LogEntry.timestamp))
        .filter(models.LogEntry.log_id == log_id)
        .first()
    )

    return {
        "log_id": log_id,
        "filename": log.filename,
        "entries_total": entries_total,
        "alerts_total": alerts_total,
        "alerts_by_severity": {"high": high, "medium": medium, "low": low},
        "alerts_by_type": alerts_by_type,
        "top_ips_by_alerts": top_ips,
        "time_range": {
            "min": _to_iso(time_range[0]) if time_range else None,
            "max": _to_iso(time_range[1]) if time_range else None,
        },
    }


# --- Alerts for a log (with optional log_entry preview) ---

@app.get("/logs/{log_id}/alerts")
def get_log_alerts(
    log_id: int,
    user: str = Depends(require_basic_auth),
    db: Session = Depends(get_db),
) -> dict:
    log = db.query(models.UploadedLog).filter(models.UploadedLog.id == log_id).first()
    if not log:
        raise HTTPException(status_code=404, detail="Log not found")

    def severity(score: Optional[int]) -> str:
        """Map confidence_score to high/medium/low (80 / 60 thresholds)."""
        s = score or 0
        if s >= 80:
            return "high"
        if s >= 60:
            return "medium"
        return "low"

    alerts = (
        db.query(models.Alert)
        .outerjoin(models.LogEntry, models.Alert.log_entry_id == models.LogEntry.id)
        .filter(or_(models.Alert.log_id == log_id, models.LogEntry.log_id == log_id))
        .options(joinedload(models.Alert.log_entry))
        .order_by(models.Alert.id)
        .all()
    )

    result = []
    for a in alerts:
        entry = a.log_entry
        result.append({
            "id": a.id,
            "alert_type": a.alert_type,
            "reason": a.reason or "",
            "confidence_score": a.confidence_score,
            "severity": severity(a.confidence_score),
            "created_at": _to_iso(a.created_at),
            "log_entry_id": a.log_entry_id,
            "entry_preview": None if not entry else {
                "id": entry.id,
                "timestamp": _to_iso(entry.timestamp),
                "ip_address": entry.ip_address,
                "url": entry.url,
                "status_code": entry.status_code,
            },
        })

    return {
        "log_id": log_id,
        "filename": log.filename,
        "total": len(result),
        "alerts": result,
    }