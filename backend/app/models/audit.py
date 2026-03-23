"""Audit log model"""

from sqlalchemy import Column, String, Text, DateTime, Integer, JSON, func
from app.core import Base


class AuditLog(Base):
    """Raw logs from PRTG API and Elasticsearch"""
    __tablename__ = "audit_logs"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    source = Column(String, nullable=False, default="prtg")  # prtg, elastic, system
    severity = Column(String, nullable=False, default="info")  # info, warning, critical
    message = Column(Text, nullable=False)
    payload = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
