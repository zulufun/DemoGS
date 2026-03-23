"""Alerts routes"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from database import get_db
from models import Profile, Alert
from schemas import Alert as AlertSchema, AlertCreate, AlertUpdate
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


def require_admin(current_user: Profile = Depends(get_current_user)) -> Profile:
    """Verify current user is admin"""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return current_user


@router.get("/", response_model=List[AlertSchema])
async def list_alerts(
    limit: int = 20,
    db: Session = Depends(get_db),
    current_user: Profile = Depends(get_current_user),
):
    """List alerts (authenticated users only)"""
    
    alerts = db.query(Alert).order_by(Alert.created_at.desc()).limit(limit).all()
    return alerts


@router.post("/", response_model=AlertSchema, status_code=status.HTTP_201_CREATED)
async def create_alert(
    alert_data: AlertCreate,
    db: Session = Depends(get_db),
    admin: Profile = Depends(require_admin),
):
    """Create alert (admin-only)"""
    
    new_alert = Alert(
        title=alert_data.title,
        severity=alert_data.severity,
        status=alert_data.status,
        score_impact=alert_data.score_impact,
        description=alert_data.description,
    )
    
    db.add(new_alert)
    db.commit()
    db.refresh(new_alert)
    
    return new_alert


@router.get("/{alert_id}", response_model=AlertSchema)
async def get_alert(
    alert_id: int,
    db: Session = Depends(get_db),
    current_user: Profile = Depends(get_current_user),
):
    """Get alert by ID (authenticated users only)"""
    
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Alert not found",
        )
    
    return alert


@router.put("/{alert_id}", response_model=AlertSchema)
async def update_alert(
    alert_id: int,
    update_data: AlertUpdate,
    db: Session = Depends(get_db),
    admin: Profile = Depends(require_admin),
):
    """Update alert (admin-only)"""
    
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Alert not found",
        )
    
    # Update fields if provided
    if update_data.title is not None:
        alert.title = update_data.title
    if update_data.severity is not None:
        alert.severity = update_data.severity
    if update_data.status is not None:
        alert.status = update_data.status
    if update_data.score_impact is not None:
        alert.score_impact = update_data.score_impact
    if update_data.description is not None:
        alert.description = update_data.description
    
    db.commit()
    db.refresh(alert)
    
    return alert


@router.delete("/{alert_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_alert(
    alert_id: int,
    db: Session = Depends(get_db),
    admin: Profile = Depends(require_admin),
):
    """Delete alert (admin-only)"""
    
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Alert not found",
        )
    
    db.delete(alert)
    db.commit()
