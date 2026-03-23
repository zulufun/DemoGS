"""Alert schemas"""

from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class AlertBase(BaseModel):
    """Alert base schema"""
    title: str
    severity: str
    status: str = "new"
    score_impact: int = 1
    description: Optional[str] = None


class AlertCreate(AlertBase):
    """Alert creation schema"""
    pass


class AlertUpdate(BaseModel):
    """Alert update schema"""
    title: Optional[str] = None
    severity: Optional[str] = None
    status: Optional[str] = None
    score_impact: Optional[int] = None
    description: Optional[str] = None


class Alert(AlertBase):
    """Alert response schema"""
    id: int
    created_at: datetime
    
    class Config:
        from_attributes = True
