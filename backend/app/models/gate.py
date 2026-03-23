"""Gate access log model"""

from sqlalchemy import Column, String, Text, DateTime, UUID, func
import uuid
from app.core import Base


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
