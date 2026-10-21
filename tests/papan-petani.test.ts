import { describe, expect, test } from 'bun:test';
import { akurasiTerbatas, tentukanKeputusan } from '../src/lib/papan/keputusan';
import { hitungGrafik } from '../src/lib/papan/grafik';
import { muatPetani } from '../src/lib/papan/muat';
import { GalatApi } from '../src/lib/klien';
import type { PrediksiHarga } from '../src/lib/kontrak';

type K = PrediksiHarga['kepercayaan'];
const titik = (h: number, harga: number, kep: K = 'sedang', tanggal = `2026-10-0${h + 4}`): PrediksiHarga => ({
  tanggal,
  horizon: `H+${h}` as PrediksiHarga['horizon'],
  harga_prediksi: harga,
  rentang_bawah: harga - 3000,
  rentang_atas: harga + 3000,
  kepercayaan: kep
});
const deret = (h1: number, h3: number, kep: K = 'sedang') => [titik(1, h1), titik(2, (h1 + h3) / 2), titik(3, h3, kep)];
const HARI = '2026-10-04'; // tidak ada titik hari ini -> acuan H+1

describe('lencana keputusan petani', () => {
  test('H+3 naik tepat 8% + kepercayaan sedang -> TAHAN 3 HARI', () => {
    const k = tentukanKeputusan(deret(50000, 54000, 'sedang'), HARI);
    expect(k.lencana).toBe('TAHAN 3 HARI');
    expect(k.alasan).toContain('naik 8%');
  });
  test('naik 7,98% tidak cukup -> CICIL JUAL', () => {
    expect(tentukanKeputusan(deret(50000, 53990), HARI).lencana).toBe('CICIL JUAL');
  });
  test('naik >= 8% tapi kepercayaan rendah -> CICIL JUAL (tidak TAHAN)', () => {
    const k = tentukanKeputusan(deret(50000, 56000, 'rendah'), HARI);
    expect(k.lencana).toBe('CICIL JUAL');
    expect(k.alasan).toContain('kepercayaan rendah');
  });
  test('kepercayaan tinggi juga boleh TAHAN', () => {
    expect(tentukanKeputusan(deret(50000, 56000, 'tinggi'), HARI).lencana).toBe('TAHAN 3 HARI');
  });
  test('turun tepat 8% -> JUAL SEKARANG, tanpa syarat kepercayaan', () => {
    expect(tentukanKeputusan(deret(50000, 46000, 'rendah'), HARI).lencana).toBe('JUAL SEKARANG');
    expect(tentukanKeputusan(deret(50000, 46010), HARI).lencana).toBe('CICIL JUAL');
  });
  test('contoh PRD: Rp42.000 -> naik 9% (45.780) kepercayaan sedang = TAHAN', () => {
    const d = [titik(1, 42000, 'sedang', HARI), titik(3, 45780, 'sedang')];
    const k = tentukanKeputusan(d, HARI);
    expect(k.lencana).toBe('TAHAN 3 HARI');
    expect(k.acuan?.tanggal).toBe(HARI);
  });
  test('titik hari ini diutamakan sebagai acuan; tanpa H+3 -> CICIL JUAL', () => {
    expect(tentukanKeputusan([titik(1, 50000)], HARI).lencana).toBe('CICIL JUAL');
    expect(tentukanKeputusan([], HARI).alasan).toContain('belum lengkap');
  });
  test('akurasi terbatas bila ada titik kepercayaan rendah', () => {
    expect(akurasiTerbatas(deret(50000, 50000, 'rendah'))).toBe(true);
    expect(akurasiTerbatas(deret(50000, 50000, 'tinggi'))).toBe(false);
  });
});

describe('geometri grafik', () => {
  const t = [
    { label: 'H+1', nilai: 100, bawah: 90, atas: 110 },
    { label: 'H+2', nilai: 120, bawah: 100, atas: 140 }
  ];
  test('titik dalam bingkai, pita menutup, y terbalik (nilai besar = y kecil)', () => {
    const g = hitungGrafik(t, 360, 200);
    expect(g.yMin).toBe(90);
    expect(g.yMaks).toBe(140);
    expect(g.titik[1].y).toBeLessThan(g.titik[0].y);
    expect(g.titik.every((p) => p.x >= 0 && p.x <= 360 && p.y >= 0 && p.y <= 200)).toBe(true);
    expect(g.pita.endsWith('Z')).toBe(true);
    expect(g.garis.startsWith('M')).toBe(true);
  });
  test('data datar / kosong tidak menghasilkan NaN', () => {
    const datar = hitungGrafik([{ label: 'a', nilai: 5, bawah: 5, atas: 5 }]);
    expect(datar.garis).not.toContain('NaN');
    expect(hitungGrafik([]).garis).toBe('');
  });
});

const ok = <T>(data: T, basi = false) => Promise.resolve({ data, basi, diambilPada: '2026-10-04T05:00:00.000Z' });

describe('pemuatan papan petani', () => {
  const harga = { komoditas_id: 'cmd_cabai_merah', pasar_id: 'psr_x', deret: [], model_version: 'harga_v1.0.0', dihitung_pada: 'x' };
  test('harga + panen (komoditas panen) dimuat paralel', async () => {
    const s = await muatPetani(
      { harga: () => ok(harga), panen: () => ok({ deret: [] }) } as never,
      { komoditas_id: 'cmd_cabai_merah' }
    );
    expect(s.harga.status).toBe('ok');
    expect(s.panen?.status).toBe('ok');
  });
  test('komoditas tanpa model panen: panen null, tidak memanggil API panen', async () => {
    let n = 0;
    const s = await muatPetani(
      { harga: () => ok(harga), panen: () => ((n++), ok({ deret: [] })) } as never,
      { komoditas_id: 'cmd_kangkung' }
    );
    expect(s.panen).toBeNull();
    expect(n).toBe(0);
  });
  test('404 data_belum_cukup -> keadaan kosong "Data harga belum cukup."', async () => {
    const s = await muatPetani(
      {
        harga: () => Promise.reject(new GalatApi(404, 'data_belum_cukup', 'x')),
        panen: () => ok({ deret: [] })
      } as never,
      { komoditas_id: 'cmd_cabai_merah' }
    );
    expect(s.harga).toEqual({ status: 'kosong', pesan: 'Data harga belum cukup.' });
    expect(s.panen?.status).toBe('ok');
  });
  test('timeout dengan cache: data basi + stempel dibawa; tanpa cache: galat', async () => {
    const a = await muatPetani({ harga: () => ok(harga, true), panen: () => ok({ deret: [] }) } as never, { komoditas_id: 'cmd_cabai_merah' });
    expect(a.harga.status === 'ok' && a.harga.basi).toBe(true);
    const b = await muatPetani(
      { harga: () => Promise.reject(new GalatApi(0, 'timeout', 'x')), panen: () => ok({ deret: [] }) } as never,
      { komoditas_id: 'cmd_cabai_merah' }
    );
    expect(b.harga).toEqual({ status: 'galat', pesan: 'Server terlalu lama menjawab. Coba lagi.' });
  });
});
