# BerlarisApp

<p align="center">
  <img src="public/berlaris-logo.png" alt="Berlaris Kopi & Resto" width="180" />
</p>

BerlarisApp adalah aplikasi admin full-stack untuk pengelolaan karyawan dan pencatatan cuti langsung. Sistem tidak memiliki workflow pengajuan atau approval.

Repository tujuan: [github.com/dioariaa/berlarisapp](https://github.com/dioariaa/berlarisapp)

## Clone repository

```bash
git clone https://github.com/dioariaa/berlarisapp.git
cd berlarisapp
```

## Stack dan keamanan

- React, TypeScript, Vite
- FastAPI, Pydantic, SQLAlchemy, Alembic
- PostgreSQL Supabase atau Neon
- JWT Bearer authentication
- Password hashing bcrypt dengan cost 12
- Role `admin` dan `superadmin`
- Audit log PostgreSQL JSONB
- Export Excel dengan openpyxl

## Environment backend

Buat `backend/.env` dari `backend/.env.example`.

```env
ENVIRONMENT=production
DATABASE_URL=postgresql+psycopg://USER:PASSWORD@HOST:5432/DATABASE?sslmode=require
CORS_ORIGINS=https://admin.example.com
FRONTEND_URL=https://admin.example.com
BACKEND_URL=https://api.example.com
TRUSTED_HOSTS=api.example.com
FORCE_HTTPS=true

JWT_SECRET_KEY=hasilkan-secret-acak-minimal-32-karakter
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60

FIRST_SUPERADMIN_NAME=Nama Superadmin
FIRST_SUPERADMIN_EMAIL=superadmin@example.com
FIRST_SUPERADMIN_PASSWORD=password-kuat
FIRST_SUPERADMIN_OVERWRITE_PASSWORD=false

APP_NAME=BerlarisApp API
DEBUG=false
DATABASE_POOL_SIZE=5
DATABASE_MAX_OVERFLOW=10
```

Gunakan secret acak, misalnya:

```bash
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

Jangan pernah memasukkan `JWT_SECRET_KEY`, password database, atau password superadmin ke environment frontend.

## Supabase dan Neon

### Supabase

Salin PostgreSQL connection string dari **Project Settings → Database**. Untuk Alembic gunakan Direct connection atau Session pooler, bukan transaction pooler.

```env
DATABASE_URL=postgresql+psycopg://postgres.PROJECT_REF:PASSWORD@aws-0-REGION.pooler.supabase.com:5432/postgres?sslmode=require
```

Jika direct connection Supabase mengalami kendala IPv6, gunakan Session pooler.

### Neon

```env
DATABASE_URL=postgresql+psycopg://USER:PASSWORD@ep-example.REGION.aws.neon.tech/neondb?sslmode=require
```

URL `postgres://` dan `postgresql://` dinormalisasi otomatis ke driver Psycopg.

## Instalasi dan migration backend

```bash
cd backend
python -m venv .venv
```

Windows:

```powershell
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
python -m alembic upgrade head
```

macOS/Linux:

```bash
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python -m alembic upgrade head
```

Migration membuat tabel `employees`, `employee_leaves`, `users`, dan `audit_logs`, serta enum jenis cuti dan role.

## Seed superadmin pertama

Setelah migration dan environment superadmin terisi:

```bash
cd backend
python -m app.seed_superadmin
```

Seed bersifat idempotent. Jika email sudah ada, password tidak diubah kecuali:

```env
FIRST_SUPERADMIN_OVERWRITE_PASSWORD=true
```

Setelah berhasil, ubah kembali flag tersebut menjadi `false` dan hapus password bootstrap dari environment deployment jika platform operasional memungkinkan.

## Menjalankan backend

Development:

```bash
uvicorn app.main:app --reload
```

Production:

```bash
python -m alembic upgrade head
uvicorn app.main:app --host 0.0.0.0 --port 8000 --proxy-headers --forwarded-allow-ips="*"
```

Dokumentasi API:

- `/docs`
- `/redoc`
- `/health`

Health check turut memvalidasi koneksi database.

## Frontend

Buat `.env` dari `.env.example`:

```env
VITE_API_BASE_URL=https://api.example.com
VITE_API_TIMEOUT_MS=15000
```

Jalankan:

```bash
npm install
npm run dev
```

Build production:

```bash
npm run lint
npm run build
```

Token JWT disimpan pada `sessionStorage`, bukan `localStorage`; sesi terisolasi per tab dan dibersihkan saat logout atau ketika API mengembalikan `401`. Karena token Bearer dapat diakses JavaScript, frontend menerapkan header keamanan deployment dan menghindari penyisipan HTML mentah.

## Role

`admin`:

- Dashboard
- CRUD karyawan
- CRUD data cuti
- Export Excel karyawan dan cuti

`superadmin`:

- Semua akses admin
- Membuat dan mengubah role user
- Menonaktifkan user
- Melihat audit log
- Export audit log

Backend tetap menjadi sumber kebenaran authorization. Menyembunyikan menu frontend bukan pengganti role guard API.

## Audit log

Audit log mencatat:

- Login berhasil/gagal dan logout
- Create/update/delete karyawan
- Create/update/delete cuti
- Create/update/deactivate user
- Export Excel

Snapshot sebelum dan sesudah perubahan disimpan sebagai JSONB. Endpoint audit hanya menyediakan operasi baca; tidak ada endpoint update atau delete audit log.

## Export Excel

- `GET /exports/employees.xlsx`
- `GET /exports/employee-leaves.xlsx`
- `GET /exports/audit-logs.xlsx` — superadmin

Export cuti mendukung `month`, `year`, `date_from`, `date_to`, `employee_id`, dan `leave_type`. Aktivitas export dicatat pada audit log.

## Endpoint auth dan user

- `POST /auth/login`
- `GET /auth/me`
- `POST /auth/logout`
- `GET|POST /users` — superadmin
- `PUT|DELETE /users/{id}` — superadmin

Endpoint dashboard, karyawan, cuti, dan export wajib Bearer token.

## Analitik dan rekap cuti

Dashboard dan rekap karyawan menggunakan periode yang sama:

- Tahunan: `GET /dashboard/summary?period_type=yearly&year=2026`
- Bulanan: `GET /dashboard/summary?period_type=monthly&month=6&year=2026`
- Rentang tanggal: `GET /dashboard/summary?period_type=custom&date_from=2026-01-01&date_to=2026-06-30`
- Rekap karyawan: `GET /employee-leaves/by-employee` dengan query periode yang sama

Tambahkan `include_zero=true` pada endpoint rekap untuk menyertakan seluruh karyawan aktif yang belum memiliki cuti. Jumlah hari dihitung berdasarkan irisan tanggal cuti dengan periode aktif, termasuk cuti yang melintasi bulan atau tahun.

## Deployment HTTPS

### Railway

1. Buat service dari folder `backend`.
2. Gunakan Dockerfile atau start command pada `backend/Procfile`.
3. Isi seluruh environment backend.
4. Set health check ke `/health`.
5. Pastikan domain backend masuk `TRUSTED_HOSTS`.

### Render

- Root directory: `backend`
- Build: `pip install -r requirements.txt`
- Start:

```bash
python -m alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port $PORT --proxy-headers --forwarded-allow-ips="*"
```

### Fly.io

Gunakan `backend/Dockerfile`, simpan secret melalui `fly secrets set`, dan jalankan migration sebelum release.

### Vercel atau Netlify

Deploy root frontend. Konfigurasi dasar tersedia di `vercel.json` dan `netlify.toml`. Isi:

```env
VITE_API_BASE_URL=https://api.example.com
```

Jika frontend menggunakan HTTPS, backend wajib HTTPS. Browser akan memblokir API HTTP karena mixed content.

## Verifikasi

Backend:

```bash
cd backend
pytest -q
python -m compileall app alembic
python -m alembic upgrade head --sql
```

Frontend:

```bash
npm run lint
npm run build
```

## Troubleshooting

- `401 Unauthorized`: token tidak ada, tidak valid, kedaluwarsa, atau user sudah dinonaktifkan. Login kembali.
- `403 Forbidden`: role akun tidak cukup untuk endpoint tersebut.
- CORS error: pastikan origin frontend lengkap, termasuk skema HTTPS, ada di `CORS_ORIGINS`.
- Token expired: frontend membersihkan sesi dan mengarahkan kembali ke halaman login.
- Database connection failed: periksa `DATABASE_URL`, SSL, allowlist jaringan, dan status Supabase/Neon.
- `Invalid host header`: tambahkan hostname backend ke `TRUSTED_HOSTS`.
- Mixed content: jangan panggil API HTTP dari frontend HTTPS.
- Migration gagal di Supabase: gunakan Direct connection atau Session pooler, bukan transaction pooler.
