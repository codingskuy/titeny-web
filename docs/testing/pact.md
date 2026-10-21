# Uji kontrak konsumen (Pact) — titeny-web

Tiket: TTN-WEB-TEST-PACT (#7). Spec sumber: `docs/api/openapi.yaml` di `Coding-Skuy/titeny-backend-service` (tidak disalin ke sini).

## Menjalankan

```bash
bun install
bun run test:pact      # hanya kontrak
bun test               # semua uji
```

Hasil: berkas kontrak `pacts/titeny-web-titeny-backend-service.json` (Pact spesifikasi V3). Berkas ini ikut di-commit agar provider dapat memverifikasinya.

## Cakupan

| Interaksi | Endpoint | Auth |
|---|---|---|
| Kesehatan | `GET /api/v1/kesehatan` | tanpa |
| Harga H+1..H+7 | `GET /api/v1/harga?komoditas_id&pasar_id` | `X-Zona-PIN` |
| Galat 401 | `GET /api/v1/harga` tanpa PIN | amplop `Galat` (`tidak_berhak`) |

Klien yang diuji: `src/lib/klien.ts` (validasi respons dengan zod; tipe mengikuti skema OpenAPI).

## Verifikasi provider

Dimiliki backend (`titeny-backend-service`): memverifikasi `pacts/*.json` terhadap Axum. Repo ini tidak mengubah kode backend; permintaan diajukan sebagai issue di repo backend. Publikasi ke Pact Broker belum dilakukan (tanpa kredensial); bila broker tersedia: `pact-broker publish pacts --consumer-app-version <sha> --branch <branch>`.

## Catatan

- `bun test` menjalankan mesin native Pact langsung di Bun (terverifikasi pada Bun 1.4.2).
- Tambah interaksi baru hanya bila endpoint ada di `openapi.yaml`; ketidaksesuaian dokumen dicatat sebagai issue, bukan ditebak.
