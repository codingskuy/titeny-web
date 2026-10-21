import { describe, expect, test } from 'bun:test';
import { buatAnalitik, type Peristiwa } from '../src/lib/analitik';

function siapkan(peran: 'petani' | 'vendor' | 'ceo' | null = 'petani') {
  const keluar: Peristiwa[] = [];
  const a = buatAnalitik({
    sink: (p) => void keluar.push(p),
    peran: () => peran,
    sekarang: () => new Date('2026-10-04T00:00:00Z')
  });
  return { a, keluar };
}

describe('analitik', () => {
  test('papan.dibuka memuat peran, komoditas, zona, model_version', () => {
    const { a, keluar } = siapkan();
    a.catat({ nama: 'papan.dibuka', komoditas_id: 'cmd_cabai_merah', zona: 'bekasi_utara', model_version: 'harga_v1.0.0' });
    expect(keluar).toEqual([
      {
        nama: 'papan.dibuka',
        peran: 'petani',
        komoditas_id: 'cmd_cabai_merah',
        zona: 'bekasi_utara',
        model_version: 'harga_v1.0.0',
        waktu: '2026-10-04T00:00:00.000Z'
      }
    ]);
  });

  test('kartu.terlihat hanya sekali per kartu per halaman', () => {
    const { a, keluar } = siapkan();
    a.catat({ nama: 'kartu.terlihat', kartu: 'harga', komoditas_id: 'cmd_cabai_merah' });
    a.catat({ nama: 'kartu.terlihat', kartu: 'harga', komoditas_id: 'cmd_cabai_merah' });
    a.catat({ nama: 'kartu.terlihat', kartu: 'keputusan', komoditas_id: 'cmd_cabai_merah' });
    expect(keluar.length).toBe(2);
    a.resetHalaman();
    a.catat({ nama: 'kartu.terlihat', kartu: 'harga', komoditas_id: 'cmd_cabai_merah' });
    expect(keluar.length).toBe(3);
  });

  test('menolak field di luar skema (tanpa data pribadi / PIN / komentar)', () => {
    const { a, keluar } = siapkan();
    const jahat = { nama: 'umpan_balik.diberi', pin: '482013', komentar: 'telepon saya 0812' } as never;
    expect(a.catat(jahat)).toBeNull();
    expect(keluar.length).toBe(0);
  });

  test('menolak nilai bebas yang bisa memuat data pribadi', () => {
    const { a } = siapkan();
    expect(a.catat({ nama: 'papan.dibuka', zona: 'Budi Santoso 0812' })).toBeNull();
    expect(a.catat({ nama: 'papan.dibuka', komoditas_id: 'cabai' })).toBeNull();
  });

  test('tanpa sesi tidak ada peristiwa', () => {
    const { a, keluar } = siapkan(null);
    expect(a.catat({ nama: 'papan.dibuka' })).toBeNull();
    expect(keluar.length).toBe(0);
  });

  test('galat sink tidak merusak pemanggil', () => {
    const a = buatAnalitik({
      sink: () => {
        throw new Error('boom');
      },
      peran: () => 'ceo'
    });
    expect(() => a.catat({ nama: 'papan.dibuka' })).not.toThrow();
  });
});
