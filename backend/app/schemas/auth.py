"""Authentication related schemas"""

from pydantic import BaseModel


class LoginRequest(BaseModel):
    """Login request"""
    username: str
    password: str


class TokenResponse(BaseModel):
    """Token response"""
    access_token: str
    token_type: str
    user_id: str
    username: str
    role: str


class ChangePasswordRequest(BaseModel):
    """Change password request"""
    new_password: str
