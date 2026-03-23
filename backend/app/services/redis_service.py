"""Redis cache and session management service"""

import redis
import json
from typing import Optional, Any
import logging

from app.core import settings

logger = logging.getLogger(__name__)

# Redis connection pool
redis_client: Optional[redis.Redis] = None


async def init_redis():
    """Initialize Redis connection"""
    global redis_client
    try:
        redis_client = redis.from_url(settings.REDIS_URL, decode_responses=True)
        # Test connection
        redis_client.ping()
        logger.info("Redis connected successfully")
    except Exception as e:
        logger.error(f"Failed to connect to Redis: {e}")
        raise


async def close_redis():
    """Close Redis connection"""
    global redis_client
    if redis_client:
        redis_client.close()
        logger.info("Redis connection closed")


def get_redis() -> redis.Redis:
    """Get Redis client instance"""
    if redis_client is None:
        raise RuntimeError("Redis not initialized")
    return redis_client


async def set_cache(key: str, value: Any, ttl: int = 3600):
    """Set value in cache with TTL (default 1 hour)"""
    try:
        client = get_redis()
        if isinstance(value, (dict, list)):
            value = json.dumps(value)
        client.setex(key, ttl, value)
    except Exception as e:
        logger.error(f"Redis set error for key {key}: {e}")


async def get_cache(key: str) -> Optional[Any]:
    """Get value from cache"""
    try:
        client = get_redis()
        value = client.get(key)
        if value and (value.startswith("{") or value.startswith("[")):
            try:
                return json.loads(value)
            except:
                return value
        return value
    except Exception as e:
        logger.error(f"Redis get error for key {key}: {e}")
        return None


async def delete_cache(key: str):
    """Delete key from cache"""
    try:
        client = get_redis()
        client.delete(key)
    except Exception as e:
        logger.error(f"Redis delete error for key {key}: {e}")


async def clear_cache_pattern(pattern: str):
    """Delete all keys matching pattern"""
    try:
        client = get_redis()
        for key in client.scan_iter(pattern):
            client.delete(key)
    except Exception as e:
        logger.error(f"Redis clear pattern error: {e}")


def incr_counter(key: str) -> int:
    """Increment counter and return value"""
    try:
        client = get_redis()
        return client.incr(key)
    except Exception as e:
        logger.error(f"Redis incr error: {e}")
        return 0


def get_counter(key: str) -> int:
    """Get counter value"""
    try:
        client = get_redis()
        value = client.get(key)
        return int(value) if value else 0
    except Exception as e:
        logger.error(f"Redis counter get error: {e}")
        return 0
