# Backend Restructuring Guide

Cấu trúc backend đã được tái cấu trúc từ một cấu trúc phẳng sang một kiến trúc modular, scalable, phù hợp với dự án backend chuyên nghiệp.

## 📁 Cấu Trúc Mới

```
app/
├── core/                    ← Cốt lõi: config, security, database
├── models/                  ← SQLAlchemy ORM models
├── schemas/                 ← Pydantic validation schemas
├── services/                ← Business logic, integrations
├── api/
│   └── v1/
│       ├── endpoints/       ← Endpoint handlers
│       └── api.py          ← Combines all routes
├── utils/                   ← Helper functions
└── main.py                  ← FastAPI application
```

## 🎯 Lợi Ích

| Khía cạnh | Cũ | Mới |
|-----------|-----|------|
| **File chính** | main.py, models.py, schemas.py (rất lớn) | Tách nhỏ, dễ tìm |
| **Imports** | Phức tạp, dễ conflict | Rõ ràng: `from app.core import ...` |
| **Thêm tính năng** | Sửa nhiều files | Chỉ tạo file mới |
| **Testing** | Khó mock, tightly coupled | Dễ test từng layer |
| **API versions** | Không hỗ trợ | Hỗ trợ v1/, v2/, v3/ |
| **Maintenance** | Khó quản lý | Dễ quản lý |

## 📚 Hướng Dẫn Chi Tiết

### 1. **app/core/** - Cấu Hình Ứng Dụng
Chứa mọi thứ cần thiết để khởi động ứng dụng:
```python
from app.core import settings      # Biến môi trường
from app.core import get_db        # Database dependency
from app.core import hash_password # Mã hóa mật khẩu
```

**Files:**
- `config.py` - Đọc từ .env file
- `database.py` - SQLAlchemy setup
- `security.py` - JWT, password hashing
- `constants.py` - App constants

### 2. **app/models/** - Data Models
Một model cho một file → dễ đọc
```python
# app/models/user.py
from app.core import Base

class Profile(Base):
    __tablename__ = "profiles"
    # ...

# app/models/__init__.py
from .user import Profile
from .prtg import PrtgServer
# ...
```

### 3. **app/schemas/** - Validation Rules
Pydantic schemas tách riêng theo entity:
```python
# app/schemas/user.py
class ProfileCreate(BaseModel):
    username: str
    password: str

class Profile(ProfileBase):
    id: str
    created_at: datetime
```

### 4. **app/services/** - Business Logic
Xử lý logic phức tạp, tích hợp bên ngoài:
```python
# app/services/redis_service.py
async def set_cache(key: str, value: Any):
    client = get_redis()
    client.setex(key, ttl, value)

# app/services/kafka_service.py
async def publish_log(log_entry: dict):
    producer = get_producer()
    producer.send(topic, value=log_entry)
```

### 5. **app/api/v1/endpoints/** - Route Handlers
Một endpoint cho một file:
```python
# app/api/v1/endpoints/users.py
from fastapi import APIRouter
from app.core import get_db
from app.models import Profile
from app.schemas import Profile as ProfileSchema

router = APIRouter()

@router.get("/me", response_model=ProfileSchema)
async def get_current_user(token: str = Depends(get_bearer_token)):
    # Handler logic
    pass

# app/api/v1/api.py
from .endpoints import auth, users, prtg, audit

router = APIRouter(prefix="/api/v1")
router.include_router(auth.router, prefix="/auth")
router.include_router(users.router, prefix="/users")
```

## 🚀 Cách Thêm Tính Năng Mới

### Ví dụ: Thêm Employee Management

**Bước 1: Tạo Model**
```python
# app/models/employee.py
from app.core import Base

class Employee(Base):
    __tablename__ = "employees"
    id = Column(UUID, primary_key=True)
    name = Column(String)
    department = Column(String)
```

**Bước 2: Cập nhật models/__init__.py**
```python
from .employee import Employee

__all__ = [..., "Employee"]
```

**Bước 3: Tạo Schemas**
```python
# app/schemas/employee.py
class EmployeeCreate(BaseModel):
    name: str
    department: str

class Employee(EmployeeCreate):
    id: str
    created_at: datetime
```

**Bước 4: Cập nhật schemas/__init__.py**
```python
from .employee import Employee, EmployeeCreate

__all__ = [..., "Employee", "EmployeeCreate"]
```

**Bước 5: Tạo Endpoints**
```python
# app/api/v1/endpoints/employees.py
from fastapi import APIRouter
from app.core import get_db
from app.models import Employee
from app.schemas import Employee as EmployeeSchema, EmployeeCreate

router = APIRouter()

@router.get("", response_model=list[EmployeeSchema])
async def list_employees(db = Depends(get_db)):
    return db.query(Employee).all()

@router.post("", response_model=EmployeeSchema)
async def create_employee(emp: EmployeeCreate, db = Depends(get_db)):
    new_emp = Employee(**emp.dict())
    db.add(new_emp)
    db.commit()
    return new_emp
```

**Bước 6: Include Router**
```python
# app/api/v1/api.py
from .endpoints import employees  # Add this

router.include_router(employees.router, prefix="/employees")
```

## 📦 Import Patterns

```python
# From core
from app.core import settings, get_db, hash_password

# From models
from app.models import Profile, Alert, PrtgServer

# From schemas
from app.schemas import LoginRequest, ProfileSchema

# From services
from app.services import redis_service, kafka_service

# From endpoints
from app.api.v1.endpoints import auth, users
```

## 🧪 Testing Ngắn Gọn

```python
# tests/test_auth.py
from app.core import get_db
from app.models import Profile
from app.schemas import LoginRequest

def test_login():
    # Mock dependencies
    with TestClient(app) as client:
        response = client.post("/api/v1/auth/login", 
            json={"username": "admin", "password": "admin"})
        assert response.status_code == 200
```

## ✅ Kiểm Tra

- ✅ Backend container chạy thành công
- ✅ Frontend accessible tại http://localhost:5173
- ✅ Backend API tại http://localhost:8000/health
- ✅ Tất cả imports hoạt động đúng

## 📖 Tài Liệu Thêm

- `backend/STRUCTURE.md` - Chi tiết đầy đủ cấu trúc
- Mỗi file có docstring giải thích mục đích
- __init__.py files có __all__ exports

## 🎓 Kiến Thức

Cấu trúc này tuân theo các best practices:
- **MVC Pattern**: Models, Services (Business Logic), Views (Endpoints)
- **Dependency Injection**: Các dependencies passed vào, không hardcoded
- **Modular Design**: Mỗi module độc lập, có thể test riêng
- **Scalable**: Dễ thêm v2/, v3/ API versions
