# CHANGELOG — titeny-web

Format: satu seksi per rilis, terbaru di atas. Wajib diperbarui pada setiap commit `feat:` / `fix:` / `docs:`.

## [Belum dirilis]

### Ditambahkan
- TTN-WEB-TEST-MAESTRO: alur E2E web `.maestro/` (smoke, papan petani, PIN salah) dengan harness mock API dan `jalankan.sh`; id HTML stabil pada landing, masuk, papan petani, umpan-balik; ADR-0002 (tooling uji); docs/testing/maestro.md.
- TTN-WEB-TEST-SCHEMATHESIS: `contract/schemathesis.sh` + `seed.py` + `schemathesis.toml` (uji properti terhadap openapi.yaml backend, 5 grup kredensial), workflow manual `schemathesis.yml`, docs/testing/schemathesis.md dengan temuan lari nyata pertama.
- TTN-WEB-TEST-PACT: uji kontrak konsumen Pact V3 (kesehatan, harga 200/401, rekomendasi, login, OTP) terhadap klien `src/lib`; kontrak terbit di `pacts/`; docs/testing/pact.md.
- TTN-WEB-004: papan CEO `/insight/ceo` (matriks 5x12, 5 rekomendasi dengan ubah status + catatan maks 140, tab Akurasi, util ekspor CSV maks 500 baris); kurva omzet/margin dan MAPE menunggu endpoint; ADR-0006.
- TTN-WEB-003: papan vendor `/insight/vendor` (tabel besok 12 komoditas, saran stok dengan stok lokal, peringatan warna + teks, banner estimasi); ADR-0005.
- TTN-WEB-002: papan petani `/insight/petani` (grafik SVG H+1..H+7 + P10-P90 + tabel alternatif, lencana keputusan, akurasi terbatas, data belum cukup, cache saat timeout, kartu panen, tombol tawarkan ke gudang); ADR-0004.
- TTN-WEB-005: masuk per peran (landing peran, PIN zona petani/vendor, akun + OTP CEO) lewat modul `sesi.ts`; klien API zod diturunkan dari openapi.yaml (timeout 12 dtk, cache terakhir, refresh token); proxy `/api/v1` dengan allowlist; form umpan-balik (komentar maks 280); instrumentasi `papan.dibuka`/`kartu.terlihat`/`umpan_balik.diberi` tanpa data pribadi; ADR-0003.
- Fondasi AI-dev v1.0.0: `AGENTS.md`, `CLAUDE.md`, `docs/decisions/ADR-0001-fondasi-teknis.md`, `versions/v1.0.0/docs/40-TECHSTACK.md` dan `60-BLAST-RADIUS.md` (versi lengkap, menggantikan ringkasan awal).

### Diubah
- Svelte 5.2.0 menjadi 5.20.0 (exact) karena galat build komponen ber-TypeScript; `graphify-out/` diabaikan git.
