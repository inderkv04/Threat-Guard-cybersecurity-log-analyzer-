"""
Redis client for the log upload queue.
API enqueues jobs here; worker consumes from the same queue.
"""
import os
import redis

# Override via REDIS_URL env (e.g. redis://localhost:6379/0)
REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
# Queue name used for pending log file job IDs
UPLOAD_QUEUE_KEY = "log_analyser:upload_queue"


def get_redis() -> redis.Redis:
    """Return a Redis client. Uses decode_responses=True so values are Python str."""
    return redis.from_url(REDIS_URL, decode_responses=True)
