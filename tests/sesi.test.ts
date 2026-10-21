import { describe, expect, test } from 'bun:test';
import { buatSesi, type Penyimpanan } from '../src/lib/sesi';

function memori(): Penyimpanan & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k)
  };
}

describe('sesi', () => {
  test('petani: PIN dikirim sebagai X-Zona-PIN', () => {
    const s = buatSesi({ penyimpanan: memori() });
    expect(s.headerAuth()).toEqual({});
    s.masukDenganPin('petani', '482013');
    expect(s.headerAuth()).toEqual({ 'X-Zona-PIN': '482013' });
    expect(s.snapshot()).toEqual({ masuk: true, peran: 'petani' });
    expect(s.jenisAuth()).toBe('pin');
  });

  test('menolak PIN bukan 6 digit', () => {
    const s = buatSesi({});
    expect(() => s.masukDenganPin('vendor', '12345')).toThrow();
    expect(() => s.masukDenganPin('vendor', '12345a')).toThrow();
    expect(s.snapshot().masuk).toBe(false);
  });

  test('CEO: token Bearer, tidak pernah disimpan ke penyimpanan', () => {
    const p = memori();
    const s = buatSesi({ penyimpanan: p });
    s.masukDenganToken({ access_token: 'AKSES', refresh_token: 'REFRESH', expires_in: 900 });
    expect(s.headerAuth()).toEqual({ Authorization: 'Bearer AKSES' });
    expect(s.refreshToken()).toBe('REFRESH');
    expect([...p.data.values()].join('|')).not.toContain('AKSES');
    expect([...p.data.values()].join('|')).not.toContain('REFRESH');
    // sesi baru (muat ulang) tidak memulihkan token
    expect(buatSesi({ penyimpanan: p }).snapshot().masuk).toBe(false);
  });

  test('PIN dipulihkan dari sessionStorage dan dihapus saat keluar', () => {
    const p = memori();
    buatSesi({ penyimpanan: p }).masukDenganPin('vendor', '111222');
    const baru = buatSesi({ penyimpanan: p });
    expect(baru.snapshot()).toEqual({ masuk: true, peran: 'vendor' });
    baru.keluar();
    expect(baru.headerAuth()).toEqual({});
    expect(buatSesi({ penyimpanan: p }).snapshot().masuk).toBe(false);
  });

  test('data rusak di penyimpanan diabaikan', () => {
    const p = memori();
    p.setItem('ttn.sesi.pin', '{bukan json');
    expect(buatSesi({ penyimpanan: p }).snapshot().masuk).toBe(false);
    p.setItem('ttn.sesi.pin', JSON.stringify({ peran: 'ceo', pin: '123456' }));
    expect(buatSesi({ penyimpanan: p }).snapshot().masuk).toBe(false);
  });

  test('akses hampir kedaluwarsa memakai jam injeksi', () => {
    let t = 0;
    const s = buatSesi({ sekarang: () => t });
    s.masukDenganToken({ access_token: 'a', refresh_token: 'r', expires_in: 900 });
    expect(s.aksesHampirKedaluwarsa()).toBe(false);
    t = 880_000;
    expect(s.aksesHampirKedaluwarsa()).toBe(true);
  });

  test('pendengar dipanggil saat masuk dan keluar', () => {
    const s = buatSesi({});
    let n = 0;
    const lepas = s.langgan(() => n++);
    s.masukDenganPin('petani', '000000');
    s.keluar();
    lepas();
    s.masukDenganPin('petani', '000000');
    expect(n).toBe(2);
  });
});
