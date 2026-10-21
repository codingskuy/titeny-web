# ADR-0002: Tooling uji kontrak dan E2E (Pact, Schemathesis, Maestro)

- Status: Diterima
- Tanggal: 2026-10-22

## Konteks
Siklus 2 (UJI) butuh uji kontrak konsumen, uji properti terhadap spec, dan E2E web. Mode web Maestro masih beta.
Nomor ADR-0002 dicadangkan untuk keputusan ini (urutan ADR sebelumnya melompat dari 0001 ke 0003).

## Keputusan
- **Pact**: `@pact-foundation/pact` 13.2.0 (exact, devDependency), Pact V3, konsumen `titeny-web`, provider `titeny-backend-service`.
  Uji memakai klien `src/lib` nyata ke mock server Pact; berkas `pacts/` dikomit. Verifikasi provider dikerjakan di repo backend.
- **Schemathesis**: dijalankan lewat `uvx` (tanpa dependensi proyek), skrip `contract/schemathesis.sh` terhadap spec milik backend
  (tidak disalin), 5 grup kredensial, telemetri mati, workflow `workflow_dispatch` manual.
- **Maestro**: CLI >= 2 (terpasang di luar proyek), alur di `.maestro/`, selector `id` HTML, harness mock API Bun + Vite dev.
  Karena mode web beta, E2E tidak menjadi gerbang rilis; `bun test` (unit + Pact) tetap gerbang. Fallback bila Maestro web
  tak stabil: uji komponen/logika murni yang sudah ada dan Playwright sebagai kandidat (belum dipilih).
- Usulan proteksi `main` (hanya usulan, tidak diterapkan): wajib `bun test` dan `bun run check` hijau sebelum merge.

## Konsekuensi
- Mode web Maestro terbukti layak lokal (3/3 alur lulus) tetapi lambat (16-40 dtk per alur) dan elemen di luar viewport
  perlu `scrollUntilVisible`.
- Telemetri alat dimatikan (`MAESTRO_CLI_NO_ANALYTICS`, `SCHEMATHESIS_TELEMETRY=off`, `E2E_TELEMETRY_DISABLED=1`).
- Nilai uji (PIN 482013, sandi seed) hanya data lokal, bukan rahasia.
