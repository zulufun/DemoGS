"""User management routes (admin-only)"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from database import get_db
from models import Profile
from schemas import Profile as ProfileSchema, ProfileCreate, ProfileUpdate
from security import hash_password, decode_token, get_bearer_token

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


def require_admin(current_user: Profile = Depends(get_current_user)) -> Profile:
    """Verify current user is admin"""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return current_user


@router.get("/", response_model=List[ProfileSchema])
async def list_users(
    db: Session = Depends(get_db),
    admin: Profile = Depends(require_admin),
):
    """List all users (admin-only)"""
    users = db.query(Profile).all()
    return users


@router.post("/", response_model=ProfileSchema)
async def create_user(
    user_data: ProfileCreate,
    db: Session = Depends(get_db),
    admin: Profile = Depends(require_admin),
):
    """Create new user (admin-only)"""
    
    # Check if username already exists
    existing = db.query(Profile).filter(Profile.username == user_data.username).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already exists",
        )
    
    # Check if email already exists
    existing_email = db.query(Profile).filter(Profile.email == user_data.email).first()
    if existing_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already exists",
        )
    
    # Create new user
    new_user = Profile(
        username=user_data.username,
        email=user_data.email,
        password_hash=hash_password(user_data.password),
        role=user_data.role,
    )
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    return new_user


@router.get("/{user_id}", response_model=ProfileSchema)
async def get_user(
    user_id: str,
    db: Session = Depends(get_db),
    admin: Profile = Depends(require_admin),
):
    """Get user by ID (admin-only, or own profile)"""
    
    # Allow users to view their own profile, admins can view any
    current_user = db.query(Profile).filter(Profile.id == user_id).first()
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    
    return current_user


@router.put("/{user_id}", response_model=ProfileSchema)
async def update_user(
    user_id: str,
    update_data: ProfileUpdate,
    db: Session = Depends(get_db),
    admin: Profile = Depends(require_admin),
):
    """Update user (admin-only)"""
    
    user = db.query(Profile).filter(Profile.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    
    # Update fields
    if update_data.username:
        # Check if new username is unique
        existing = db.query(Profile).filter(
            Profile.username == update_data.username,
            Profile.id != user_id
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username already exists",
            )
        user.username = update_data.username
    
    if update_data.email:
        # Check if new email is unique
        existing_email = db.query(Profile).filter(
            Profile.email == update_data.email,
            Profile.id != user_id
        ).first()
        if existing_email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already exists",
            )
        user.email = update_data.email
    
    if update_data.password:
        user.password_hash = hash_password(update_data.password)
    
    db.commit()
    db.refresh(user)
    
    return user


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: str,
    db: Session = Depends(get_db),
    admin: Profile = Depends(require_admin),
):
    """Delete user (admin-only)"""
    
    user = db.query(Profile).filter(Profile.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    
    # Prevent deleting the last admin
    admin_count = db.query(Profile).filter(Profile.role == "admin").count()
    if user.role == "admin" and admin_count == 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete the last admin user",
        )
    
    db.delete(user)
    db.commit()
