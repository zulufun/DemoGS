"""PRTG server management routes"""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import requests
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from database import get_db
from models import Profile, PrtgServer
from schemas import PrtgServer as PrtgServerSchema, PrtgServerCreate, PrtgServerUpdate
from security import decode_token, get_bearer_token

router = APIRouter()


def _normalize_base_url(base_url: str) -> str:
    return base_url.rstrip("/")


def _build_auth_params(
    api_token: Optional[str],
    username: Optional[str],
    passhash: Optional[str],
) -> Dict[str, str]:
    if api_token:
        return {"apitoken": api_token}
    if username and passhash:
        return {"username": username, "passhash": passhash}
    return {}


def _status_bucket(status_text: str) -> str:
    normalized = status_text.lower()
    if "down" in normalized:
        return "down"
    if "warning" in normalized:
        return "warning"
    if "up" in normalized:
        return "up"
    return "other"


def _to_int(value: Any, default: int = 0) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def get_current_user(
    token: str = Depends(get_bearer_token),
    db: Session = Depends(get_db),
):
    """Extract and validate current user from JWT token"""
    payload = decode_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        )
    
    user_id = payload.get("sub")
    user = db.query(Profile).filter(Profile.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )
    
    return user


def require_admin(current_user: Profile = Depends(get_current_user)) -> Profile:
    """Verify current user is admin"""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return current_user


@router.get("/", response_model=List[PrtgServerSchema])
async def list_prtg_servers(
    db: Session = Depends(get_db),
    current_user: Profile = Depends(get_current_user),
):
    """List PRTG servers (admin-only)"""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    
    servers = db.query(PrtgServer).all()
    return servers


@router.post("/", response_model=PrtgServerSchema)
async def create_prtg_server(
    server_data: PrtgServerCreate,
    db: Session = Depends(get_db),
    admin: Profile = Depends(require_admin),
):
    """Create new PRTG server (admin-only)"""
    
    new_server = PrtgServer(
        name=server_data.name,
        base_url=server_data.base_url,
        api_token=server_data.api_token,
        username=server_data.username,
        passhash=server_data.passhash,
        is_active=server_data.is_active,
    )
    
    db.add(new_server)
    db.commit()
    db.refresh(new_server)
    
    return new_server


@router.get("/{server_id}", response_model=PrtgServerSchema)
async def get_prtg_server(
    server_id: str,
    db: Session = Depends(get_db),
    admin: Profile = Depends(require_admin),
):
    """Get PRTG server by ID (admin-only)"""
    
    server = db.query(PrtgServer).filter(PrtgServer.id == server_id).first()
    if not server:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="PRTG server not found",
        )
    
    return server


@router.put("/{server_id}", response_model=PrtgServerSchema)
async def update_prtg_server(
    server_id: str,
    update_data: PrtgServerUpdate,
    db: Session = Depends(get_db),
    admin: Profile = Depends(require_admin),
):
    """Update PRTG server (admin-only)"""
    
    server = db.query(PrtgServer).filter(PrtgServer.id == server_id).first()
    if not server:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="PRTG server not found",
        )
    
    # Update fields if provided
    if update_data.name is not None:
        server.name = update_data.name
    if update_data.base_url is not None:
        server.base_url = update_data.base_url
    if update_data.api_token is not None:
        server.api_token = update_data.api_token
    if update_data.username is not None:
        server.username = update_data.username
    if update_data.passhash is not None:
        server.passhash = update_data.passhash
    if update_data.is_active is not None:
        server.is_active = update_data.is_active
    
    db.commit()
    db.refresh(server)
    
    return server


@router.delete("/{server_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_prtg_server(
    server_id: str,
    db: Session = Depends(get_db),
    admin: Profile = Depends(require_admin),
):
    """Delete PRTG server (admin-only)"""
    
    server = db.query(PrtgServer).filter(PrtgServer.id == server_id).first()
    if not server:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="PRTG server not found",
        )
    
    db.delete(server)
    db.commit()


@router.get("/live/summary")
async def get_prtg_live_summary(
    server_id: Optional[str] = None,
    base_url: Optional[str] = None,
    username: Optional[str] = None,
    passhash: Optional[str] = None,
    api_token: Optional[str] = None,
    count: int = Query(default=100, ge=1, le=1000),
    db: Session = Depends(get_db),
    _current_user: Profile = Depends(get_current_user),
):
    """Fetch and summarize live sensors from PRTG table API."""
    selected_server: Optional[PrtgServer] = None
    if server_id:
        selected_server = db.query(PrtgServer).filter(PrtgServer.id == server_id).first()
        if not selected_server:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="PRTG server not found",
            )
    elif not base_url:
        selected_server = (
            db.query(PrtgServer)
            .filter(PrtgServer.is_active == True)  # noqa: E712
            .order_by(PrtgServer.updated_at.desc())
            .first()
        )

    resolved_base_url = base_url or (selected_server.base_url if selected_server else None)
    resolved_api_token = api_token or (selected_server.api_token if selected_server else None)
    resolved_username = username or (selected_server.username if selected_server else None)
    resolved_passhash = passhash or (selected_server.passhash if selected_server else None)

    if not resolved_base_url:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing base_url. Provide query params or configure an active PRTG server.",
        )

    auth_params = _build_auth_params(
        api_token=resolved_api_token,
        username=resolved_username,
        passhash=resolved_passhash,
    )
    if not auth_params:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing authentication. Provide apitoken or username+passhash.",
        )

    endpoint = f"{_normalize_base_url(resolved_base_url)}/api/table.json"
    query_params: Dict[str, Any] = {
        "content": "sensors",
        "columns": "objid,sensor,device,status,status_raw,message,lastvalue,lastup,priority,priority_raw",
        "count": str(count),
        **auth_params,
    }

    try:
        response = requests.get(endpoint, params=query_params, timeout=20)
        response.raise_for_status()
    except requests.RequestException as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Cannot read PRTG live data: {exc}",
        ) from exc

    try:
        payload = response.json()
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="PRTG response is not valid JSON",
        ) from exc

    raw_sensors = payload.get("sensors", []) or []
    sensors: List[Dict[str, Any]] = []
    status_counts = {"up": 0, "warning": 0, "down": 0, "other": 0}
    priority_counts = {"1": 0, "2": 0, "3": 0, "4": 0, "5": 0}

    for sensor in raw_sensors:
        sensor_status = str(sensor.get("status", "Unknown"))
        status_key = _status_bucket(sensor_status)
        status_counts[status_key] += 1

        priority_raw = _to_int(sensor.get("priority_raw", sensor.get("priority", 0)))
        priority_key = str(priority_raw)
        if priority_key in priority_counts:
            priority_counts[priority_key] += 1

        normalized = {
            "objid": _to_int(sensor.get("objid")),
            "sensor": str(sensor.get("sensor", "")),
            "device": str(sensor.get("device", "")),
            "status": sensor_status,
            "status_raw": _to_int(sensor.get("status_raw", 0)),
            "message": str(sensor.get("message_raw") or sensor.get("message") or ""),
            "lastvalue": str(sensor.get("lastvalue", "-")),
            "lastup": str(sensor.get("lastup", "-")),
            "priority": priority_raw,
        }
        sensors.append(normalized)

    top_priority = sorted(sensors, key=lambda item: (item["priority"], item["status_raw"]), reverse=True)[:12]

    return {
        "source": {
            "server_name": selected_server.name if selected_server else "custom",
            "base_url": _normalize_base_url(resolved_base_url),
            "requested_count": count,
            "returned_count": len(sensors),
            "prtg_version": payload.get("prtg-version"),
            "fetched_at": datetime.now(timezone.utc).isoformat(),
        },
        "status_counts": status_counts,
        "priority_counts": priority_counts,
        "top_priority_sensors": top_priority,
        "sensors": sensors,
    }
