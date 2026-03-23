"""Operation task schemas"""

from pydantic import BaseModel
from typing import Optional
from datetime import datetime, date, time


class OperationTaskBase(BaseModel):
    """Operation task base schema"""
    task_date: date
    executor: str
    lead_person: str
    supervisor: str
    unit: str
    work_content: str
    start_time: time


class OperationTaskCreate(OperationTaskBase):
    """Operation task creation schema"""
    end_time: Optional[time] = None
    result_content: Optional[str] = None


class OperationTaskUpdate(BaseModel):
    """Operation task update schema"""
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
    """Operation task response schema"""
    id: str
    end_time: Optional[time]
    result_content: Optional[str]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
