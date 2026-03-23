"""PRTG server configuration model"""

from sqlalchemy import Column, String, DateTime, Boolean, UUID, func
import uuid
from app.core import Base


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
