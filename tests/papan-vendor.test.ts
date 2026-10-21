import { describe, expect, test } from 'bun:test';
import {
  adalahEstimasi,
  buatBaris,
  buatPenyimpananStok,
  muatVendor,
  parseKg,
  peringatanDariSinyal,
  saranStokKg
} from '../src/lib/papan/vendor';
import type { Penyimpanan } from '../src/lib/sesi';
import type { Bagian } from '../src/lib/papan/muat';
import type { PrediksiDemand, PrediksiHargaRespons } from '../src/lib/kontrak';

describe('saran stok', () => {
  test('demand harian rerata x 1,15 - stok: 840 kg/7 = 120 x 1,15 = 138; stok 38 -> 100', () => {
    expect(saranStokKg(840, 0)).toBe(138);
    expect(saranStokKg(840, 38)).toBe(100);
  });
  test('stok melebihi kebutuhan -> 0 (tidak negatif)', () => {
    expect(saranStokKg(840, 500)).toBe(0);
  });
  test('presisi sen-kg tanpa galat floating point', () => {
    expect(saranStokKg(100, 0)).toBe(16.43); // 100*115/7 = 1642.857 sen -> 1643
    expect(saranStokKg(7, 0.1)).toBe(1.05); // 1.15 - 0.10
  });
  test('parseKg menerima koma/titik, menolak negatif dan sampah', () => {
    expect(parseKg('12,5')).toBe(12.5);
    expect(parseKg(' 30 ')).toBe(30);
    expect(parseKg('-3')).toBeNull();
    expect(parseKg('abc')).toBeNull();
    expect(parseKg('')).toBeNull();
    expect(parseKg('1.234')).toBeNull();
  });
});

function memori(): Penyimpanan {
  const m = new Map<string, string>();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k) };
}

describe('stok tersimpan lokal', () => {
  test('simpan, baca ulang, hapus', () => {
    const m = memori();
    const a = buatPenyimpananStok(m);
    a.simpan('cmd_cabai_merah', 38);
    a.simpan('cmd_telur_ayam', 5.5);
    expect(buatPenyimpananStok(m).baca()).toEqual({ cmd_cabai_merah: 38, cmd_telur_ayam: 5.5 });
    a.simpan('cmd_cabai_merah', null);
    expect(a.baca()).toEqual({ cmd_telur_ayam: 5.5 });
  });
  test('penyimpanan null / data rusak tidak melempar', () => {
    expect(buatPenyimpananStok(null).baca()).toEqual({});
    expect(() => buatPenyimpananStok(null).simpan('x', 1)).not.toThrow();
    const m = memori();
    m.setItem('ttn.vendor.stok', '{bukan json');
    expect(buatPenyimpananStok(m).baca()).toEqual({});
  });
});

describe('peringatan warna + teks', () => {
  test('hijau seimbang, kuning waspada, merah defisit', () => {
    expect(peringatanDariSinyal('seimbang')).toEqual({ kunci: 'hijau', teks: 'Seimbang' });
    expect(peringatanDariSinyal('surplus').kunci).toBe('kuning');
    expect(peringatanDariSinyal('defisit')).toEqual({ kunci: 'merah', teks: 'Defisit' });
  });
});

const hargaOk = (h1: number): Bagian<PrediksiHargaRespons> => ({
  status: 'ok',
  basi: false,
  diambilPada: 'x',
  data: {
    komoditas_id: 'cmd_cabai_merah',
    pasar_id: 'psr_a',
    model_version: 'harga_v1.0.0',
    dihitung_pada: 'x',
    deret: [{ tanggal: '2026-10-05', horizon: 'H+1', harga_prediksi: h1, rentang_bawah: h1, rentang_atas: h1, kepercayaan: 'sedang' }]
  }
});
const demandOk = (kg: number, sinyal: PrediksiDemand['sinyal'], tanggal?: string): Bagian<PrediksiDemand> => ({
  status: 'ok',
  basi: false,
  diambilPada: 'x',
  data: { komoditas_id: 'cmd_cabai_merah', zona: 'bekasi_utara', horizon: 'H+7_total_kg', demand_prediksi_kg: kg, sinyal, model_version: 'demand_v1.0.0', tanggal }
});

describe('baris tabel besok', () => {
  const K = { id: 'cmd_cabai_merah', nama: 'Cabai merah' };
  test('memuat harga besok (H+1), demand H+7, saran, peringatan', () => {
    const b = buatBaris(K, hargaOk(42500), demandOk(840, 'defisit'), 38);
    expect(b).toMatchObject({ hargaBesok: 42500, demand7: 840, saran: 100, status: 'ok', zona: 'bekasi_utara' });
    expect(b.peringatan?.kunci).toBe('merah');
  });
  test('demand kosong -> status kosong dengan pesan, tanpa angka rekaan', () => {
    const b = buatBaris(K, hargaOk(1), { status: 'kosong', pesan: 'Data demand belum cukup.' }, 0);
    expect(b).toMatchObject({ status: 'kosong', pesan: 'Data demand belum cukup.', demand7: null, saran: null });
  });
});

describe('estimasi bila data tertinggal', () => {
  const b = (tgl: string | undefined) => buatBaris({ id: 'a', nama: 'A' }, hargaOk(1), demandOk(7, 'seimbang', tgl), 0);
  test('job_terakhir kemarin -> estimasi; hari ini -> bukan', () => {
    expect(adalahEstimasi('2026-10-05', '2026-10-04T04:30:00+07:00', [b(undefined)])).toBe(true);
    expect(adalahEstimasi('2026-10-05', '2026-10-05T04:30:00+07:00', [b(undefined)])).toBe(false);
  });
  test('tanggal demand lebih lama dari hari ini -> estimasi', () => {
    expect(adalahEstimasi('2026-10-05', null, [b('2026-10-04')])).toBe(true);
    expect(adalahEstimasi('2026-10-05', null, [b('2026-10-05')])).toBe(false);
  });
});

describe('muatVendor', () => {
  test('12 komoditas dimuat, kegagalan satu baris tidak menjatuhkan lainnya', async () => {
    const ok = <T>(data: T) => Promise.resolve({ data, basi: false, diambilPada: 'x' });
    const api = {
      kesehatan: () => ok({ status: 'ok', job_terakhir: '2026-10-05T04:30:00+07:00', versi_api: 'v1.0.0' }),
      harga: (q: { komoditas_id: string }) =>
        q.komoditas_id === 'cmd_kangkung' ? Promise.reject(new Error('x')) : ok(hargaOk(1).status === 'ok' ? (hargaOk(1) as { data: unknown }).data : null),
      demand: () => ok(demandOk(7, 'seimbang').status === 'ok' ? (demandOk(7, 'seimbang') as { data: unknown }).data : null)
    };
    const r = await muatVendor(api as never, { zona: 'bekasi_utara' });
    expect(r.mentah.length).toBe(12);
    expect(r.mentah.filter((m) => m.harga.status === 'galat').length).toBe(1);
    expect(r.jobTerakhir).toBe('2026-10-05T04:30:00+07:00');
  });
});
