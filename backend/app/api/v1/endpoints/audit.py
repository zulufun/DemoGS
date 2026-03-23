"""Audit logs routes"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core import get_db, get_bearer_token, decode_token
from app.models import AuditLog
from app.schemas import AuditLog as AuditLogSchema, AuditLogCreate

router = APIRouter()


@router.get("", response_model=list[AuditLogSchema])
async def list_audit_logs(
    token: str = Depends(get_bearer_token),
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
):
    """List audit logs"""
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    
    logs = db.query(AuditLog).order_by(AuditLog.created_at.desc()).offset(skip).limit(limit).all()
    return logs


@router.post("", response_model=AuditLogSchema)
async def create_audit_log(
    log: AuditLogCreate,
    db: Session = Depends(get_db),
):
    """Create audit log"""
    new_log = AuditLog(**log.dict())
    db.add(new_log)
    db.commit()
    db.refresh(new_log)
    return new_log


@router.get("/{log_id}", response_model=AuditLogSchema)
async def get_audit_log(
    log_id: int,
    token: str = Depends(get_bearer_token),
    db: Session = Depends(get_db),
):
    """Get audit log by ID"""
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    
    log = db.query(AuditLog).filter(AuditLog.id == log_id).first()
    if not log:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    
    return log
