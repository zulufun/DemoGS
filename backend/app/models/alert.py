"""Alert model"""

from sqlalchemy import Column, String, Text, DateTime, Integer, func
from app.core import Base


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
