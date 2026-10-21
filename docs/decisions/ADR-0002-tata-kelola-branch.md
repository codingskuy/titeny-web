# ADR-0002 — Tata kelola branch dan alur kontribusi

- **Status**: Diterima
- **Tanggal**: 2026-10-21

## Konteks

Repo dikerjakan oleh banyak kontributor, termasuk agent AI. Perlu alur seragam supaya riwayat bersih, tinjauan manusia tidak terlewat, dan `main` selalu dapat dirilis. Tiket: TTN-WEB-GOV-BRANCH (#6).

## Keputusan

1. **Forking**: kontributor bekerja di fork, bukan langsung di repo org.
2. **Branch**: dari `upstream/main` dengan nama `feat|fix|test|docs|chore/<kode-tiket-lowercase>-<slug>`; satu branch = satu tiket = satu PR.
3. **Commit**: atomic, conventional commits berbahasa Indonesia; CHANGELOG diperbarui pada `feat:`/`fix:`/`docs:`.
4. **PR**: ke `main` memakai `.github/pull_request_template.md` dan `Closes #N`; penutupan issue terjadi saat merge.
5. **Kepemilikan**: `.github/CODEOWNERS` menetapkan `@Coding-Skuy` sebagai peninjau default.
6. **Larangan**: tidak ada merge oleh penulis PR/agent, tidak ada force-push ke `main`, tidak ada rahasia di repo.
7. **Usulan proteksi branch `main`** (hanya diusulkan, TIDAK diterapkan oleh ADR/PR ini; pemilik repo yang memutuskan):
   - wajib PR dengan minimal 1 persetujuan dan review CODEOWNERS;
   - wajib status check hijau (`bun run check`, `bun test`) dan branch up-to-date;
   - larang force-push dan penghapusan `main`;
   - wajib percakapan PR terselesaikan sebelum merge.

## Konsekuensi

- Dokumen `CONTRIBUTING.md` menjadi panduan operasional alur ini.
- Penerapan proteksi branch menunggu keputusan pemilik repo; sampai itu, aturan bersifat konvensi.
- ADR ini immutable; perubahan alur = ADR baru.
