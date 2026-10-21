// Mock API Titeny untuk alur Maestro (bukan backend nyata). Bentuk respons mengikuti openapi.yaml backend.
// PIN zona valid: 482013. Port: MOCK_PORT (default 18921).
const PIN = '482013';
const port = Number(process.env.MOCK_PORT ?? 18921);

const wib = (tambahHari: number) => {
  const d = new Date(Date.now() + tambahHari * 86_400_000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(d); // YYYY-MM-DD
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { 'Content-Type': 'application/json' } });
const galat = (status: number, kode: string, pesan: string) => json({ error: { kode, pesan, field: null } }, status);

Bun.serve({
  port,
  hostname: '127.0.0.1',
  async fetch(req) {
    const u = new URL(req.url);
    const p = u.pathname.replace(/^\/api\/v1/, '');
    if (p === '/kesehatan') return json({ status: 'ok', job_terakhir: new Date().toISOString(), versi_api: 'v1.0.0' });
    if (req.headers.get('x-zona-pin') !== PIN) return galat(401, 'tidak_berhak', 'PIN zona tidak dikenal.');
    if (p === '/rekomendasi') return json({ data: [], next_cursor: null });
    if (p === '/harga') {
      const harga = [42500, 44000, 46500, 47000, 45500, 44500, 44000];
      return json({
        komoditas_id: u.searchParams.get('komoditas_id') ?? 'cmd_cabai_merah',
        pasar_id: 'psr_jakarta_timur_01',
        deret: harga.map((h, i) => ({
          tanggal: wib(i + 1),
          horizon: `H+${i + 1}`,
          harga_prediksi: h,
          rentang_bawah: h - 3500,
          rentang_atas: h + 3500,
          kepercayaan: 'sedang',
          alasan_singkat: 'stok_gudang_72%'
        })),
        model_version: 'harga_v1.0.0',
        dihitung_pada: new Date().toISOString()
      });
    }
    if (p === '/panen') {
      return json({
        deret: [1, 2, 3, 4].map((i) => ({
          komoditas_id: u.searchParams.get('komoditas_id') ?? 'cmd_cabai_merah',
          kabupaten_id: 'kab_brebes',
          minggu: `2026-W${String(40 + i).padStart(2, '0')}`,
          panen_prediksi_kg: 12500,
          rentang_bawah_kg: 11000,
          rentang_atas_kg: 14000,
          kepercayaan: 'tinggi',
          model_version: 'panen_v1.0.0'
        })),
        dihitung_pada: new Date().toISOString(),
        next_cursor: null
      });
    }
    if (p === '/umpan-balik' && req.method === 'POST') return json({ status: 'diterima' });
    return galat(404, 'tidak_ditemukan', 'Jalur mock tidak tersedia.');
  }
});
console.log(`mock API Titeny di http://127.0.0.1:${port}`);
