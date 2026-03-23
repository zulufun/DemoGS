"""Gate access log schemas"""

from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class GateLogBase(BaseModel):
    """Gate log base schema"""
    contact_first_name: str
    contact_last_name: str
    unit: str
    ip_source: str
    ip_dest: str
    port: str
    usage_time: str
    basis: str
    work_content: str
    opened_by: str


class GateLogCreate(GateLogBase):
    """Gate log creation schema"""
    pass


class GateLogUpdate(BaseModel):
    """Gate log update schema"""
    contact_first_name: Optional[str] = None
    contact_last_name: Optional[str] = None
    unit: Optional[str] = None
    ip_source: Optional[str] = None
    ip_dest: Optional[str] = None
    port: Optional[str] = None
    usage_time: Optional[str] = None
    basis: Optional[str] = None
    work_content: Optional[str] = None
    opened_by: Optional[str] = None


class GateLog(GateLogBase):
    """Gate log response schema"""
    id: str
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
