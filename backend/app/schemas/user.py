"""User profile schemas"""

from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime


class ProfileBase(BaseModel):
    """Profile base schema"""
    username: str
    email: EmailStr
    role: str


class ProfileCreate(BaseModel):
    """Profile creation schema"""
    username: str
    email: EmailStr
    password: str
    role: str = "user"


class ProfileUpdate(BaseModel):
    """Profile update schema"""
    username: Optional[str] = None
    email: Optional[EmailStr] = None
    password: Optional[str] = None


class Profile(ProfileBase):
    """Profile response schema"""
    id: str
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
