# CHANGELOG — titeny-web

Format: satu seksi per rilis, terbaru di atas. Wajib diperbarui pada setiap commit `feat:` / `fix:` / `docs:`.

## [Belum dirilis]

### Ditambahkan
- TTN-WEB-002: papan petani `/insight/petani` (grafik SVG H+1..H+7 + P10-P90 + tabel alternatif, lencana keputusan, akurasi terbatas, data belum cukup, cache saat timeout, kartu panen, tombol tawarkan ke gudang); ADR-0004.
- TTN-WEB-005: masuk per peran (landing peran, PIN zona petani/vendor, akun + OTP CEO) lewat modul `sesi.ts`; klien API zod diturunkan dari openapi.yaml (timeout 12 dtk, cache terakhir, refresh token); proxy `/api/v1` dengan allowlist; form umpan-balik (komentar maks 280); instrumentasi `papan.dibuka`/`kartu.terlihat`/`umpan_balik.diberi` tanpa data pribadi; ADR-0003.
- Fondasi AI-dev v1.0.0: `AGENTS.md`, `CLAUDE.md`, `docs/decisions/ADR-0001-fondasi-teknis.md`, `versions/v1.0.0/docs/40-TECHSTACK.md` dan `60-BLAST-RADIUS.md` (versi lengkap, menggantikan ringkasan awal).

### Diubah
- Svelte 5.2.0 menjadi 5.20.0 (exact) karena galat build komponen ber-TypeScript; `graphify-out/` diabaikan git.
