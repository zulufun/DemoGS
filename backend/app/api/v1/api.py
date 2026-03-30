"""API v1 router that combines all endpoints"""

from fastapi import APIRouter
from .endpoints import auth, users, audit, prtg, alerts, operations, gates, ws_logs, paloalto, vertiv

router = APIRouter(prefix="/api")

# Include all routers
router.include_router(auth.router, prefix="/auth", tags=["auth"])
router.include_router(users.router, prefix="/users", tags=["users"])
router.include_router(audit.router, prefix="/audit", tags=["audit"])
router.include_router(prtg.router, prefix="/prtg", tags=["prtg"])
router.include_router(alerts.router, prefix="/alerts", tags=["alerts"])
router.include_router(operations.router, prefix="/operations/tasks", tags=["operations"])
router.include_router(gates.router, prefix="/gates", tags=["gates"])
router.include_router(paloalto.router, prefix="/paloalto", tags=["paloalto"])
router.include_router(vertiv.router, prefix="/vertiv", tags=["vertiv"])
router.include_router(ws_logs.router, tags=["websocket"])

__all__ = ["router"]
