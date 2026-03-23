"""SQLAlchemy models for application data"""

from sqlalchemy import Column, String, Text, DateTime, Boolean, Integer, Date, Time, JSON, func, UUID
from sqlalchemy.sql import text
import uuid
from datetime import datetime

from database import Base


class Profile(Base):
    """User profiles with roles"""
    __tablename__ = "profiles"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    username = Column(String, unique=True, nullable=False, index=True)
    email = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)
    role = Column(String, nullable=False, default="user")  # admin, user
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class PrtgServer(Base):
    """PRTG connection settings"""
    __tablename__ = "prtg_servers"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    base_url = Column(String, nullable=False)
    api_token = Column(String, nullable=True)
    username = Column(String, nullable=True)
    passhash = Column(String, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class AuditLog(Base):
    """Raw logs from PRTG API and Elasticsearch"""
    __tablename__ = "audit_logs"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    source = Column(String, nullable=False, default="prtg")  # prtg, elastic, system
    severity = Column(String, nullable=False, default="info")  # info, warning, critical
    message = Column(Text, nullable=False)
    payload = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)


class Alert(Base):
    """Dashboard alerts (real-time)"""
    __tablename__ = "alerts"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    title = Column(String, nullable=False)
    severity = Column(String, nullable=False, default="info")  # info, warning, critical
    status = Column(String, nullable=False, default="new")  # new, ack, resolved
    score_impact = Column(Integer, nullable=False, default=1)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)


class OperationTask(Base):
    """Operation tasks tracking"""
    __tablename__ = "operation_tasks"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    task_date = Column(Date, nullable=False)
    executor = Column(String, nullable=False)
    lead_person = Column(String, nullable=False)
    supervisor = Column(String, nullable=False)
    unit = Column(String, nullable=False)
    work_content = Column(Text, nullable=False)
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=True)
    result_content = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class GateOpenLog(Base):
    """Gate access logs"""
    __tablename__ = "gate_open_logs"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    contact_first_name = Column(String, nullable=False)
    contact_last_name = Column(String, nullable=False)
    unit = Column(String, nullable=False)
    ip_source = Column(String, nullable=False)
    ip_dest = Column(String, nullable=False)
    port = Column(String, nullable=False)
    usage_time = Column(String, nullable=False)
    basis = Column(String, nullable=False)
    work_content = Column(Text, nullable=False)
    opened_by = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
