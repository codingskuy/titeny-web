# ADR-0003 — Klien kontrak API dan masuk per peran

- **Status**: Diterima
- **Tanggal**: 2026-10-21
- **Catatan nomor**: mengasumsikan ADR-0002 (tata kelola branch, PR #10) merge lebih dulu.

## Konteks

TTN-WEB-005 (issue #5) menuntut masuk per peran, umpan-balik, dan instrumentasi adopsi. Kontrak sumber kebenaran adalah `docs/api/openapi.yaml` di `titeny-backend-service` (branch PR #10, commit 5447ae9; bergantung pada titeny-backend-service#7..#10). Beberapa hal yang dibutuhkan papan belum ada di kontrak.

## Keputusan

1. **Tipe/klien diturunkan dari openapi.yaml** (`src/lib/kontrak.ts` zod + `src/lib/klien.ts` + `src/lib/api.ts`). Tidak ada field/endpoint rekaan; respons divalidasi zod, ketidaksesuaian menjadi galat `respons_tidak_sesuai`.
2. **Satu pemegang kredensial**: `src/lib/sesi.ts`. PIN zona (`X-Zona-PIN`) dipulihkan dari sessionStorage; token CEO (akses 15 menit, refresh 7 hari, sesuai standar KONTEKS/AGENTS) hanya di memori sehingga muat ulang meminta masuk + OTP lagi. Dokumen yang menyebut "8 jam" untuk sesi umum menyimpang; 8 jam hanya sesi analis menurut spec.
3. **Proxy `/api/v1/*`** (`src/lib/server/proxy.ts`) dengan allowlist jalur (tanpa `event/masuk`, `analis/*`), hanya header auth yang diteruskan, bodi maks 256 KB. Target lewat env `TITENY_API_URL` (bawaan `http://localhost:8080`).
4. **Timeout 12 detik**; GET yang timeout/gagal jaringan/5xx memakai cache terakhir + stempel waktu. Cache per peran, dihapus saat keluar. 429 tidak diulang otomatis.
5. **Login CEO** memakai `oneOf LoginTantangan | TokenPasang`; token berperan `layanan`/`analis` ditolak di web.
6. **Svelte dinaikkan 5.2.0 ke 5.20.0 (exact)** karena 5.2.0 gagal membangun komponen ber-anotasi TypeScript. Diizinkan TECHSTACK (naik dalam seri 5).
7. **Token desain sementara** di `src/app.css` (`--ttn-*`); titeny-design belum menerbitkan token. Ganti di satu tempat.

## Gap kontrak (ASUMSI, perlu keputusan pemilik kontrak)

| Butuh | Kondisi kontrak | Penanganan sementara |
|---|---|---|
| Endpoint penampung peristiwa analitik (`papan.dibuka`, `kartu.terlihat`, `umpan_balik.diberi`) | Tidak ada | Peristiwa divalidasi (skema strict, tanpa data pribadi) lalu ke sink buffer memori; `aturSink()` disiapkan |
| Verifikasi PIN zona | Tidak ada endpoint | PIN diperiksa lewat `GET /rekomendasi?limit=1` (401 = PIN salah) |
| Daftar komoditas/pasar/zona milik PIN | Tidak ada | Papan memakai pilihan yang dikonfigurasi di klien |

## Konsekuensi

- Saat kontrak menambah endpoint di atas, ganti sink analitik/pemeriksaan PIN tanpa menyentuh komponen.
- Umpan-balik hanya untuk petani/vendor (kontrak: keamanan `zonaPin` saja); CEO tidak memberi umpan-balik lewat endpoint ini.
- Anti-gaming BR-305 (>20x/hari dari PIN sama diabaikan) dijalankan server; klien tidak menduplikasi.
