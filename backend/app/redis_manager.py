import redis
import json
import logging
from typing import Optional, Any
import os

logger = logging.getLogger(__name__)


class RedisManager:
    """Manages Redis connections and caching operations."""
    
    def __init__(self, redis_url: str = None, password: str = None):
        """Initialize Redis client."""
        try:
            self.redis_url = redis_url or os.getenv("REDIS_URL", "redis://localhost:6379/0")
            self.password = password or os.getenv("REDIS_PASSWORD")
            
            self.client = redis.from_url(
                self.redis_url,
                password=self.password,
                decode_responses=True,
                socket_connect_timeout=5,
                socket_timeout=5
            )
            
            self.client.ping()
            logger.info(f"Connected to Redis: {self.redis_url}")
            self.enabled = True
            
        except Exception as e:
            logger.error(f"Failed to connect to Redis: {e}")
            logger.warning("Redis caching disabled, falling back to non-cached mode")
            self.enabled = False
            self.client = None
    
    def get(self, key: str) -> Optional[Any]:
        """Get value from cache."""
        if not self.enabled:
            return None
        
        try:
            value = self.client.get(key)
            if value:
                logger.debug(f"Cache HIT: {key}")
                return json.loads(value)
            logger.debug(f"Cache MISS: {key}")
            return None
        except Exception as e:
            logger.error(f"Redis GET error: {e}")
            return None
    
    def set(self, key: str, value: Any, ttl: int = 3600) -> bool:
        """Set value in cache with TTL in seconds."""
        if not self.enabled:
            return False
        
        try:
            serialized = json.dumps(value)
            self.client.setex(key, ttl, serialized)
            logger.debug(f"Cache SET: {key} (TTL: {ttl}s)")
            return True
        except Exception as e:
            logger.error(f"Redis SET error: {e}")
            return False
    
    def delete(self, key: str) -> bool:
        """Delete key from cache."""
        if not self.enabled:
            return False
        
        try:
            self.client.delete(key)
            logger.debug(f"Cache DELETE: {key}")
            return True
        except Exception as e:
            logger.error(f"Redis DELETE error: {e}")
            return False
    
    def delete_pattern(self, pattern: str) -> int:
        """Delete all keys matching pattern."""
        if not self.enabled:
            return 0
        
        try:
            keys = self.client.keys(pattern)
            if keys:
                count = self.client.delete(*keys)
                logger.debug(f"Cache DELETE pattern: {pattern} ({count} keys)")
                return count
            return 0
        except Exception as e:
            logger.error(f"Redis DELETE pattern error: {e}")
            return 0
    
    def is_healthy(self) -> bool:
        """Check if Redis is healthy."""
        if not self.enabled:
            return False
        
        try:
            return self.client.ping()
        except:
            return False
