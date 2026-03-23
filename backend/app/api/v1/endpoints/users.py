"""Users routes"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core import get_db, get_bearer_token, decode_token, hash_password
from app.models import Profile
from app.schemas import Profile as ProfileSchema, ProfileCreate, ProfileUpdate

router = APIRouter()


@router.get("/me", response_model=ProfileSchema)
async def get_current_user(
    token: str = Depends(get_bearer_token),
    db: Session = Depends(get_db),
):
    """Get current user profile"""
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    
    user_id = payload.get("sub")
    user = db.query(Profile).filter(Profile.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    
    return user


@router.get("", response_model=list[ProfileSchema])
async def list_users(
    token: str = Depends(get_bearer_token),
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
):
    """List all users"""
    payload = decode_token(token)
    if not payload or payload.get("role") != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)
    
    users = db.query(Profile).offset(skip).limit(limit).all()
    return users


@router.post("", response_model=ProfileSchema)
async def create_user(
    user: ProfileCreate,
    token: str = Depends(get_bearer_token),
    db: Session = Depends(get_db),
):
    """Create new user"""
    payload = decode_token(token)
    if not payload or payload.get("role") != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)
    
    # Check if user exists
    if db.query(Profile).filter(Profile.username == user.username).first():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Username already exists")
    
    if db.query(Profile).filter(Profile.email == user.email).first():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already exists")
    
    new_user = Profile(
        username=user.username,
        email=user.email,
        password_hash=hash_password(user.password),
        role=user.role,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user


@router.put("/{user_id}", response_model=ProfileSchema)
async def update_user(
    user_id: str,
    user_update: ProfileUpdate,
    token: str = Depends(get_bearer_token),
    db: Session = Depends(get_db),
):
    """Update user"""
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    
    # Only admins or self can update
    if payload.get("role") != "admin" and payload.get("sub") != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)
    
    user = db.query(Profile).filter(Profile.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    
    if user_update.username:
        user.username = user_update.username
    if user_update.email:
        user.email = user_update.email
    if user_update.password:
        user.password_hash = hash_password(user_update.password)
    
    db.commit()
    db.refresh(user)
    return user


@router.delete("/{user_id}")
async def delete_user(
    user_id: str,
    token: str = Depends(get_bearer_token),
    db: Session = Depends(get_db),
):
    """Delete user"""
    payload = decode_token(token)
    if not payload or payload.get("role") != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)
    
    user = db.query(Profile).filter(Profile.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    
    db.delete(user)
    db.commit()
    return {"message": "User deleted"}
