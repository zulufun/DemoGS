"""Pydantic schemas for request/response validation"""

from .auth import LoginRequest, TokenResponse, ChangePasswordRequest
from .user import ProfileBase, ProfileCreate, ProfileUpdate, Profile
from .prtg import PrtgServerBase, PrtgServerCreate, PrtgServerUpdate, PrtgServer
from .audit import AuditLogBase, AuditLogCreate, AuditLog
from .alert import AlertBase, AlertCreate, AlertUpdate, Alert
from .operation import OperationTaskBase, OperationTaskCreate, OperationTaskUpdate, OperationTask
from .gate import GateLogBase, GateLogCreate, GateLogUpdate, GateLog

__all__ = [
    # Auth
    "LoginRequest",
    "TokenResponse",
    "ChangePasswordRequest",
    # User
    "ProfileBase",
    "ProfileCreate",
    "ProfileUpdate",
    "Profile",
    # PRTG
    "PrtgServerBase",
    "PrtgServerCreate",
    "PrtgServerUpdate",
    "PrtgServer",
    # Audit
    "AuditLogBase",
    "AuditLogCreate",
    "AuditLog",
    # Alert
    "AlertBase",
    "AlertCreate",
    "AlertUpdate",
    "Alert",
    # Operation
    "OperationTaskBase",
    "OperationTaskCreate",
    "OperationTaskUpdate",
    "OperationTask",
    # Gate
    "GateLogBase",
    "GateLogCreate",
    "GateLogUpdate",
    "GateLog",
]
