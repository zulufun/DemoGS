"""PRTG server routes"""

from datetime import datetime, timezone
from typing import Any, Optional

import requests
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core import get_db, get_bearer_token, decode_token
from app.models import PrtgServer
from app.schemas import PrtgServer as PrtgServerSchema, PrtgServerCreate, PrtgServerUpdate

router = APIRouter()


def _normalize_base_url(base_url: str) -> str:
    return base_url.rstrip("/")


def _build_auth_params(
    api_token: Optional[str],
    username: Optional[str],
    passhash: Optional[str],
) -> dict[str, str]:
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


@router.get("", response_model=list[PrtgServerSchema])
async def list_prtg_servers(
    token: str = Depends(get_bearer_token),
    db: Session = Depends(get_db),
):
    """List PRTG servers"""
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    
    servers = db.query(PrtgServer).all()
    return servers


@router.post("", response_model=PrtgServerSchema)
async def create_prtg_server(
    server: PrtgServerCreate,
    token: str = Depends(get_bearer_token),
    db: Session = Depends(get_db),
):
    """Create PRTG server"""
    payload = decode_token(token)
    if not payload or payload.get("role") != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)
    
    new_server = PrtgServer(**server.dict())
    db.add(new_server)
    db.commit()
    db.refresh(new_server)
    return new_server


@router.get("/live/summary")
async def get_prtg_live_summary(
    base_url: Optional[str] = None,
    username: Optional[str] = None,
    passhash: Optional[str] = None,
    api_token: Optional[str] = None,
    count: int = Query(default=1000, ge=1, le=5000),
    token: str = Depends(get_bearer_token),
    db: Session = Depends(get_db),
):
    """Fetch and summarize live sensors from PRTG HTTP API."""
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)

    resolved_base_url = base_url
    resolved_username = username
    resolved_passhash = passhash
    resolved_api_token = api_token
    source_name = "custom"

    if not resolved_base_url:
        default_server = (
            db.query(PrtgServer)
            .filter(PrtgServer.is_active == True)  # noqa: E712
            .order_by(PrtgServer.updated_at.desc())
            .first()
        )
        if default_server:
            resolved_base_url = default_server.base_url
            resolved_username = resolved_username or default_server.username
            resolved_passhash = resolved_passhash or default_server.passhash
            resolved_api_token = resolved_api_token or default_server.api_token
            source_name = default_server.name

    if not resolved_base_url:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing base_url. Provide query params or configure active PRTG server.",
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
    query_params: dict[str, Any] = {
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
        raw_payload = response.json()
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="PRTG response is not valid JSON",
        ) from exc

    sensors = raw_payload.get("sensors", []) or []
    total_count = _to_int(raw_payload.get("treesize", len(sensors)), len(sensors))
    normalized_sensors: list[dict[str, Any]] = []
    status_counts = {"up": 0, "warning": 0, "down": 0, "other": 0}
    priority_counts = {"1": 0, "2": 0, "3": 0, "4": 0, "5": 0}

    for sensor in sensors:
        status_text = str(sensor.get("status", "Unknown"))
        status_key = _status_bucket(status_text)
        status_counts[status_key] += 1

        priority_raw = _to_int(sensor.get("priority_raw", sensor.get("priority", 0)))
        priority_key = str(priority_raw)
        if priority_key in priority_counts:
            priority_counts[priority_key] += 1

        normalized_sensors.append(
            {
                "objid": _to_int(sensor.get("objid")),
                "sensor": str(sensor.get("sensor", "")),
                "device": str(sensor.get("device", "")),
                "status": status_text,
                "status_raw": _to_int(sensor.get("status_raw", 0)),
                "message": str(sensor.get("message_raw") or sensor.get("message") or ""),
                "lastvalue": str(sensor.get("lastvalue", "-")),
                "lastup": str(sensor.get("lastup", "-")),
                "priority": priority_raw,
            }
        )

    top_priority_sensors = sorted(
        normalized_sensors,
        key=lambda item: (item["priority"], item["status_raw"]),
        reverse=True,
    )[:12]

    return {
        "source": {
            "server_name": source_name,
            "base_url": _normalize_base_url(resolved_base_url),
            "requested_count": count,
            "returned_count": len(normalized_sensors),
            "total_count": total_count,
            "is_truncated": len(normalized_sensors) < total_count,
            "prtg_version": raw_payload.get("prtg-version"),
            "fetched_at": datetime.now(timezone.utc).isoformat(),
        },
        "status_counts": status_counts,
        "priority_counts": priority_counts,
        "top_priority_sensors": top_priority_sensors,
        "sensors": normalized_sensors,
    }


@router.get("/{server_id}", response_model=PrtgServerSchema)
async def get_prtg_server(
    server_id: str,
    token: str = Depends(get_bearer_token),
    db: Session = Depends(get_db),
):
    """Get PRTG server by ID"""
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    
    server = db.query(PrtgServer).filter(PrtgServer.id == server_id).first()
    if not server:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    
    return server


@router.put("/{server_id}", response_model=PrtgServerSchema)
async def update_prtg_server(
    server_id: str,
    server_update: PrtgServerUpdate,
    token: str = Depends(get_bearer_token),
    db: Session = Depends(get_db),
):
    """Update PRTG server"""
    payload = decode_token(token)
    if not payload or payload.get("role") != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)
    
    server = db.query(PrtgServer).filter(PrtgServer.id == server_id).first()
    if not server:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    
    for field, value in server_update.dict(exclude_unset=True).items():
        setattr(server, field, value)
    
    db.commit()
    db.refresh(server)
    return server


@router.delete("/{server_id}")
async def delete_prtg_server(
    server_id: str,
    token: str = Depends(get_bearer_token),
    db: Session = Depends(get_db),
):
    """Delete PRTG server"""
    payload = decode_token(token)
    if not payload or payload.get("role") != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)
    
    server = db.query(PrtgServer).filter(PrtgServer.id == server_id).first()
    if not server:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    
    db.delete(server)
    db.commit()
    return {"message": "Server deleted"}
