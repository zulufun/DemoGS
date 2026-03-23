"""WebSocket endpoint for real-time log streaming with rate limiting"""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from typing import Set
import logging
import asyncio
from datetime import datetime
import jwt
from app.core import settings, decode_token
from app.services import KafkaLogConsumer, get_redis, incr_counter

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ws", tags=["websocket"])

# Store active connections with rate limiting
class ConnectionManager:
    def __init__(self):
        self.active_connections: Set[WebSocket] = set()
        self.kafka_consumer = None
        
    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.add(websocket)
        logger.info(f"Client connected. Total connections: {len(self.active_connections)}")
        
    def disconnect(self, websocket: WebSocket):
        self.active_connections.discard(websocket)
        logger.info(f"Client disconnected. Total connections: {len(self.active_connections)}")
    
    async def broadcast(self, message: dict):
        """Broadcast message to all connected clients with rate limiting"""
        if not self.active_connections:
            return
        
        disconnected = []
        for connection in self.active_connections:
            try:
                # Rate limit check per connection
                client_key = f"ws:{id(connection)}:rate_limit"
                redis = get_redis()
                count = incr_counter(client_key)
                if count == 1:
                    redis.expire(f"{client_key}", 1)  # Reset every second
                
                # Allow max 100 messages per second per client
                if count <= 100:
                    await connection.send_json(message)
                    
            except Exception as e:
                logger.error(f"Error sending message: {e}")
                disconnected.append(connection)
        
        # Clean up disconnected clients
        for conn in disconnected:
            self.disconnect(conn)
    
    async def broadcast_batch(self, messages: list, delay_ms: int = 1000):
        """Broadcast batch of messages with delay between batches"""
        for batch in self._chunk_messages(messages, 50):
            for message in batch:
                await self.broadcast(message)
            await asyncio.sleep(delay_ms / 1000.0)
    
    @staticmethod
    def _chunk_messages(messages: list, chunk_size: int):
        """Split messages into chunks"""
        for i in range(0, len(messages), chunk_size):
            yield messages[i:i + chunk_size]
    
    async def start_kafka_consumer(self):
        """Start consuming logs from Kafka"""
        if not self.kafka_consumer:
            self.kafka_consumer = KafkaLogConsumer(
                on_message_callback=self._on_kafka_message,
                group_id="websocket-consumers"
            )
            await self.kafka_consumer.start()
    
    def _on_kafka_message(self, message: dict):
        """Handle message from Kafka"""
        try:
            # Don't use asyncio.create_task directly, schedule as task
            asyncio.create_task(
                self.broadcast({
                    "type": "log_update",
                    "data": message,
                    "timestamp": datetime.utcnow().isoformat()
                })
            )
        except Exception as e:
            logger.error(f"Error processing Kafka message: {e}")
    
    async def stop_kafka_consumer(self):
        """Stop Kafka consumer"""
        if self.kafka_consumer:
            self.kafka_consumer.stop()
            self.kafka_consumer = None


manager = ConnectionManager()


def verify_ws_token(token: str) -> dict:
    """Verify JWT token and return claims"""
    payload = decode_token(token)
    if not payload:
        raise ValueError("Invalid token")
    return payload


@router.websocket("/logs")
async def websocket_logs(
    websocket: WebSocket,
    token: str = Query(...)
):
    """WebSocket endpoint for real-time log updates"""
    
    # Verify token
    try:
        token_data = verify_ws_token(token)
        user_id = token_data.get("sub")
        
        if not user_id:
            await websocket.close(code=4001, reason="Invalid token")
            return
            
    except ValueError as e:
        await websocket.close(code=4001, reason=str(e))
        return
    
    await manager.connect(websocket)
    
    # Start Kafka consumer if not already started
    if not manager.kafka_consumer:
        await manager.start_kafka_consumer()
    
    try:
        while True:
            # Receive client message (ping, rate limit request, etc.)
            data = await websocket.receive_json()
            
            if data.get("type") == "ping":
                await websocket.send_json({"type": "pong", "timestamp": datetime.utcnow().isoformat()})
            
            elif data.get("type") == "subscribe":
                # Client subscribed to log updates
                severity = data.get("severity_filter")
                await websocket.send_json({
                    "type": "subscribed",
                    "filters": {"severity": severity},
                    "timestamp": datetime.utcnow().isoformat()
                })
            
            elif data.get("type") == "unsubscribe":
                # Client unsubscribed
                await websocket.send_json({
                    "type": "unsubscribed",
                    "timestamp": datetime.utcnow().isoformat()
                })
                break
                
    except WebSocketDisconnect:
        manager.disconnect(websocket)
        logger.info(f"Client disconnected: {websocket.client}")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        manager.disconnect(websocket)


@router.get("/sync-check")
async def check_log_sync_status(token: str = Query(...)):
    """
    Check if logs need syncing and return sync status
    Allows frontend to know if data is up-to-date
    """
    try:
        token_data = verify_ws_token(token)
        user_id = token_data.get("sub")
        
        if not user_id:
            return {"error": "Unauthorized"}, 401
        
        redis = get_redis()
        last_sync = redis.get("elasticsearch:last_sync_time")
        
        return {
            "synced": last_sync is not None,
            "last_sync": last_sync,
            "websocket_available": len(manager.active_connections) > 0,
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        logger.error(f"Error checking sync status: {e}")
        return {"error": str(e)}, 500
