"""
Redis connection for the upload queue. Used by the API to enqueue jobs and by the worker to consume them.
"""
import os
import redis

REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
UPLOAD_QUEUE_KEY = "log_analyser:upload_queue"


def get_redis() -> redis.Redis:
    """Return a Redis client. Connection is not pooled per-call; create once per process or use connection pool if needed."""
    return redis.from_url(REDIS_URL, decode_responses=True)
