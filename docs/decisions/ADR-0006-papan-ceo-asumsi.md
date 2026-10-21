# ADR-0006 — Papan CEO: asumsi dan gap kontrak

- **Status**: Diterima
- **Tanggal**: 2026-10-21

## Konteks
TTN-WEB-004 (issue #4) memakai openapi.yaml backend (PR #10, commit 5447ae9). Dua dari empat butir acceptance tidak punya endpoint.

## Keputusan
1. **Matriks 5x12**: kontrak hanya punya `GET /demand?komoditas_id&zona` (zona rute/pasar, bukan kabupaten). Matriks memanggil `/demand` dengan `zona=<kabupaten_id>` (kab_karawang, kab_subang, kab_garut, kab_brebes, kab_malang; pola dari contoh spec). ASUMSI; sel 404 tampil "tidak ada data". Warna selalu disertai ikon + teks sr-only (hijau seimbang, kuning surplus, merah defisit).
2. **Kuota**: matriks = 60 permintaan, sama dengan batas 60/menit per token. Dimuat dengan paralel 6; sel yang kena 429 ditandai gagal dan dapat dimuat ulang tersendiri. Perlu endpoint agregat matriks di backend.
3. **Rekomendasi**: `GET /rekomendasi?limit=5`; ubah status lewat `POST /rekomendasi/{id}/status` (tujuan hanya dikerjakan|selesai; catatan wajib 1-140 karakter, validasi klien). 409 memuat ulang data.
4. **Kurva omzet vs margin (S10) dan tab Akurasi (MAPE H+7)**: TIDAK ADA endpoint di kontrak. Keduanya menampilkan keadaan "belum tersedia" tanpa angka rekaan. Ekspor CSV 500 baris (`buatCsv`, teruji) sudah siap tetapi tombolnya nonaktif sampai ada data.
5. Revalidasi polling 15 menit (TECHSTACK).
