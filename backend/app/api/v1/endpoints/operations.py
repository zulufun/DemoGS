"""Operation task routes"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core import get_db, get_bearer_token, decode_token
from app.models import OperationTask
from app.schemas import OperationTask as OperationTaskSchema, OperationTaskCreate, OperationTaskUpdate

router = APIRouter()


@router.get("", response_model=list[OperationTaskSchema])
async def list_operations(
    token: str = Depends(get_bearer_token),
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
):
    """List operation tasks"""
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    
    tasks = db.query(OperationTask).order_by(OperationTask.created_at.desc()).offset(skip).limit(limit).all()
    return tasks


@router.post("", response_model=OperationTaskSchema)
async def create_operation(
    task: OperationTaskCreate,
    token: str = Depends(get_bearer_token),
    db: Session = Depends(get_db),
):
    """Create operation task"""
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    
    new_task = OperationTask(**task.dict())
    db.add(new_task)
    db.commit()
    db.refresh(new_task)
    return new_task


@router.get("/{task_id}", response_model=OperationTaskSchema)
async def get_operation(
    task_id: str,
    token: str = Depends(get_bearer_token),
    db: Session = Depends(get_db),
):
    """Get operation task by ID"""
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    
    task = db.query(OperationTask).filter(OperationTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    
    return task


@router.put("/{task_id}", response_model=OperationTaskSchema)
async def update_operation(
    task_id: str,
    task_update: OperationTaskUpdate,
    token: str = Depends(get_bearer_token),
    db: Session = Depends(get_db),
):
    """Update operation task"""
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    
    task = db.query(OperationTask).filter(OperationTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    
    for field, value in task_update.dict(exclude_unset=True).items():
        setattr(task, field, value)
    
    db.commit()
    db.refresh(task)
    return task


@router.delete("/{task_id}")
async def delete_operation(
    task_id: str,
    token: str = Depends(get_bearer_token),
    db: Session = Depends(get_db),
):
    """Delete operation task"""
    payload = decode_token(token)
    if not payload or payload.get("role") != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)
    
    task = db.query(OperationTask).filter(OperationTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    
    db.delete(task)
    db.commit()
    return {"message": "Operation deleted"}
