"""Gate access logs routes"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from database import get_db
from models import Profile, GateOpenLog
from schemas import GateLog as GateLogSchema, GateLogCreate, GateLogUpdate
from security import decode_token, get_bearer_token

router = APIRouter()


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


@router.get("/", response_model=List[GateLogSchema])
async def list_gate_logs(
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: Profile = Depends(get_current_user),
):
    """List gate access logs (authenticated users only)"""
    
    logs = db.query(GateOpenLog).order_by(GateOpenLog.created_at.desc()).limit(limit).all()
    return logs


@router.post("/", response_model=GateLogSchema, status_code=status.HTTP_201_CREATED)
async def create_gate_log(
    log_data: GateLogCreate,
    db: Session = Depends(get_db),
    current_user: Profile = Depends(get_current_user),
):
    """Create gate access log (authenticated users)"""
    
    new_log = GateOpenLog(
        contact_first_name=log_data.contact_first_name,
        contact_last_name=log_data.contact_last_name,
        unit=log_data.unit,
        ip_source=log_data.ip_source,
        ip_dest=log_data.ip_dest,
        port=log_data.port,
        usage_time=log_data.usage_time,
        basis=log_data.basis,
        work_content=log_data.work_content,
        opened_by=log_data.opened_by,
    )
    
    db.add(new_log)
    db.commit()
    db.refresh(new_log)
    
    return new_log


@router.get("/{log_id}", response_model=GateLogSchema)
async def get_gate_log(
    log_id: str,
    db: Session = Depends(get_db),
    current_user: Profile = Depends(get_current_user),
):
    """Get gate access log by ID (authenticated users only)"""
    
    log = db.query(GateOpenLog).filter(GateOpenLog.id == log_id).first()
    if not log:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Gate log not found",
        )
    
    return log


@router.put("/{log_id}", response_model=GateLogSchema)
async def update_gate_log(
    log_id: str,
    update_data: GateLogUpdate,
    db: Session = Depends(get_db),
    current_user: Profile = Depends(get_current_user),
):
    """Update gate access log (authenticated users)"""
    
    log = db.query(GateOpenLog).filter(GateOpenLog.id == log_id).first()
    if not log:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Gate log not found",
        )
    
    # Update fields if provided
    if update_data.contact_first_name is not None:
        log.contact_first_name = update_data.contact_first_name
    if update_data.contact_last_name is not None:
        log.contact_last_name = update_data.contact_last_name
    if update_data.unit is not None:
        log.unit = update_data.unit
    if update_data.ip_source is not None:
        log.ip_source = update_data.ip_source
    if update_data.ip_dest is not None:
        log.ip_dest = update_data.ip_dest
    if update_data.port is not None:
        log.port = update_data.port
    if update_data.usage_time is not None:
        log.usage_time = update_data.usage_time
    if update_data.basis is not None:
        log.basis = update_data.basis
    if update_data.work_content is not None:
        log.work_content = update_data.work_content
    if update_data.opened_by is not None:
        log.opened_by = update_data.opened_by
    
    db.commit()
    db.refresh(log)
    
    return log


@router.delete("/{log_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_gate_log(
    log_id: str,
    db: Session = Depends(get_db),
    current_user: Profile = Depends(get_current_user),
):
    """Delete gate access log (authenticated users)"""
    
    log = db.query(GateOpenLog).filter(GateOpenLog.id == log_id).first()
    if not log:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Gate log not found",
        )
    
    db.delete(log)
    db.commit()
