# CHANGELOG — titeny-web

Format: satu seksi per rilis, terbaru di atas. Wajib diperbarui pada setiap commit `feat:` / `fix:` / `docs:`.

## [Belum dirilis]

### Ditambahkan
- Fondasi AI-dev v1.0.0: `AGENTS.md`, `CLAUDE.md`, `docs/decisions/ADR-0001-fondasi-teknis.md`, `versions/v1.0.0/docs/40-TECHSTACK.md` dan `60-BLAST-RADIUS.md` (versi lengkap, menggantikan ringkasan awal).
- Uji kontrak konsumen Pact (TTN-WEB-TEST-PACT): `src/lib/klien.ts`, `tests/pact/klien.pact.test.ts`, `pacts/`, `docs/testing/pact.md`, skrip `bun test`.

### Diubah
- Scaffolding build dilengkapi (`adapter-node`, `@sveltejs/vite-plugin-svelte`, Tailwind 3.4 + PostCSS, `app.html`, layout); `bun run check` kini menjalankan `svelte-kit sync`; beranda menjadi pemilih peran; `src/lib/api.ts` (endpoint tak ada di kontrak) diganti `klien.ts`.
