"""API endpoints routers"""

from . import auth
from . import users
from . import audit
from . import prtg
from . import alerts
from . import operations
from . import gates
from . import ws_logs
from . import vertiv

__all__ = [
    "auth",
    "users",
    "audit",
    "prtg",
    "alerts",
    "operations",
    "gates",
    "ws_logs",
    "vertiv",
]
