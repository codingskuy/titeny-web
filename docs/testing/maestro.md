# E2E web dengan Maestro

Tiket: TTN-WEB-TEST-MAESTRO. Mode web Maestro masih beta (CLI memberi peringatan "Web support is in Beta"); lihat ADR-0002.

## Menjalankan
Prasyarat: bun, Maestro CLI >= 2 (diuji 2.11.0), Google Chrome.

```sh
bun install
.maestro/jalankan.sh                      # semua alur
.maestro/jalankan.sh .maestro/smoke.yaml  # satu alur
```
Skrip menyalakan mock API (`.maestro/harness/mock-api.ts`, PIN zona valid 482013) dan Vite dev dengan
`TITENY_API_URL` ke mock, lalu `maestro test`. Telemetri Maestro mati.

## Alur
| Berkas | Isi |
|---|---|
| `smoke.yaml` | landing memuat, tiga peran tampil |
| `papan-petani.yaml` | peran petani -> PIN -> kartu harga, tabel, lencana, panen -> kirim umpan-balik |
| `pin-salah.yaml` | PIN salah ditolak, pesan galat tampil |

## Selector
Memakai atribut `id` HTML: `beranda-judul`, `peran-{petani,vendor,ceo}`, `pin`, `tombol-masuk`, `masuk-galat`, `papan-judul`,
`kartu-harga`, `tabel-harga`, `lencana-keputusan`, `kartu-panen`, `tombol-gudang`, `nilai-bermanfaat`, `kirim-umpan-balik`,
`umpan-balik-terima`. Di web, "terlihat" berarti dalam viewport, jadi elemen di bawah layar memakai `scrollUntilVisible`.

## Cakupan dan batas
Papan vendor dan CEO (akun + OTP) belum punya alur; OTP butuh backend/mock tambahan. Mock bukan backend nyata, jadi alur ini
tidak menangkap ketidaksesuaian kontrak (itu tugas Pact dan Schemathesis).
