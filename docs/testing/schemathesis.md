# Uji properti Schemathesis

Tiket: TTN-WEB-TEST-SCHEMATHESIS. Menguji server `titeny-backend-service` terhadap `docs/api/openapi.yaml` miliknya
(spec tidak disalin ke repo ini; sumber kebenaran tetap di backend).

## Menjalankan lokal

Prasyarat: Postgres lokal, `uvx`, `curl`, `python3`, build backend (`cargo build` di `titeny-backend-service`).

```sh
createdb titeny_web_st
export DATABASE_URL=postgres://$USER@localhost:5432/titeny_web_st \
       JWT_SECRET=rahasia-schemathesis-lokal-minimal-32-karakter \
       OTP_LOG_DEV=true BIND_ADDR=127.0.0.1:18091 RATE_LIMIT_PER_MENIT=100000
# di titeny-backend-service (cabang dengan spec): jalankan sekali agar migrasi terpasang
./target/debug/titeny-backend-service > /tmp/ttn-be.log 2>&1 &
# di repo ini
uvx --with argon2-cffi python contract/seed.py "$DATABASE_URL"
SPEC=../titeny-backend-service/docs/api/openapi.yaml BASE_URL=http://127.0.0.1:18091 \
  SERVER_LOG=/tmp/ttn-be.log contract/schemathesis.sh
```

Variabel lain: `MAX_EXAMPLES` (default 50), `PIN_PETANI`, `SANDI`, `REPORT_DIR` (JUnit, diabaikan git).
Telemetri mati (`SCHEMATHESIS_TELEMETRY=off`). Skrip keluar bukan-nol bila ada kegagalan.

Skrip menjalankan 5 grup: `publik` (Kesehatan, Auth, semua pemeriksaan), `pin-zona` (PIN petani), `ceo` (Bearer),
`analis` (Bearer), `layanan` (token sumber event). Untuk grup berkredensial, pemeriksaan `ignored_auth` (ST401)
dikecualikan karena kredensial dikirim sebagai header tetap dan pemeriksaan itu memutasinya (positif palsu).
OTP akun CEO/analis dibaca dari log server mode dev (`OTP_LOG_DEV=true`); jangan dipakai di produksi.

## Workflow manual

`.github/workflows/schemathesis.yml` (`workflow_dispatch`): membangun backend pada ref yang dipilih, memasang
Postgres, seed, lalu menjalankan skrip. Workflow ini baru DITULIS, belum dijalankan di GitHub.

## Hasil nyata pertama (lokal, 5 grup, MAX_EXAMPLES=50)

Backend: cabang `feat/ttn-be-005-aksi-analis-audit` (commit 5447ae9), build debug, Postgres 18 lokal.
Total 27 kegagalan unik. Dikelompokkan (temuan untuk backend/kontrak, bukan untuk repo ini):

| # | Temuan | Jenis | Contoh |
|---|---|---|---|
| 1 | `POST /api/v1/umpan-balik` dan `POST /api/v1/rekomendasi/{id}/status` dijawab 404 kosong (rute belum ada di `app.rs`), padahal ada di spec | implementasi belum ada | ST103, ST104, ST109 |
| 2 | `GET /rekomendasi` mengembalikan `null` untuk `catatan`, `penanggung_jawab`, `target_tanggal`; spec bertipe `string` (tanpa null) | server vs spec | ST108 (3 pelanggaran) |
| 3 | `komoditas_id` (harga/demand) dan `kabupaten_id` (panen) wajib menurut deskripsi, tetapi parameter tidak `required: true`; permintaan tanpa itu valid menurut spec namun dijawab 422 | spec kurang ketat | ST202 |
| 4 | `username` kosong (login) dan `sesi_id` kosong (OTP) valid menurut spec tetapi 422; perlu `minLength: 1` | spec kurang ketat | ST202 |
| 5 | `GET /analis/antrean`: `limit=201`, `cursor=` kosong, dan `limit` bukan angka dijawab 422/400, tidak tercantum di responses (hanya 200/401/403/429/500) | respons tak terdokumentasi + batasan spec | ST103, ST202 |
| 6 | `POST /analis/tahan` dan `/analis/validasi`: `X-Idempotency-Key` harus sama dengan `aksi_id`, `nilai_baru` hanya untuk `koreksi_nilai`; aturan lintas-field tak ada di skema (perlu `if/then` atau `oneOf`) | spec kurang ketat | ST202 |
| 7 | `POST /event/masuk`: `payload` tidak terikat ke `event_type` (mis. `stok.berubah` dengan payload cuaca ditolak 422) | spec kurang ketat | ST202 |

Dampak ke web: temuan 2 berarti skema klien `RekomendasiSkema` (zod `.optional()`, tanpa `.nullable()`) akan menolak
jawaban nyata (`respons_tidak_sesuai`). Perbaikan sisi web (terima `null`) atau sisi backend (hilangkan field null)
perlu diputuskan manajer; tidak diubah di PR ini. Temuan 1 berarti ubah-status rekomendasi dan umpan-balik di web
belum dapat bekerja terhadap backend nyata.
