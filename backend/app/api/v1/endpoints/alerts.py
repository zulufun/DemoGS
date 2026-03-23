"""Alert routes"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core import get_db, get_bearer_token, decode_token
from app.models import Alert
from app.schemas import Alert as AlertSchema, AlertCreate, AlertUpdate

router = APIRouter()


@router.get("", response_model=list[AlertSchema])
async def list_alerts(
    token: str = Depends(get_bearer_token),
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
):
    """List alerts"""
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    
    alerts = db.query(Alert).order_by(Alert.created_at.desc()).offset(skip).limit(limit).all()
    return alerts


@router.post("", response_model=AlertSchema)
async def create_alert(
    alert: AlertCreate,
    db: Session = Depends(get_db),
):
    """Create alert"""
    new_alert = Alert(**alert.dict())
    db.add(new_alert)
    db.commit()
    db.refresh(new_alert)
    return new_alert


@router.get("/{alert_id}", response_model=AlertSchema)
async def get_alert(
    alert_id: int,
    token: str = Depends(get_bearer_token),
    db: Session = Depends(get_db),
):
    """Get alert by ID"""
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    
    return alert


@router.put("/{alert_id}", response_model=AlertSchema)
async def update_alert(
    alert_id: int,
    alert_update: AlertUpdate,
    token: str = Depends(get_bearer_token),
    db: Session = Depends(get_db),
):
    """Update alert"""
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    
    for field, value in alert_update.dict(exclude_unset=True).items():
        setattr(alert, field, value)
    
    db.commit()
    db.refresh(alert)
    return alert


@router.delete("/{alert_id}")
async def delete_alert(
    alert_id: int,
    token: str = Depends(get_bearer_token),
    db: Session = Depends(get_db),
):
    """Delete alert"""
    payload = decode_token(token)
    if not payload or payload.get("role") != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)
    
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    
    db.delete(alert)
    db.commit()
    return {"message": "Alert deleted"}
