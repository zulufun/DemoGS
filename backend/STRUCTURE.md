```
backend/
├── app/                           # Main application package
│   ├── __init__.py               # Package initialization
│   ├── main.py                   # FastAPI app factory and entry point
│   │
│   ├── core/                     # Core configurations and utilities
│   │   ├── __init__.py           # Exports all core modules
│   │   ├── config.py             # Pydantic settings (environment variables)
│   │   ├── security.py           # JWT, password hashing utilities
│   │   ├── constants.py          # Application constants
│   │   └── database.py           # Database engine, session, dependencies
│   │
│   ├── models/                   # SQLAlchemy ORM models (one file per model)
│   │   ├── __init__.py           # Model imports
│   │   ├── base.py              # Base model class (if needed)
│   │   ├── user.py              # Profile model
│   │   ├── prtg.py              # PrtgServer model
│   │   ├── audit.py             # AuditLog model
│   │   ├── alert.py             # Alert model
│   │   ├── operation.py         # OperationTask model
│   │   └── gate.py              # GateOpenLog model
│   │
│   ├── schemas/                  # Pydantic request/response schemas (one file per entity)
│   │   ├── __init__.py           # Schema imports and exports
│   │   ├── auth.py              # Login, token, password schemas
│   │   ├── user.py              # User profile schemas
│   │   ├── prtg.py              # PRTG server schemas
│   │   ├── audit.py             # Audit log schemas
│   │   ├── alert.py             # Alert schemas
│   │   ├── operation.py         # Operation task schemas
│   │   └── gate.py              # Gate log schemas
│   │
│   ├── services/                 # Business logic services
│   │   ├── __init__.py           # Service exports
│   │   ├── redis_service.py     # Redis cache operations
│   │   ├── kafka_service.py     # Kafka producer/consumer
│   │   └── elasticsearch_service.py  # Elasticsearch sync
│   │
│   ├── api/                      # API routers organized by version
│   │   ├── __init__.py
│   │   └── v1/                   # API v1
│   │       ├── __init__.py
│   │       ├── api.py           # Combines all v1 endpoints
│   │       └── endpoints/       # Endpoint handlers (one file per resource)
│   │           ├── __init__.py  # Endpoint imports
│   │           ├── auth.py      # Login, token validation
│   │           ├── users.py     # User CRUD operations
│   │           ├── audit.py     # Audit logs endpoints
│   │           ├── prtg.py      # PRTG server endpoints
│   │           ├── alerts.py    # Alert endpoints
│   │           ├── operations.py # Operations endpoints
│   │           ├── gates.py     # Gate logs endpoints
│   │           └── ws_logs.py   # WebSocket real-time logs
│   │
│   └── utils/                    # Utility functions and helpers
│       └── __init__.py           # Utility exports
│
├── tests/                        # Test suite
│   └── __init__.py
│
├── .env                          # Environment variables
├── .env.example                  # Environment template
├── .dockerignore                 # Docker ignore patterns
├── bootstrap_admin.py            # Admin user initialization script
├── requirements.txt              # Python dependencies
├── Dockerfile.dev                # Development Docker configuration
├── main.py                       # Legacy entry point (points to app.main)
└── README.md                     # Backend documentation
```

## Directory Structure Explanation

### Core Module (`app/core/`)
Contains cross-cutting concerns and infrastructure:
- **config.py**: Pydantic BaseSettings for environment variables
- **security.py**: JWT creation/validation, password hashing
- **database.py**: SQLAlchemy engine, session factory, get_db dependency
- **constants.py**: Application-wide constants (roles, severity levels, etc.)

### Models (`app/models/`)
SQLAlchemy ORM models organized by entity:
- One model per file for clarity and maintainability
- Central `__init__.py` exports all models
- Models inherit from `Base` defined in core/database.py

### Schemas (`app/schemas/`)
Pydantic request/response validation schemas:
- One schema file per entity domain
- Each file contains: Base, Create, Update, Response schemas
- Clear separation between API input/output contracts

### Services (`app/services/`)
Business logic and external service integration:
- **redis_service.py**: Caching, rate limiting
- **kafka_service.py**: Message queuing, event streaming
- **elasticsearch_service.py**: Log sync operations
- Services are dependency-injected or used in routes

### API Routes (`app/api/`)
RESTful endpoint handlers organized by version:
- **v1/endpoints/**: Handler functions for each resource
- **v1/api.py**: Combines all endpoints with routing
- Each endpoint file imports schemas, models, and services
- Returns proper HTTP status codes and error handling

## Design Benefits

1. **Scalability**: Easy to add new models, schemas, services, and endpoints
2. **Maintainability**: Clear separation of concerns
3. **Testing**: Each layer can be tested independently
4. **Reusability**: Services can be shared across endpoints
5. **Organization**: Logical grouping makes code navigation easy
6. **Growth**: Can easily add new API versions (v2, v3)

## Migration from Old Structure

**Old flat structure:**
```
backend/
├── main.py
├── models.py
├── schemas.py
├── security.py
├── config.py
├── database.py
├── redis_service.py
├── kafka_service.py
├── elasticsearch_service.py
└── routes/
    └── *.py
```

**New modular structure:**
- Everything is organized under `app/` namespace
- Clear layers: core → models → schemas → services → api
- Improved import paths: `from app.core import settings`
- Easy to understand project layout

## Key Improvements

1. **Single Responsibility**: Each file has one clear purpose
2. **DRY Principle**: Shared utilities in core/services
3. **Easy Onboarding**: New developers understand structure quickly  
4. **Testability**: Dependency injection makes mocking easier
5. **Configuration**: Settings centralized in app/core/config.py
6. **Versioning**: API versions can coexist (v1, v2, etc.)

## Future Additions

```
app/
├── middlewares/          # Custom FastAPI middlewares
├── exceptions/          # Custom exception classes
├── logging/             # Logging configuration
├── validators/          # Custom Pydantic validators
├── dependencies/        # Shared FastAPI dependencies
└── background_tasks/    # Celery/APScheduler tasks
```
