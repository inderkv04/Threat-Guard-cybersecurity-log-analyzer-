"""
Worker process: consumes upload jobs from Redis (BLPOP), reads the file from disk,
parses lines, inserts LogEntry rows, runs anomaly detection, commits.
Run with: python -m app.worker (from backend directory). Requires REDIS_URL and DATABASE_URL.
"""
import json
import logging
import os

from app.database import SessionLocal
from app.log_processing import process_log_file
from app.redis_client import get_redis, UPLOAD_QUEUE_KEY

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

BLPOP_TIMEOUT = 5


def run_worker() -> None:
    redis_client = get_redis()
    logger.info("Worker started, listening on queue %s", UPLOAD_QUEUE_KEY)

    while True:
        try:
            result = redis_client.blpop(UPLOAD_QUEUE_KEY, timeout=BLPOP_TIMEOUT)
        except Exception as e:
            logger.exception("Redis BLPOP error: %s", e)
            continue

        if result is None:
            continue

        _queue_name, payload = result
        try:
            data = json.loads(payload)
            log_id = data.get("log_id")
            path = data.get("path")
            if log_id is None or not path:
                logger.warning("Invalid message: missing log_id or path: %s", data)
                continue
        except (json.JSONDecodeError, TypeError) as e:
            logger.warning("Invalid message (not JSON or wrong shape): %s", e)
            continue

        if not os.path.isfile(path):
            logger.error("File not found: %s (log_id=%s)", path, log_id)
            continue

        db = SessionLocal()
        try:
            entries_created, alerts_created = process_log_file(db, log_id, path)
            db.commit()
            logger.info("Processed log_id=%s path=%s entries=%s alerts=%s", log_id, path, entries_created, alerts_created)
        except Exception as e:
            db.rollback()
            logger.exception("Failed to process log_id=%s path=%s: %s", log_id, path, e)
        finally:
            db.close()


if __name__ == "__main__":
    run_worker()
