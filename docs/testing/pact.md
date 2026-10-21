# Uji kontrak konsumen (Pact)

Tiket: TTN-WEB-TEST-PACT. Konsumen `titeny-web`, provider `titeny-backend-service`.

## Menjalankan

```sh
bun install
bun run test:pact      # atau: bun test tests/pact
```

Uji memanggil klien nyata (`src/lib/api.ts` + `klien.ts`) ke mock server Pact lokal (tanpa jaringan keluar).
Hasilnya berkas kontrak `pacts/titeny-web-titeny-backend-service.json` (Pact V3, dikomit agar provider dapat memverifikasi).

## Interaksi yang dikunci

| Interaksi | Endpoint | Auth |
|---|---|---|
| kesehatan | `GET /api/v1/kesehatan` | tanpa |
| harga 200 | `GET /api/v1/harga` | `X-Zona-PIN` |
| harga 401 | `GET /api/v1/harga` | tanpa (amplop `Galat`, `tidak_berhak`) |
| rekomendasi | `GET /api/v1/rekomendasi` | `X-Zona-PIN` |
| login CEO | `POST /api/v1/auth/login` | tantangan OTP; 401 kredensial salah |
| verifikasi OTP | `POST /api/v1/auth/otp/verifikasi` | pasangan token |

Bentuk respons diturunkan dari `docs/api/openapi.yaml` backend (branch `feat/ttn-be-005-aksi-analis-audit`); matcher
mengunci tipe dan pola, bukan nilai contoh. Nilai kredensial pada kontrak adalah data uji, bukan rahasia.

## Verifikasi provider (dikerjakan di backend)

Kontrak baru bermakna setelah provider memverifikasinya. Langkah di `titeny-backend-service` (perlu issue/PR di repo itu):

1. Ambil `pacts/titeny-web-titeny-backend-service.json` dari repo ini (URL raw atau salinan di CI).
2. Verifikasi dengan `pact_verifier_cli` atau crate `pact_verifier` terhadap server uji + Postgres lokal.
3. Implementasikan state handler untuk setiap `given`: `layanan sehat dan prediksi sudah dihitung`,
   `prediksi harga cabai merah di pasar zona PIN tersedia` (PIN `482013` terdaftar di `zona_pin`),
   `permintaan tanpa kredensial`, `rekomendasi untuk zona PIN vendor tersedia`, `akun CEO ada dan kata sandi benar`,
   `sesi OTP aktif dengan kode 123456`.

Status: verifikasi provider BELUM dijalankan dari repo ini.
