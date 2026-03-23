"""Authentication routes"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database import get_db
from models import Profile
from schemas import ChangePasswordRequest, LoginRequest, TokenResponse
from security import (
    create_access_token,
    decode_token,
    get_bearer_token,
    hash_password,
    verify_password,
)

router = APIRouter()


@router.post("/login", response_model=TokenResponse)
async def login(credentials: LoginRequest, db: Session = Depends(get_db)):
    """Login with username and password"""
    
    # Find user by username
    user = db.query(Profile).filter(Profile.username == credentials.username).first()
    
    if not user or not verify_password(credentials.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )
    
    # Create JWT token
    access_token = create_access_token(
        data={"sub": str(user.id), "username": user.username, "role": user.role}
    )
    
    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user_id=str(user.id),
        username=user.username,
        role=user.role,
    )


@router.post("/validate-token")
async def validate_token(
    token: str = Depends(get_bearer_token),
    db: Session = Depends(get_db),
):
    """Validate JWT token and return user info"""
    payload = decode_token(token)
    
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        )
    
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        )
    
    user = db.query(Profile).filter(Profile.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    
    return {
        "user_id": str(user.id),
        "username": user.username,
        "email": user.email,
        "role": user.role,
    }


@router.post("/change-password")
async def change_password(
    payload: ChangePasswordRequest,
    token: str = Depends(get_bearer_token),
    db: Session = Depends(get_db),
):
    """Change password for authenticated user."""
    decoded = decode_token(token)
    if not decoded or not decoded.get("sub"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        )

    if len(payload.new_password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 8 characters",
        )

    user = db.query(Profile).filter(Profile.id == decoded["sub"]).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    user.password_hash = hash_password(payload.new_password)
    db.commit()

    return {"message": "Password updated successfully"}
