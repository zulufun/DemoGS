"""PRTG server management routes"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from database import get_db
from models import Profile, PrtgServer
from schemas import PrtgServer as PrtgServerSchema, PrtgServerCreate, PrtgServerUpdate
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


def require_admin(current_user: Profile = Depends(get_current_user)) -> Profile:
    """Verify current user is admin"""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return current_user


@router.get("/", response_model=List[PrtgServerSchema])
async def list_prtg_servers(
    db: Session = Depends(get_db),
    current_user: Profile = Depends(get_current_user),
):
    """List PRTG servers (admin-only)"""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    
    servers = db.query(PrtgServer).all()
    return servers


@router.post("/", response_model=PrtgServerSchema)
async def create_prtg_server(
    server_data: PrtgServerCreate,
    db: Session = Depends(get_db),
    admin: Profile = Depends(require_admin),
):
    """Create new PRTG server (admin-only)"""
    
    new_server = PrtgServer(
        name=server_data.name,
        base_url=server_data.base_url,
        api_token=server_data.api_token,
        username=server_data.username,
        passhash=server_data.passhash,
        is_active=server_data.is_active,
    )
    
    db.add(new_server)
    db.commit()
    db.refresh(new_server)
    
    return new_server


@router.get("/{server_id}", response_model=PrtgServerSchema)
async def get_prtg_server(
    server_id: str,
    db: Session = Depends(get_db),
    admin: Profile = Depends(require_admin),
):
    """Get PRTG server by ID (admin-only)"""
    
    server = db.query(PrtgServer).filter(PrtgServer.id == server_id).first()
    if not server:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="PRTG server not found",
        )
    
    return server


@router.put("/{server_id}", response_model=PrtgServerSchema)
async def update_prtg_server(
    server_id: str,
    update_data: PrtgServerUpdate,
    db: Session = Depends(get_db),
    admin: Profile = Depends(require_admin),
):
    """Update PRTG server (admin-only)"""
    
    server = db.query(PrtgServer).filter(PrtgServer.id == server_id).first()
    if not server:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="PRTG server not found",
        )
    
    # Update fields if provided
    if update_data.name is not None:
        server.name = update_data.name
    if update_data.base_url is not None:
        server.base_url = update_data.base_url
    if update_data.api_token is not None:
        server.api_token = update_data.api_token
    if update_data.username is not None:
        server.username = update_data.username
    if update_data.passhash is not None:
        server.passhash = update_data.passhash
    if update_data.is_active is not None:
        server.is_active = update_data.is_active
    
    db.commit()
    db.refresh(server)
    
    return server


@router.delete("/{server_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_prtg_server(
    server_id: str,
    db: Session = Depends(get_db),
    admin: Profile = Depends(require_admin),
):
    """Delete PRTG server (admin-only)"""
    
    server = db.query(PrtgServer).filter(PrtgServer.id == server_id).first()
    if not server:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="PRTG server not found",
        )
    
    db.delete(server)
    db.commit()
