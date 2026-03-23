# Backend Developer Quick Reference

## 🚀 Quick Start

```bash
# Navigate to backend
cd backend/

# Install dependencies
pip install -r requirements.txt

# Set up environment
cp .env.example .env

# Run backend (with auto-reload)
uvicorn app.main:app --reload

# Or from Docker
docker compose up -d
```

## 📍 Các Thành Phần Chính

### core/ - Cốt Lõi
```python
from app.core import settings        # Biến môi trường
from app.core import get_db          # Database session dependency
from app.core import hash_password   # Mã hóa mật khẩu
from app.core import create_access_token  # Tạo JWT token
```

### models/ - Database Models
```python
from app.models import Profile, Alert, PrtgServer
```

### schemas/ - API Validation
```python
from app.schemas import LoginRequest, ProfileSchema
```

### services/ - Business Logic
```python
from app.services import redis_service, kafka_service, get_es_service
```

### api/ - REST Endpoints
- `/api/v1/auth` - Authentication
- `/api/v1/users` - User management
- `/api/v1/audit` - Audit logs
- `/api/v1/prtg` - PRTG servers
- `/api/v1/alerts` - Alerts
- `/api/v1/operations` - Operations
- `/api/v1/gates` - Gate logs
- `/ws/logs` - WebSocket logs

## 🛠️ Phát Triển Tính Năng Mới

### Template: Add New Entity (e.g., Reports)

**1. Model** (`app/models/report.py`)
```python
from app.core import Base
from sqlalchemy import Column, String, DateTime, func, UUID
import uuid

class Report(Base):
    __tablename__ = "reports"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
```

**2. Update** `app/models/__init__.py`
```python
from .report import Report
__all__ = [..., "Report"]
```

**3. Schema** (`app/schemas/report.py`)
```python
from pydantic import BaseModel
from datetime import datetime

class ReportBase(BaseModel):
    title: str

class ReportCreate(ReportBase):
    pass

class Report(ReportBase):
    id: str
    created_at: datetime
    
    class Config:
        from_attributes = True
```

**4. Update** `app/schemas/__init__.py`
```python
from .report import Report, ReportCreate
__all__ = [..., "Report", "ReportCreate"]
```

**5. Endpoint** (`app/api/v1/endpoints/reports.py`)
```python
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core import get_db, decode_token, get_bearer_token
from app.models import Report
from app.schemas import Report as ReportSchema, ReportCreate

router = APIRouter()

@router.get("", response_model=list[ReportSchema])
async def list_reports(
    token: str = Depends(get_bearer_token),
    db: Session = Depends(get_db),
):
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    
    return db.query(Report).all()

@router.post("", response_model=ReportSchema)
async def create_report(
    report: ReportCreate,
    token: str = Depends(get_bearer_token),
    db: Session = Depends(get_db),
):
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    
    new_report = Report(**report.dict())
    db.add(new_report)
    db.commit()
    db.refresh(new_report)
    return new_report
```

**6. Update** `app/api/v1/endpoints/__init__.py`
```python
from . import reports
```

**7. Update** `app/api/v1/api.py`
```python
from .endpoints import reports
router.include_router(reports.router, prefix="/reports", tags=["reports"])
```

## 🔄 Common Patterns

### Dependency Injection
```python
async def my_endpoint(token = Depends(get_bearer_token), db = Depends(get_db)):
    # token and db are automatically injected
    pass
```

### Error Handling
```python
from fastapi import HTTPException, status

@router.get("/{id}")
async def get_item(id: str, db = Depends(get_db)):
    item = db.query(Item).filter(Item.id == id).first()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    return item
```

### Authentication Check
```python
from app.core import decode_token, get_bearer_token

@router.post("")
async def create_item(token: str = Depends(get_bearer_token), db = Depends(get_db)):
    payload = decode_token(token)
    if not payload or payload.get("role") != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)
    # Continue...
```

### Redis Caching
```python
from app.services import redis_service

@router.get("/cached-data")
async def get_cached_data():
    cached = await redis_service.get_cache("my_key")
    if cached:
        return cached
    
    # Fetch from DB/API
    data = compute_data()
    
    # Cache for 1 hour
    await redis_service.set_cache("my_key", data, ttl=3600)
    return data
```

### Kafka Publishing
```python
from app.services import kafka_service

async def log_event(event: dict):
    await kafka_service.publish_log({
        "type": "event",
        "data": event,
        "timestamp": datetime.utcnow().isoformat()
    })
```

## 📊 Status Codes Reference

| Code | Meaning | Use When |
|------|---------|----------|
| 200 | OK | Request succeeded |
| 201 | Created | Resource created |
| 400 | Bad Request | Invalid input |
| 401 | Unauthorized | No/invalid token |
| 403 | Forbidden | No permission |
| 404 | Not Found | Resource doesn't exist |
| 500 | Server Error | Unexpected error |

## 🐛 Debugging

```bash
# Check logs
docker logs demo-backend-dev

# Restart container
docker compose restart demo-backend-dev

# Rebuild
docker compose down
docker compose up -d --build

# Test endpoint
# Use Postman or curl
curl -X GET http://localhost:8000/api/v1/auth/validate-token \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 📝 Code Style

```python
# ✅ Good
from app.core import settings, Base
from app.models import Profile
from app.schemas import ProfileSchema

# ❌ Avoid
import settings
import Profile
import ProfileSchema

# ✅ Good - Clear function purpose
async def get_user_by_id(user_id: str, db: Session) -> Profile:
    user = db.query(Profile).filter(Profile.id == user_id).first()
    if not user:
        raise HTTPException(404)
    return user

# ❌ Avoid - Unclear
async def get_data(id, database):
    data = database.query(Profile).filter(...).first()
    return data
```

## 🗂️ File Organization Rules

1. **One responsibility per file**
   - models/user.py has ONLY user model
   - endpoints/users.py has ONLY user endpoints

2. **Clear naming**
   - user.py (singular)
   - users.py (but route prefix is /users - plural)
   - UserModel or UserSchema (CamelCase for classes)

3. **Proper exports**
   - Each __init__.py exports what it contains
   - Import from __init__, not direct files

4. **Minimal imports**
   - Import only what you need
   - Use type hints for clarity

## 🚨 Common Issues

| Issue | Solution |
|-------|----------|
| ModuleNotFoundError: No module named 'models' | Use `from app.models import ...` |
| Database not found | Check DATABASE_URL in .env |
| Port 8000 already in use | Kill process or use different port |
| CORS errors | Check CORS_ORIGINS in .env |
| Token errors | Make sure token is valid and not expired |

## 📚 Resources

- `backend/STRUCTURE.md` - Detailed structure documentation
- `backend/RESTRUCTURE_GUIDE.md` - Vietnamese restructure guide
- FastAPI docs: http://localhost:8000/docs
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

---

Happy coding! 🎉
