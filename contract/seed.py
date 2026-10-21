#!/usr/bin/env python3
"""Seed data uji untuk Schemathesis lokal (BUKAN untuk produksi).

Mengisi akun (argon2id), PIN zona (digest sha256 + pepper), prediksi harga/panen/demand, dan rekomendasi
lewat psql. Server HARUS sudah jalan sekali agar migrasi terpasang. Dijalankan:
  PIN_PEPPER=<sama dengan server> uvx --with argon2-cffi python contract/seed.py "$DATABASE_URL"
Pepper bawaan server = "pin:" + JWT_SECRET; jika PIN_PEPPER tak diisi, skrip memakai JWT_SECRET dari lingkungan.
"""
import hashlib
import os
import subprocess
import sys

from argon2 import PasswordHasher

PASSWORD = os.environ.get("SEED_PASSWORD", "sandi-uji-lokal-1")
PIN_PETANI = os.environ.get("PIN_PETANI", "482013")
PIN_VENDOR = os.environ.get("PIN_VENDOR", "739204")
ZONA = "psr_jakarta_timur_01"
AKUN = [("ceo-uji", "ceo"), ("analis-uji", "analis"), ("layanan-uji", "layanan")]


def pepper() -> str:
    if os.environ.get("PIN_PEPPER"):
        return os.environ["PIN_PEPPER"]
    return "pin:" + os.environ["JWT_SECRET"]


def digest(nilai: str) -> str:
    return hashlib.sha256(pepper().encode() + b"\x00" + nilai.encode()).hexdigest()


def psql(url: str, sql: str) -> None:
    subprocess.run(["psql", url, "-v", "ON_ERROR_STOP=1", "-qc", sql], check=True)


def main() -> None:
    url = sys.argv[1]
    h = PasswordHasher().hash(PASSWORD)
    for username, peran in AKUN:
        psql(
            url,
            "INSERT INTO pengguna (id, username, password_hash, peran) "
            f"VALUES (gen_random_uuid(), '{username}', '{h}', '{peran}') "
            "ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash, aktif = true",
        )
    for peran, pin in (("petani", PIN_PETANI), ("vendor", PIN_VENDOR)):
        psql(
            url,
            "INSERT INTO zona_pin (id, zona, peran, pin_digest) "
            f"VALUES (gen_random_uuid(), '{ZONA}', '{peran}', '{digest(pin)}') "
            "ON CONFLICT (pin_digest) DO NOTHING",
        )
    psql(
        url,
        f"""
        INSERT INTO prediksi_harga
          SELECT 'cmd_cabai_merah', '{ZONA}', (NOW() AT TIME ZONE 'Asia/Jakarta')::date + n, 'H+' || GREATEST(n, 1),
                 42000 + n * 500, 39000, 46000, 'sedang', 'stok_gudang_72%', 'harga_v1.0.0', NOW()
          FROM generate_series(0, 7) n
        ON CONFLICT DO NOTHING;
        INSERT INTO prediksi_panen VALUES
          ('cmd_cabai_merah', 'kab_brebes', to_char(NOW(), 'IYYY-"W"IW'), 12500, 11000, 14000, 'tinggi', 'panen_v1.0.0', NOW())
        ON CONFLICT DO NOTHING;
        INSERT INTO prediksi_demand VALUES
          ('cmd_cabai_merah', '{ZONA}', 'H+7_total_kg', (NOW() AT TIME ZONE 'Asia/Jakarta')::date, 840.0, 700.0, 980.0,
           'defisit', '["Amankan pasokan 800 kg"]'::jsonb, 'demand_v1.0.0', NOW())
        ON CONFLICT DO NOTHING;
        INSERT INTO rekomendasi (id, zona, teks) VALUES
          ('rek_uji_001', '{ZONA}', '["Amankan pasokan 800 kg"]'::jsonb)
        ON CONFLICT DO NOTHING;
        """,
    )
    print("seed selesai:", ", ".join(a for a, _ in AKUN), "| PIN zona", ZONA)


if __name__ == "__main__":
    main()
