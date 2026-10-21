# ADR-0005 — Papan vendor: asumsi atas kontrak

- **Status**: Diterima
- **Tanggal**: 2026-10-21

## Konteks
TTN-WEB-003 (issue #3) memakai `GET /harga`, `GET /demand`, `GET /kesehatan` dari openapi.yaml (backend PR #10, commit 5447ae9). Beberapa butir acceptance tidak punya padanan eksplisit di kontrak.

## Keputusan
1. **Saran stok** = (demand H+7 / 7) x 1,15 - stok di tangan, dihitung di klien dalam sen-kg (integer), minimal 0. Ini satu-satunya hitungan klien yang ditetapkan produk; angka demand/harga tidak dihitung ulang.
2. **Stok di tangan** tersimpan di localStorage perangkat (`ttn.vendor.stok`); tidak dikirim ke server.
3. **Warna peringatan** dari `sinyal` kontrak (surplus|seimbang|defisit): hijau = seimbang, merah = defisit, kuning "Waspada" = surplus (kontrak tidak punya nilai "waspada"). Selalu disertai teks dan ikon.
4. **"Estimasi — transaksi kemarin belum masuk"**: kontrak tidak punya penanda S3 telat. Proksi: ditampilkan bila `job_terakhir` (/kesehatan) atau `tanggal` demand lebih lama dari hari ini (WIB). Perlu penanda eksplisit dari backend.
5. **Parameter `zona`**: opsional di URL (`?zona=`); untuk PIN zona kontrak menyebut diisi otomatis. 12 komoditas x (harga + demand) dimuat paralel (24 permintaan, di bawah batas 60/menit); polling 30 menit.
