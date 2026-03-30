from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import asyncio
import logging

from config import settings
from database import engine, Base
from routes import auth, users, prtg, audit, alerts, operations, gates, ws_logs, paloalto
from redis_service import init_redis, close_redis
from kafka_service import init_kafka, close_kafka
from elasticsearch_service import init_elasticsearch_service, close_elasticsearch_service, get_es_service

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create tables on startup
Base.metadata.create_all(bind=engine)

# Background sync task
_sync_task = None


async def start_elasticsearch_sync():
    """Start background task for syncing logs from Elasticsearch to Kafka"""
    global _sync_task
    
    async def sync_loop():
        es_service = get_es_service()
        while True:
            try:
                await es_service.sync_new_logs_to_kafka()
                # Sync every 5 seconds
                await asyncio.sleep(5)
            except Exception as e:
                logger.error(f"Error in sync loop: {e}")
                await asyncio.sleep(10)
    
    _sync_task = asyncio.create_task(sync_loop())
    logger.info("Elasticsearch sync task started")


async def stop_elasticsearch_sync():
    """Stop background sync task"""
    global _sync_task
    if _sync_task:
        _sync_task.cancel()
        try:
            await _sync_task
        except asyncio.CancelledError:
            pass
        logger.info("Elasticsearch sync task stopped")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("🚀 Backend startup")
    Base.metadata.create_all(bind=engine)
    
    try:
        # Initialize Redis
        await init_redis()
        logger.info("✓ Redis initialized")
        
        # Initialize Kafka
        await init_kafka()
        logger.info("✓ Kafka initialized")
        
        # Initialize Elasticsearch service
        await init_elasticsearch_service()
        logger.info("✓ Elasticsearch service initialized")
        
        # Start background sync task
        await start_elasticsearch_sync()
        
    except Exception as e:
        logger.error(f"Error during startup: {e}")
    
    yield
    
    # Shutdown
    logger.info("🛑 Backend shutdown")
    
    try:
        await stop_elasticsearch_sync()
        await close_elasticsearch_service()
        await close_kafka()
        await close_redis()
        logger.info("✓ All services closed")
    except Exception as e:
        logger.error(f"Error during shutdown: {e}")


app = FastAPI(
    title="Demo Backend API",
    description="Python backend for demo project",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.get_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Health check
@app.get("/health")
async def health_check():
    return {"status": "ok"}

# Include routes
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(users.router, prefix="/api/users", tags=["users"])
app.include_router(prtg.router, prefix="/api/prtg", tags=["prtg"])
app.include_router(audit.router, prefix="/api/audit", tags=["audit"])
app.include_router(alerts.router, prefix="/api/alerts", tags=["alerts"])
app.include_router(operations.router, prefix="/api/operations", tags=["operations"])
app.include_router(gates.router, prefix="/api/gates", tags=["gates"])
app.include_router(paloalto.router, prefix="/api/paloalto", tags=["paloalto"])
app.include_router(ws_logs.router, tags=["websocket"])


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

