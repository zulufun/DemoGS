"""Audit logs routes"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from database import get_db
from models import Profile, AuditLog
from schemas import AuditLog as AuditLogSchema, AuditLogCreate
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


@router.get("/", response_model=List[AuditLogSchema])
async def list_audit_logs(
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: Profile = Depends(get_current_user),
):
    """List audit logs (authenticated users only)"""
    
    logs = db.query(AuditLog).order_by(AuditLog.created_at.desc()).limit(limit).all()
    return logs


@router.post("/", response_model=AuditLogSchema, status_code=status.HTTP_201_CREATED)
async def create_audit_log(
    log_data: AuditLogCreate,
    db: Session = Depends(get_db),
    current_user: Profile = Depends(get_current_user),
):
    """Create audit log (admin-only for API, edge functions use service role)"""
    
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    
    new_log = AuditLog(
        source=log_data.source,
        severity=log_data.severity,
        message=log_data.message,
        payload=log_data.payload,
    )
    
    db.add(new_log)
    db.commit()
    db.refresh(new_log)
    
    return new_log
