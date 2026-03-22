# PRTG + Supabase + React TypeScript

He thong gom:
- Frontend React TS.
- Supabase Auth + Postgres + Realtime.
- Edge Function lay du lieu PRTG.

## 1) Dieu chinh theo yeu cau

- Trang cau hinh PRTG da nam trong dropmenu Cau hinh giam sat: PRTG.
- Trang User da nam trong dropmenu Tai khoan.
- Chi admin duoc them/sua/xoa user (khong co chuc nang tu dang ky).
- Bo toan bo URL/login PRTG trong file env; thong tin PRTG duoc them/sua/xoa tren giao dien trang PRTG.

## 2) Bien moi truong

### Frontend (frontend/.env)
Chi giu cac bien can thiet:
- VITE_SUPABASE_URL
- VITE_SUPABASE_ANON_KEY

Mau tai: frontend/.env.example

### Backend scripts (.env hoac supabase/.env)
Dung cho bootstrap admin:
- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY (hoac SECRET_KEY)
- BOOTSTRAP_ADMIN_EMAIL
- BOOTSTRAP_ADMIN_PASSWORD
- BOOTSTRAP_ADMIN_USERNAME

## 3) Tao bang va tao user admin dau tien (test)

### Buoc 1: Tao bang
Mo Supabase SQL Editor va chay file:
- supabase/migrations/20260322_init.sql
- supabase/migrations/20260322_prtg_auth_columns.sql

### Buoc 2: Tao admin dau tien
Chay tu thu muc goc D:\code\Demo:

```powershell
node --env-file=.env supabase/scripts/bootstrap-admin.mjs
```

Mac dinh:
- Email: admin@local.dev
- Password: Admin@123456
- Username: admin

Luu y: Dang nhap bang email + password, khong dung username de login.

## 4) Quan ly PRTG server va lay du lieu

- Vao menu Cau hinh giam sat > PRTG.
- Them/sua/xoa PRTG server truc tiep tren giao dien.
- Co the cau hinh auth theo 1 trong 2 cach:
	- API Token
	- Username + Passhash
- Nhan nut Lay du lieu tai tung dong server de pull theo server do.
- Nhan nut Dong bo ngay de pull tat ca server active.

## 5) Deploy edge functions dung thu muc

Khong chay lenh trong D:\code\Demo\frontend.
Chay tai D:\code\Demo:

```powershell
supabase link --project-ref ixlektftclaigqqwgahm
supabase functions deploy admin-users
supabase functions deploy prtg-ingest
```

## 6) Chay frontend

### Local
```powershell
cd frontend
npm install
npm run dev
```

### Docker Compose
```powershell
cd D:\code\Demo
docker compose -f docker-compose.service.yml up -d --build
```

Truy cap: http://localhost:5173

## 7) Ghi chu bao mat

- Khong dua SUPABASE_SERVICE_ROLE_KEY vao frontend.
- admin-users function da kiem tra role admin truoc khi CRUD user.
