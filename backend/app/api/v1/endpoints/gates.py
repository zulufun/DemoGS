"""Gate access log routes"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core import get_db, get_bearer_token, decode_token
from app.models import GateOpenLog
from app.schemas import GateLog as GateLogSchema, GateLogCreate, GateLogUpdate

router = APIRouter()


@router.get("", response_model=list[GateLogSchema])
async def list_gate_logs(
    token: str = Depends(get_bearer_token),
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
):
    """List gate access logs"""
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    
    logs = db.query(GateOpenLog).order_by(GateOpenLog.created_at.desc()).offset(skip).limit(limit).all()
    return logs


@router.post("", response_model=GateLogSchema)
async def create_gate_log(
    log: GateLogCreate,
    token: str = Depends(get_bearer_token),
    db: Session = Depends(get_db),
):
    """Create gate access log"""
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    
    new_log = GateOpenLog(**log.dict())
    db.add(new_log)
    db.commit()
    db.refresh(new_log)
    return new_log


@router.get("/{log_id}", response_model=GateLogSchema)
async def get_gate_log(
    log_id: str,
    token: str = Depends(get_bearer_token),
    db: Session = Depends(get_db),
):
    """Get gate log by ID"""
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    
    log = db.query(GateOpenLog).filter(GateOpenLog.id == log_id).first()
    if not log:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    
    return log


@router.put("/{log_id}", response_model=GateLogSchema)
async def update_gate_log(
    log_id: str,
    log_update: GateLogUpdate,
    token: str = Depends(get_bearer_token),
    db: Session = Depends(get_db),
):
    """Update gate log"""
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    
    log = db.query(GateOpenLog).filter(GateOpenLog.id == log_id).first()
    if not log:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    
    for field, value in log_update.dict(exclude_unset=True).items():
        setattr(log, field, value)
    
    db.commit()
    db.refresh(log)
    return log


@router.delete("/{log_id}")
async def delete_gate_log(
    log_id: str,
    token: str = Depends(get_bearer_token),
    db: Session = Depends(get_db),
):
    """Delete gate log"""
    payload = decode_token(token)
    if not payload or payload.get("role") != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)
    
    log = db.query(GateOpenLog).filter(GateOpenLog.id == log_id).first()
    if not log:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    
    db.delete(log)
    db.commit()
    return {"message": "Gate log deleted"}
