import { describe, expect, test } from 'bun:test';
import {
  KABUPATEN,
  buatCsv,
  gantiRekomendasi,
  jalankanTerbatas,
  kunciSel,
  muatMatriks,
  transisiBerikut,
  validasiCatatan
} from '../src/lib/papan/ceo';
import { GalatApi } from '../src/lib/klien';

describe('pembatas paralel', () => {
  test('tidak pernah melebihi batas paralel dan menjaga urutan hasil', async () => {
    let aktif = 0;
    let puncak = 0;
    const tugas = Array.from({ length: 20 }, (_, n) => async () => {
      aktif++;
      puncak = Math.max(puncak, aktif);
      await new Promise((r) => setTimeout(r, 2));
      aktif--;
      return n;
    });
    const r = await jalankanTerbatas(tugas, 4);
    expect(puncak).toBeLessThanOrEqual(4);
    expect(r).toEqual(Array.from({ length: 20 }, (_, n) => n));
  });
});

describe('matriks 5 x 12', () => {
  test('60 sel; 404 jadi "Tidak ada data", 429 jadi galat tanpa menjatuhkan sel lain', async () => {
    const ok = (k: string, z: string) =>
      Promise.resolve({
        data: { komoditas_id: k, zona: z, horizon: 'H+7_total_kg', demand_prediksi_kg: 1, sinyal: 'defisit', model_version: 'demand_v1.0.0' },
        basi: false,
        diambilPada: 'x'
      });
    const api = {
      demand: (q: { komoditas_id: string; zona: string }) =>
        q.zona === 'kab_garut'
          ? Promise.reject(new GalatApi(404, 'tidak_ditemukan', 'x'))
          : q.zona === 'kab_malang' && q.komoditas_id === 'cmd_tomat'
            ? Promise.reject(new GalatApi(429, 'kuota_habis', 'x', null, 30))
            : ok(q.komoditas_id, q.zona)
    };
    const m = await muatMatriks(api as never);
    expect(m.size).toBe(60);
    expect(KABUPATEN.length).toBe(5);
    expect(m.get(kunciSel('cmd_tomat', 'kab_garut'))?.sel).toEqual({ status: 'kosong', pesan: 'Tidak ada data.' });
    expect(m.get(kunciSel('cmd_tomat', 'kab_malang'))?.sel.status).toBe('galat');
    expect(m.get(kunciSel('cmd_tomat', 'kab_karawang'))?.sel.status).toBe('ok');
  });
});

describe('rekomendasi', () => {
  test('transisi hanya baru -> dikerjakan -> selesai', () => {
    expect(transisiBerikut('baru')).toBe('dikerjakan');
    expect(transisiBerikut('dikerjakan')).toBe('selesai');
    expect(transisiBerikut('selesai')).toBeNull();
  });
  test('catatan wajib dan maks 140 karakter (dihitung per karakter)', () => {
    expect(validasiCatatan('   ').ok).toBe(false);
    expect(validasiCatatan('a'.repeat(140)).ok).toBe(true);
    expect(validasiCatatan('a'.repeat(141)).ok).toBe(false);
    expect(validasiCatatan('😀'.repeat(140)).ok).toBe(true);
    const r = validasiCatatan('  oke  ');
    expect(r.ok && r.nilai).toBe('oke');
  });
  test('gantiRekomendasi hanya mengganti id yang cocok', () => {
    const a = { id: 'a', zona: 'z', teks: ['x'], status: 'baru' as const };
    const b = { id: 'b', zona: 'z', teks: ['y'], status: 'baru' as const };
    expect(gantiRekomendasi([a, b], { ...b, status: 'dikerjakan' })).toEqual([a, { ...b, status: 'dikerjakan' }]);
  });
});

describe('ekspor CSV terbatas 500 baris', () => {
  test('memotong di 500 dan menandai terpotong', () => {
    const baris = Array.from({ length: 700 }, (_, i) => [`k${i}`, i]);
    const r = buatCsv(['komoditas', 'mape'], baris);
    expect(r.jumlah).toBe(500);
    expect(r.terpotong).toBe(true);
    expect(r.teks.trim().split('\r\n').length).toBe(501);
  });
  test('kutip, koma, dan awalan rumus dinetralkan', () => {
    const r = buatCsv(['a', 'b'], [['x,"y"', '=SUM(A1)'], ['-1+1', 5]]);
    expect(r.teks).toBe('a,b\r\n"x,""y""",\'=SUM(A1)\r\n\'-1+1,5\r\n');
    expect(r.terpotong).toBe(false);
  });
});
