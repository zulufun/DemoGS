"""Operation task model"""

from sqlalchemy import Column, String, Text, DateTime, Date, Time, UUID, func
import uuid
from app.core import Base


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
