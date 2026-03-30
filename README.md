# Demo

He thong giam sat gom React frontend, FastAPI backend va PostgreSQL.

## Chay nhanh (Docker dev)

```powershell
.\dev.ps1 start
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- API docs: http://localhost:8000/docs
- Login mac dinh: admin / admin

## Bien moi truong

Project dung 1 file duy nhat o root: `.env`

Bien moi de lay du lieu Vertiv Environment Alert:

```env
VERTIV_BASE_URL=http://192.168.1.253
VERTIV_USERNAME=admin
VERTIV_PASSWORD=your-password
VERTIV_STATUS_PATH=/
VERTIV_VERIFY_SSL=false
VERTIV_REQUEST_TIMEOUT_SECONDS=15

VITE_VERTIV_BASE_URL=http://192.168.1.253
VITE_VERTIV_PATH=/
VITE_VERTIV_REFRESH_MS=30000
```

## Lenh quan ly nhanh

```powershell
.\dev.ps1 logs backend
.\dev.ps1 restart
.\dev.ps1 stop
.\dev.ps1 reset
```

## Cau truc chinh

- `frontend/`: React + Vite
- `backend/`: FastAPI + SQLAlchemy
- `docker-compose.dev.yml`: moi truong dev
- `docker-elk/`: stack log (neu can)

