# BerlarisApp

<p align="center">
  <img src="public/berlaris-logo.png" alt="Berlaris Kopi & Resto" width="180" />
</p>

BerlarisApp adalah aplikasi admin untuk pengelolaan karyawan dan pencatatan cuti langsung. Sistem tidak memiliki workflow pengajuan atau approval.

Repository tujuan: [github.com/dioariaa/berlarisapp](https://github.com/dioariaa/berlarisapp)

## Clone repository

```bash
git clone https://github.com/dioariaa/berlarisapp.git
cd berlarisapp
```

## Stack dan keamanan

- React, TypeScript, Vite
- Supabase (Postgres, Auth, Row Level Security, Postgres Functions/RPC)
- Frontend berbicara langsung ke Supabase lewat `@supabase/supabase-js` — tidak ada backend server terpisah yang perlu di-host
- Autentikasi Supabase Auth (bcrypt di sisi Supabase, JWT dikelola otomatis oleh Supabase)
- Role `admin` dan `superadmin`, disimpan di tabel `profiles` dan ditegakkan lewat RLS + RPC `SECURITY DEFINER`
- Audit log PostgreSQL JSONB, ditulis dari dalam RPC (bukan dari client) sehingga tidak bisa dipalsukan dari browser
- Export Excel dibuat di sisi client dengan `exceljs`

## Arsitektur

Semua logic yang dulunya ada di backend FastAPI (validasi, deteksi overlap cuti, proteksi "last superadmin", audit log) sekarang berupa Postgres RPC function bertipe `SECURITY DEFINER` di project Supabase. RLS membatasi `SELECT` langsung dari client hanya untuk user admin/superadmin yang aktif, dan operasi tulis (`INSERT`/`UPDATE`/`DELETE`) ditolak di level tabel — satu-satunya jalan menulis data adalah lewat RPC tersebut, yang memvalidasi role sebelum mengeksekusi.

Fungsi-fungsi utama yang ada di project Supabase:

- `create_employee`, `update_employee`, `delete_employee`
- `create_leave`, `update_leave`, `delete_leave`
- `create_user`, `update_user`, `deactivate_user`
- `dashboard_summary`, `leave_summary`, `leaves_by_employee`
- `log_export`, `log_login_failed`, `log_login_inactive`, `login_success`, `logout_event`, `me`

Karena tidak ada backend yang perlu di-deploy, satu-satunya bagian yang perlu di-hosting adalah frontend statis (Vite build) — misalnya di Vercel atau Netlify.

## Environment frontend

Buat `.env` dari `.env.example`:

```env
VITE_SUPABASE_URL=https://xxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_xxxxxxxxxxxxxxxx
```

`VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY` bersifat publik by design (dilindungi oleh RLS dan RPC di sisi Supabase, bukan oleh kerahasiaan key), jadi aman muncul di bundle frontend. Jangan pernah menaruh `service_role` key di frontend.

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

Sesi login dikelola oleh Supabase Auth dan disimpan pada `sessionStorage` (bukan `localStorage`), sehingga sesi terisolasi per tab dan hilang saat tab ditutup atau logout.

## Setup database Supabase

1. Buat project Supabase baru (atau gunakan yang sudah ada).
2. Jalankan migration SQL yang membuat: enum `user_role` dan `leave_type`, tabel `profiles`, `employees`, `employee_leaves`, `audit_logs`, helper function `is_admin()`/`is_superadmin()`, RLS policy untuk `SELECT`, serta seluruh RPC function di atas.
3. Buat superadmin pertama secara manual (insert ke `auth.users` + `auth.identities` + `public.profiles` dengan role `superadmin`), karena `create_user` RPC mensyaratkan pemanggil sudah superadmin.
4. Salin `Project URL` dan `anon`/`publishable` key dari **Project Settings → API** ke `.env` frontend.

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

RLS dan RPC di Supabase tetap menjadi sumber kebenaran authorization. Menyembunyikan menu frontend bukan pengganti pengecekan role di RPC.

## Audit log

Audit log mencatat:

- Login berhasil/gagal dan logout
- Create/update/delete karyawan
- Create/update/delete cuti
- Create/update/deactivate user
- Export Excel

Snapshot sebelum dan sesudah perubahan disimpan sebagai JSONB. Tabel `audit_logs` hanya bisa dibaca lewat RLS (khusus superadmin); penulisan hanya terjadi dari dalam RPC `SECURITY DEFINER`, tidak ada endpoint update atau delete.

## Export Excel

Export dibuat langsung di browser memakai `exceljs`, dari data yang sudah diambil lewat Supabase (dibatasi RLS). Setiap export tetap memanggil RPC `log_export` supaya tercatat di audit log:

- Data karyawan
- Data cuti karyawan (mendukung filter `month`, `year`, `date_from`, `date_to`, `employee_id`, `leave_type`)
- Audit log — superadmin

## Analitik dan rekap cuti

Dashboard dan rekap karyawan menggunakan periode yang sama lewat RPC `dashboard_summary` dan `leaves_by_employee`:

- Tahunan, bulanan, atau rentang tanggal custom
- `include_zero=true` untuk menyertakan seluruh karyawan aktif yang belum memiliki cuti
- Jumlah hari dihitung berdasarkan irisan tanggal cuti dengan periode aktif, termasuk cuti yang melintasi bulan atau tahun

## Deployment

Deploy root frontend ke platform static hosting apa pun (Vercel, Netlify, dsb). Tidak ada backend yang perlu dijalankan terpisah — cukup pastikan env var `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY` terisi di platform hosting.

```env
VITE_SUPABASE_URL=https://xxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_xxxxxxxxxxxxxxxx
```

## Troubleshooting

- Login gagal dengan pesan "Email atau password tidak valid": kredensial salah, atau user belum ada di `auth.users`/`profiles`.
- "Akun tidak aktif": `profiles.is_active` bernilai `false`. Aktifkan lewat superadmin lain atau langsung di database.
- `FORBIDDEN` dari RPC: role akun tidak cukup untuk aksi tersebut — cek `profiles.role`.
- Data tidak muncul padahal sudah login: pastikan baris `profiles` untuk user tersebut ada dan `role`/`is_active` benar, karena RLS bergantung pada tabel ini.
- "Tidak dapat terhubung ke server": cek `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` sudah benar dan project Supabase tidak sedang paused (project gratis Supabase auto-pause setelah tidak aktif dalam waktu lama).
- Export Excel gagal: pastikan browser tidak memblokir download otomatis (popup/download blocker).
