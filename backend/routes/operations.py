"""Operation tasks routes"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from database import get_db
from models import Profile, OperationTask
from schemas import OperationTask as OperationTaskSchema, OperationTaskCreate, OperationTaskUpdate
from security import decode_token, get_bearer_token

router = APIRouter()


def get_current_user(
    token: str = Depends(get_bearer_token),
    db: Session = Depends(get_db),
):
    """Extract and validate current user from JWT token"""
    payload = decode_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        )
    
    user_id = payload.get("sub")
    user = db.query(Profile).filter(Profile.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )
    
    return user


@router.get("/tasks", response_model=List[OperationTaskSchema])
async def list_operation_tasks(
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: Profile = Depends(get_current_user),
):
    """List operation tasks (authenticated users only)"""
    
    tasks = db.query(OperationTask).order_by(OperationTask.task_date.desc()).limit(limit).all()
    return tasks


@router.post("/tasks", response_model=OperationTaskSchema, status_code=status.HTTP_201_CREATED)
async def create_operation_task(
    task_data: OperationTaskCreate,
    db: Session = Depends(get_db),
    current_user: Profile = Depends(get_current_user),
):
    """Create operation task (authenticated users)"""
    
    new_task = OperationTask(
        task_date=task_data.task_date,
        executor=task_data.executor,
        lead_person=task_data.lead_person,
        supervisor=task_data.supervisor,
        unit=task_data.unit,
        work_content=task_data.work_content,
        start_time=task_data.start_time,
        end_time=task_data.end_time,
        result_content=task_data.result_content,
    )
    
    db.add(new_task)
    db.commit()
    db.refresh(new_task)
    
    return new_task


@router.get("/tasks/{task_id}", response_model=OperationTaskSchema)
async def get_operation_task(
    task_id: str,
    db: Session = Depends(get_db),
    current_user: Profile = Depends(get_current_user),
):
    """Get operation task by ID (authenticated users only)"""
    
    task = db.query(OperationTask).filter(OperationTask.id == task_id).first()
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Operation task not found",
        )
    
    return task


@router.put("/tasks/{task_id}", response_model=OperationTaskSchema)
async def update_operation_task(
    task_id: str,
    update_data: OperationTaskUpdate,
    db: Session = Depends(get_db),
    current_user: Profile = Depends(get_current_user),
):
    """Update operation task (authenticated users)"""
    
    task = db.query(OperationTask).filter(OperationTask.id == task_id).first()
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Operation task not found",
        )
    
    # Update fields if provided
    if update_data.task_date is not None:
        task.task_date = update_data.task_date
    if update_data.executor is not None:
        task.executor = update_data.executor
    if update_data.lead_person is not None:
        task.lead_person = update_data.lead_person
    if update_data.supervisor is not None:
        task.supervisor = update_data.supervisor
    if update_data.unit is not None:
        task.unit = update_data.unit
    if update_data.work_content is not None:
        task.work_content = update_data.work_content
    if update_data.start_time is not None:
        task.start_time = update_data.start_time
    if update_data.end_time is not None:
        task.end_time = update_data.end_time
    if update_data.result_content is not None:
        task.result_content = update_data.result_content
    
    db.commit()
    db.refresh(task)
    
    return task


@router.delete("/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_operation_task(
    task_id: str,
    db: Session = Depends(get_db),
    current_user: Profile = Depends(get_current_user),
):
    """Delete operation task (authenticated users)"""
    
    task = db.query(OperationTask).filter(OperationTask.id == task_id).first()
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Operation task not found",
        )
    
    db.delete(task)
    db.commit()
