"""Audit log schemas"""

from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class AuditLogBase(BaseModel):
    """Audit log base schema"""
    source: str
    severity: str
    message: str
    payload: Optional[dict] = None


class AuditLogCreate(AuditLogBase):
    """Audit log creation schema"""
    pass


class AuditLog(AuditLogBase):
    """Audit log response schema"""
    id: int
    created_at: datetime
    
    class Config:
        from_attributes = True
