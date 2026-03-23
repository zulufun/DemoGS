"""PRTG server routes"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core import get_db, get_bearer_token, decode_token
from app.models import PrtgServer
from app.schemas import PrtgServer as PrtgServerSchema, PrtgServerCreate, PrtgServerUpdate

router = APIRouter()


@router.get("", response_model=list[PrtgServerSchema])
async def list_prtg_servers(
    token: str = Depends(get_bearer_token),
    db: Session = Depends(get_db),
):
    """List PRTG servers"""
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    
    servers = db.query(PrtgServer).all()
    return servers


@router.post("", response_model=PrtgServerSchema)
async def create_prtg_server(
    server: PrtgServerCreate,
    token: str = Depends(get_bearer_token),
    db: Session = Depends(get_db),
):
    """Create PRTG server"""
    payload = decode_token(token)
    if not payload or payload.get("role") != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)
    
    new_server = PrtgServer(**server.dict())
    db.add(new_server)
    db.commit()
    db.refresh(new_server)
    return new_server


@router.get("/{server_id}", response_model=PrtgServerSchema)
async def get_prtg_server(
    server_id: str,
    token: str = Depends(get_bearer_token),
    db: Session = Depends(get_db),
):
    """Get PRTG server by ID"""
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    
    server = db.query(PrtgServer).filter(PrtgServer.id == server_id).first()
    if not server:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    
    return server


@router.put("/{server_id}", response_model=PrtgServerSchema)
async def update_prtg_server(
    server_id: str,
    server_update: PrtgServerUpdate,
    token: str = Depends(get_bearer_token),
    db: Session = Depends(get_db),
):
    """Update PRTG server"""
    payload = decode_token(token)
    if not payload or payload.get("role") != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)
    
    server = db.query(PrtgServer).filter(PrtgServer.id == server_id).first()
    if not server:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    
    for field, value in server_update.dict(exclude_unset=True).items():
        setattr(server, field, value)
    
    db.commit()
    db.refresh(server)
    return server


@router.delete("/{server_id}")
async def delete_prtg_server(
    server_id: str,
    token: str = Depends(get_bearer_token),
    db: Session = Depends(get_db),
):
    """Delete PRTG server"""
    payload = decode_token(token)
    if not payload or payload.get("role") != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)
    
    server = db.query(PrtgServer).filter(PrtgServer.id == server_id).first()
    if not server:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    
    db.delete(server)
    db.commit()
    return {"message": "Server deleted"}
