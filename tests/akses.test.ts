import { describe, expect, test } from 'bun:test';
import { peranDariPath, tujuanPenjaga } from '../src/lib/akses';

describe('penjaga papan', () => {
  test('peranDariPath', () => {
    expect(peranDariPath('/insight/petani')).toBe('petani');
    expect(peranDariPath('/insight/ceo/akurasi')).toBe('ceo');
    expect(peranDariPath('/insight/analis')).toBeNull();
    expect(peranDariPath('/masuk')).toBeNull();
  });
  test('belum masuk atau peran beda diarahkan ke Masuk peran papan', () => {
    expect(tujuanPenjaga('/insight/vendor', null)).toBe('/masuk?peran=vendor');
    expect(tujuanPenjaga('/insight/ceo', 'petani')).toBe('/masuk?peran=ceo');
    expect(tujuanPenjaga('/insight/petani', 'petani')).toBeNull();
    expect(tujuanPenjaga('/masuk', null)).toBeNull();
  });
});
