"""Elasticsearch log ingestion with real-time sync and batch processing"""

import logging
import asyncio
from typing import List, Dict, Any, Optional
import aiohttp
from datetime import datetime, timedelta
import base64

from app.core import settings
from .redis_service import get_cache, set_cache
from .kafka_service import publish_batch_logs

logger = logging.getLogger(__name__)


class ElasticsearchSyncService:
    """Service for syncing logs from Elasticsearch with rate limiting"""
    
    def __init__(self):
        self.es_url = settings.ELASTICSEARCH_URL
        self.es_username = settings.ELASTICSEARCH_USERNAME
        self.es_password = settings.ELASTICSEARCH_PASSWORD
        self.batch_size = settings.KAFKA_BATCH_SIZE
        self.batch_timeout_ms = settings.KAFKA_BATCH_TIMEOUT_MS
        self.session: Optional[aiohttp.ClientSession] = None
        self.last_sync = None
        
    async def init(self):
        """Initialize HTTP session"""
        self.session = aiohttp.ClientSession()
        
    async def close(self):
        """Close HTTP session"""
        if self.session:
            await self.session.close()
    
    def _get_auth_header(self) -> str:
        """Get Basic auth header"""
        credentials = f"{self.es_username}:{self.es_password}"
        encoded = base64.b64encode(credentials.encode()).decode()
        return f"Basic {encoded}"
    
    async def get_logs(
        self,
        index: str = "winlogbeat-*",
        limit: int = 1000,
        from_timestamp: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Fetch logs from Elasticsearch with pagination"""
        try:
            if not self.session:
                await self.init()
            
            # Build query with timestamp filter for real-time sync
            query = {
                "size": min(limit, 10000),
                "sort": [{"@timestamp": {"order": "desc"}}],
                "query": {"match_all": {}}
            }
            
            if from_timestamp:
                query["query"] = {
                    "range": {
                        "@timestamp": {
                            "gte": from_timestamp,
                            "lt": "now"
                        }
                    }
                }
            
            url = f"{self.es_url}/{index}/_search"
            headers = {
                "Authorization": self._get_auth_header(),
                "Content-Type": "application/json"
            }
            
            async with self.session.post(
                url,
                json=query,
                headers=headers,
                timeout=aiohttp.ClientTimeout(total=30)
            ) as response:
                if response.status == 200:
                    data = await response.json()
                    hits = data.get("hits", {}).get("hits", [])
                    
                    logs = []
                    for hit in hits:
                        source = hit.get("_source", {})
                        # Flatten nested fields for frontend
                        logs.append({
                            "id": hit.get("_id"),
                            "timestamp": source.get("@timestamp"),
                            "message": source.get("message", ""),
                            "level": source.get("winlog.level") or source.get("log.level"),
                            "computer": source.get("host.name"),
                            "provider": source.get("winlog.provider_name"),
                            "event_id": source.get("winlog.event_id"),
                            "raw": source
                        })
                    
                    self.last_sync = datetime.utcnow().isoformat()
                    return logs
                else:
                    logger.error(f"Elasticsearch error: {response.status}")
                    return []
                    
        except Exception as e:
            logger.error(f"Error fetching logs from Elasticsearch: {e}")
            return []
    
    async def sync_new_logs_to_kafka(self):
        """Sync only new logs since last sync"""
        try:
            # Get last sync time from cache or use 5 minutes ago
            cache_key = "elasticsearch:last_sync_time"
            last_sync = await get_cache(cache_key)
            
            if not last_sync:
                last_sync = (datetime.utcnow() - timedelta(minutes=5)).isoformat()
            
            # Fetch new logs
            logs = await self.get_logs(
                limit=self.batch_size,
                from_timestamp=last_sync
            )
            
            if logs:
                # Publish to Kafka in batch
                await publish_batch_logs(logs)
                
                # Update cache with latest sync time
                await set_cache(cache_key, datetime.utcnow().isoformat(), ttl=3600)
                logger.info(f"Synced {len(logs)} new logs to Kafka")
            
        except Exception as e:
            logger.error(f"Error syncing logs to Kafka: {e}")
    
    async def get_logs_paginated(
        self,
        page: int = 0,
        page_size: int = 50,
        severity_filter: Optional[str] = None
    ) -> Dict[str, Any]:
        """Get logs with pagination for frontend"""
        try:
            # Check cache first
            cache_key = f"elasticsearch:logs:page:{page}:size:{page_size}:severity:{severity_filter}"
            cached = await get_cache(cache_key)
            if cached:
                return cached
            
            query = {
                "size": page_size,
                "from": page * page_size,
                "sort": [{"@timestamp": {"order": "desc"}}],
                "query": {"match_all": {}}
            }
            
            # Apply severity filter if provided
            if severity_filter:
                query["query"] = {
                    "terms": {
                        "winlog.level.keyword": [severity_filter]
                    }
                }
            
            if not self.session:
                await self.init()
            
            url = f"{self.es_url}/winlogbeat-*/_search"
            headers = {
                "Authorization": self._get_auth_header(),
                "Content-Type": "application/json"
            }
            
            async with self.session.post(
                url,
                json=query,
                headers=headers,
                timeout=aiohttp.ClientTimeout(total=30)
            ) as response:
                if response.status == 200:
                    data = await response.json()
                    total = data.get("hits", {}).get("total", {})
                    hits = data.get("hits", {}).get("hits", [])
                    
                    result = {
                        "total": total.get("value", 0) if isinstance(total, dict) else total,
                        "page": page,
                        "page_size": page_size,
                        "logs": [hit.get("_source", {}) for hit in hits]
                    }
                    
                    # Cache for 2 minutes
                    await set_cache(cache_key, result, ttl=120)
                    return result
                else:
                    return {"total": 0, "page": page, "page_size": page_size, "logs": []}
                    
        except Exception as e:
            logger.error(f"Error fetching paginated logs: {e}")
            return {"total": 0, "page": page, "page_size": page_size, "logs": []}


# Global instance
_es_service: Optional[ElasticsearchSyncService] = None


async def init_elasticsearch_service():
    """Initialize Elasticsearch service"""
    global _es_service
    _es_service = ElasticsearchSyncService()
    await _es_service.init()
    logger.info("Elasticsearch sync service initialized")


async def close_elasticsearch_service():
    """Close Elasticsearch service"""
    global _es_service
    if _es_service:
        await _es_service.close()
        logger.info("Elasticsearch sync service closed")


def get_es_service() -> ElasticsearchSyncService:
    """Get Elasticsearch service instance"""
    if _es_service is None:
        raise RuntimeError("Elasticsearch service not initialized")
    return _es_service
