# Demo Project - Python Backend

A FastAPI backend for the Demo monitoring system.

## Features

- JWT-based authentication (no external auth provider)
- PostgreSQL database with SQLAlchemy ORM
- Admin-only user management
- PRTG server configuration
- Audit logs & alerts management
- Operations tasks & gate access logs
- Role-based access control (admin/user)

## Prerequisites

- Python 3.10+
- PostgreSQL 12+
- pip

## Installation

### 1. Set up environment

```bash
cd backend
python -m venv venv

# On Windows
venv\Scripts\activate

# On Linux/Mac
source venv/bin/activate
```

### 2. Install dependencies

```bash
pip install -r requirements.txt
```

### 3. Configure database

Create a `.env` file in the `backend` directory:

```env
# Database
DATABASE_URL=postgresql://postgres:password@localhost:5432/demo

# JWT
SECRET_KEY=your-super-secret-key-change-in-production
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=10080

# CORS
CORS_ORIGINS=http://localhost:5173,http://localhost:5174

# Admin bootstrap
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin
ADMIN_EMAIL=admin@example.com

# Vertiv Environment Alert
VERTIV_BASE_URL=http://192.168.1.253
VERTIV_USERNAME=admin
VERTIV_PASSWORD=your-password
VERTIV_STATUS_PATH=/
VERTIV_VERIFY_SSL=false
VERTIV_REQUEST_TIMEOUT_SECONDS=15
```

### 4. Create PostgreSQL database

```bash
# Using psql
createdb demo
```

### 5. Bootstrap admin user

```bash
python bootstrap_admin.py
```

You should see:
```
🔧 Bootstrapping Admin User...
✓ Database tables created/verified
✓ Admin user created successfully
  Username: admin
  Email: admin@example.com
  Password: admin

✅ Bootstrap complete! You can now start the API server.
```

## Running the Server

```bash
python main.py
```

The API will be available at `http://localhost:8000`

### OpenAPI Documentation

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc
- Health check: http://localhost:8000/health

## API Endpoints

### Authentication

- `POST /api/auth/login` - Login with username/password
- `POST /api/auth/validate-token` - Validate JWT token

### Users (Admin Only)

- `GET /api/users/` - List all users
- `POST /api/users/` - Create new user
- `GET /api/users/{user_id}` - Get user details
- `PUT /api/users/{user_id}` - Update user
- `DELETE /api/users/{user_id}` - Delete user

### PRTG Servers (Admin Only)

- `GET /api/prtg/` - List PRTG servers
- `POST /api/prtg/` - Create PRTG server
- `GET /api/prtg/{server_id}` - Get server details
- `PUT /api/prtg/{server_id}` - Update server
- `DELETE /api/prtg/{server_id}` - Delete server

### Vertiv Environment Alert (Authenticated)

- `GET /api/vertiv/live/temperature-humidity` - Get latest temperature and humidity

### Audit Logs

- `GET /api/audit/` - List audit logs
- `POST /api/audit/` - Create audit log (admin only)

### Alerts

- `GET /api/alerts/` - List alerts
- `POST /api/alerts/` - Create alert (admin only)
- `GET /api/alerts/{alert_id}` - Get alert details
- `PUT /api/alerts/{alert_id}` - Update alert (admin only)
- `DELETE /api/alerts/{alert_id}` - Delete alert (admin only)

### Operation Tasks

- `GET /api/operations/tasks` - List tasks
- `POST /api/operations/tasks` - Create task
- `GET /api/operations/tasks/{task_id}` - Get task details
- `PUT /api/operations/tasks/{task_id}` - Update task
- `DELETE /api/operations/tasks/{task_id}` - Delete task

### Gate Logs

- `GET /api/gates/` - List gate logs
- `POST /api/gates/` - Create gate log
- `GET /api/gates/{log_id}` - Get log details
- `PUT /api/gates/{log_id}` - Update log
- `DELETE /api/gates/{log_id}` - Delete log

## Database Schema

Tables created automatically on first run:

- `profiles` - User accounts with roles
- `prtg_servers` - PRTG connection settings
- `audit_logs` - Log entries from PRTG/Elasticsearch
- `alerts` - System alerts
- `operation_tasks` - Operations tracking
- `gate_open_logs` - Gate access tracking

## Development

### Run with auto-reload

```bash
pip install uvicorn[standard]
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Run tests

```bash
# Install pytest
pip install pytest httpx

# Run tests (when available)
pytest
```

## Frontend Integration

The frontend needs these environment variables in `.env`:

```env
VITE_BACKEND_URL=http://localhost:8000
```

The frontend will:
1. Call `POST /api/auth/login` with username & password
2. Receive JWT token
3. Include token in subsequent requests via `Authorization: Bearer <token>` header

## Security Notes

- Always change `SECRET_KEY` in production
- Use strong passwords for admin user
- Run behind HTTPS in production
- Consider adding rate limiting
- Implement request logging for security audit
- Regularly backup PostgreSQL database

## Troubleshooting

### Database connection failed

```
psycopg2.OperationalError: could not translate host name "localhost" to address
```

- Check PostgreSQL is running
- Verify DATABASE_URL format
- Ensure database exists

### Port 8000 already in use

```bash
# Windows: Find and kill process on port 8000
netstat -ano | findstr :8000
taskkill /PID <PID> /F

# Linux/Mac: 
sudo lsof -ti:8000 | xargs kill -9
```

### JWT token expired

- Tokens expire after `JWT_EXPIRE_MINUTES` (default 7 days)
- Clear browser cache and login again
- Adjust expiry time in `.env` if needed

## License

Same as parent project
