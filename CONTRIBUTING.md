# Berkontribusi ke titeny-web

Semua requirement bersumber dari Titeny-TownHall v1.0.0 (lihat `AGENTS.md`). Baca `AGENTS.md` dan seluruh ADR di `docs/decisions/` sebelum menulis kode.

## Alur: fork -> branch -> atomic commit -> PR

1. **Fork** `Coding-Skuy/titeny-web` ke akun sendiri, clone fork, lalu tambah remote `upstream`:
   ```bash
   gh repo fork Coding-Skuy/titeny-web --clone=false
   git clone https://github.com/<akun>/titeny-web.git && cd titeny-web
   git remote add upstream https://github.com/Coding-Skuy/titeny-web.git
   ```
2. **Branch** dari `upstream/main`, satu branch = satu tiket = satu PR:
   ```bash
   git fetch upstream && git checkout -b feat/ttn-web-002-papan-petani upstream/main
   ```
   Awalan: `feat/`, `fix/`, `test/`, `docs/`, `chore/` + kode tiket huruf kecil + slug.
3. **Atomic commit**: satu perubahan logis per commit, conventional commits berbahasa Indonesia (`feat:`, `fix:`, `test:`, `docs:`, `chore:`). Setiap commit `feat:`/`fix:`/`docs:` memperbarui `CHANGELOG.md`.
4. **Uji lokal** sebelum PR: `bun install && bun run check && bun test`.
5. **PR** ke `Coding-Skuy/titeny-web` base `main` dari branch fork; isi templat PR, cantumkan `Closes #N`.

## Aturan

- Jangan merge PR sendiri; tinjauan manusia wajib (lihat `.github/CODEOWNERS`).
- Jangan force-push ke `main`; jangan commit rahasia (`.env`, kunci, token).
- Dokumen `versions/v*` dan ADR yang sudah `Diterima` bersifat immutable.
- Perubahan kontrak API/arsitektur = ADR baru; requirement berubah = PR di Titeny-TownHall lebih dulu.
