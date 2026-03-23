"""Pydantic schemas for request/response validation"""

from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime, date, time
import uuid


# === Auth Schemas ===
class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    user_id: str
    username: str
    role: str


class ChangePasswordRequest(BaseModel):
    new_password: str


# === Profile Schemas ===
class ProfileBase(BaseModel):
    username: str
    email: EmailStr
    role: str


class ProfileCreate(BaseModel):
    username: str
    email: EmailStr
    password: str
    role: str = "user"


class ProfileUpdate(BaseModel):
    username: Optional[str] = None
    email: Optional[EmailStr] = None
    password: Optional[str] = None


class Profile(ProfileBase):
    id: str
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


# === PRTG Server Schemas ===
class PrtgServerBase(BaseModel):
    name: str
    base_url: str
    is_active: bool = True


class PrtgServerCreate(PrtgServerBase):
    api_token: Optional[str] = None
    username: Optional[str] = None
    passhash: Optional[str] = None


class PrtgServerUpdate(BaseModel):
    name: Optional[str] = None
    base_url: Optional[str] = None
    api_token: Optional[str] = None
    username: Optional[str] = None
    passhash: Optional[str] = None
    is_active: Optional[bool] = None


class PrtgServer(PrtgServerBase):
    id: str
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


# === Audit Log Schemas ===
class AuditLogBase(BaseModel):
    source: str
    severity: str
    message: str
    payload: Optional[dict] = None


class AuditLogCreate(AuditLogBase):
    pass


class AuditLog(AuditLogBase):
    id: int
    created_at: datetime
    
    class Config:
        from_attributes = True


# === Alert Schemas ===
class AlertBase(BaseModel):
    title: str
    severity: str
    status: str = "new"
    score_impact: int = 1
    description: Optional[str] = None


class AlertCreate(AlertBase):
    pass


class AlertUpdate(BaseModel):
    title: Optional[str] = None
    severity: Optional[str] = None
    status: Optional[str] = None
    score_impact: Optional[int] = None
    description: Optional[str] = None


class Alert(AlertBase):
    id: int
    created_at: datetime
    
    class Config:
        from_attributes = True


# === Operation Task Schemas ===
class OperationTaskBase(BaseModel):
    task_date: date
    executor: str
    lead_person: str
    supervisor: str
    unit: str
    work_content: str
    start_time: time


class OperationTaskCreate(OperationTaskBase):
    end_time: Optional[time] = None
    result_content: Optional[str] = None


class OperationTaskUpdate(BaseModel):
    task_date: Optional[date] = None
    executor: Optional[str] = None
    lead_person: Optional[str] = None
    supervisor: Optional[str] = None
    unit: Optional[str] = None
    work_content: Optional[str] = None
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    result_content: Optional[str] = None


class OperationTask(OperationTaskBase):
    id: str
    end_time: Optional[time]
    result_content: Optional[str]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


# === Gate Log Schemas ===
class GateLogBase(BaseModel):
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
    pass


class GateLogUpdate(BaseModel):
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
    id: str
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
