"""PRTG server schemas"""

from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class PrtgServerBase(BaseModel):
    """PRTG server base schema"""
    name: str
    base_url: str
    is_active: bool = True


class PrtgServerCreate(PrtgServerBase):
    """PRTG server creation schema"""
    api_token: Optional[str] = None
    username: Optional[str] = None
    passhash: Optional[str] = None


class PrtgServerUpdate(BaseModel):
    """PRTG server update schema"""
    name: Optional[str] = None
    base_url: Optional[str] = None
    api_token: Optional[str] = None
    username: Optional[str] = None
    passhash: Optional[str] = None
    is_active: Optional[bool] = None


class PrtgServer(PrtgServerBase):
    """PRTG server response schema"""
    id: str
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
