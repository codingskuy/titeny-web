# ADR-0004 — Papan insight: asumsi atas kontrak yang belum lengkap

- **Status**: Diterima
- **Tanggal**: 2026-10-21

## Konteks
Papan petani (TTN-WEB-002), vendor (003), dan CEO (004) dibangun sebagai konsumen `openapi.yaml` backend (PR #10, commit 5447ae9). Beberapa kebutuhan acceptance tidak punya endpoint/field. Tidak ada kontrak yang dikarang; yang berikut adalah ASUMSI yang harus dikonfirmasi pemilik kontrak.

## Keputusan (papan petani)
1. **Acuan "harga hari ini"**: kontrak hanya punya horizon H+1..H+7. Acuan lencana = titik ber-tanggal hari ini (WIB) bila ada, selain itu titik H+1.
2. **Daftar komoditas** (`src/lib/komoditas.ts`): 12 slug diturunkan dari deskripsi `KomoditasId`; panen 6 komoditas. Tidak ada endpoint daftar.
3. **Kartu cuaca**: tidak ada endpoint cuaca; kartu hanya menampilkan panen M+1..M+4 dan catatan "data hujan belum tersedia".
4. **Tombol "Tawarkan ke gudang"**: URL form TitipO/Lumbung tidak ada di kontrak; dibaca dari `VITE_URL_TAWAR_GUDANG`, nonaktif bila kosong.
5. **Polling** 30 menit (cache server 6 jam); bukan push.
6. Aturan lencana (ambang 8%, kepercayaan >= sedang untuk TAHAN) mengikuti `produk/10-papan-insight.md`; aritmetika integer.
