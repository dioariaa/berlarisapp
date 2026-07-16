-- Jenis cuti dikelola sebagai PostgreSQL enum oleh migration Alembic.
-- File ini dapat dijalankan secara opsional sebelum migration pada database kosong.
DO $$
BEGIN
    CREATE TYPE leave_type_enum AS ENUM (
        'Cuti Tahunan',
        'Cuti Sakit',
        'Cuti Izin',
        'Cuti Khusus',
        'Lainnya'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END
$$;
