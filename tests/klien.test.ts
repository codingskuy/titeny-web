import { describe, expect, test } from 'bun:test';
import { buatApi } from '../src/lib/api';
import { buatKlien, GalatApi } from '../src/lib/klien';
import { buatSesi, type Penyimpanan } from '../src/lib/sesi';

const json = (b: unknown, status = 200, h: Record<string, string> = {}) =>
  new Response(JSON.stringify(b), { status, headers: { 'Content-Type': 'application/json', ...h } });

function memori(): Penyimpanan {
  const m = new Map<string, string>();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k) };
}

const HARGA = {
  komoditas_id: 'cmd_cabai_merah',
  pasar_id: 'psr_jakarta_timur_01',
  deret: [
    { tanggal: '2026-10-05', horizon: 'H+1', harga_prediksi: 42500, rentang_bawah: 39000, rentang_atas: 46000, kepercayaan: 'sedang' }
  ],
  model_version: 'harga_v1.0.0',
  dihitung_pada: '2026-10-04T04:00:12+07:00'
};

type Panggilan = { url: string; init: RequestInit };
function palsu(urutan: Array<() => Response | Promise<Response>>) {
  const log: Panggilan[] = [];
  let i = 0;
  const f = (async (url: string, init: RequestInit) => {
    log.push({ url, init });
    const fn = urutan[Math.min(i++, urutan.length - 1)];
    return fn();
  }) as unknown as typeof fetch;
  return { f, log };
}

describe('klien API', () => {
  test('petani: kirim X-Zona-PIN dan query terurut tanpa nilai kosong', async () => {
    const sesi = buatSesi({});
    sesi.masukDenganPin('petani', '482013');
    const { f, log } = palsu([() => json(HARGA)]);
    const api = buatApi(buatKlien({ fetch: f, sesi }));
    const h = await api.harga({ komoditas_id: 'cmd_cabai_merah', pasar_id: undefined, dari: '2026-10-05' });
    expect(h.basi).toBe(false);
    expect(h.data.deret[0].harga_prediksi).toBe(42500);
    expect(log[0].url).toBe('/api/v1/harga?dari=2026-10-05&komoditas_id=cmd_cabai_merah');
    expect((log[0].init.headers as Record<string, string>)['X-Zona-PIN']).toBe('482013');
  });

  test('endpoint tanpa auth tidak mengirim kredensial', async () => {
    const sesi = buatSesi({});
    sesi.masukDenganPin('vendor', '123456');
    const { f, log } = palsu([() => json({ status: 'ok', job_terakhir: null, versi_api: 'v1.0.0' })]);
    await buatApi(buatKlien({ fetch: f, sesi })).kesehatan();
    expect((log[0].init.headers as Record<string, string>)['X-Zona-PIN']).toBeUndefined();
  });

  test('timeout: mengembalikan cache terakhir + stempel waktu (basi)', async () => {
    const sesi = buatSesi({});
    sesi.masukDenganPin('petani', '482013');
    const cache = memori();
    const sekarang = () => new Date('2026-10-04T05:00:00Z');
    const ok = palsu([() => json(HARGA)]);
    await buatApi(buatKlien({ fetch: ok.f, sesi, penyimpananCache: cache, sekarang })).harga({ komoditas_id: 'cmd_cabai_merah' });

    const lambat = (async (_u: string, init: RequestInit) =>
      new Promise((_r, rej) =>
        init.signal!.addEventListener('abort', () => rej(new DOMException('abort', 'AbortError')))
      )) as unknown as typeof fetch;
    const h = await buatApi(buatKlien({ fetch: lambat, sesi, penyimpananCache: cache, timeoutMs: 20 })).harga({
      komoditas_id: 'cmd_cabai_merah'
    });
    expect(h.basi).toBe(true);
    expect(h.diambilPada).toBe('2026-10-04T05:00:00.000Z');
    expect(h.data.model_version).toBe('harga_v1.0.0');
  });

  test('timeout tanpa cache: galat kode timeout', async () => {
    const lambat = (async (_u: string, init: RequestInit) =>
      new Promise((_r, rej) =>
        init.signal!.addEventListener('abort', () => rej(new DOMException('abort', 'AbortError')))
      )) as unknown as typeof fetch;
    const api = buatApi(buatKlien({ fetch: lambat, sesi: buatSesi({}), timeoutMs: 10 }));
    await expect(api.kesehatan()).rejects.toMatchObject({ kode: 'timeout', status: 0 });
  });

  test('cache tidak dibagi antar peran', async () => {
    const cache = memori();
    const a = buatSesi({});
    a.masukDenganPin('petani', '111111');
    await buatApi(buatKlien({ fetch: palsu([() => json(HARGA)]).f, sesi: a, penyimpananCache: cache })).harga({
      komoditas_id: 'cmd_cabai_merah'
    });
    const b = buatSesi({});
    b.masukDenganPin('vendor', '222222');
    const mati = (async () => {
      throw new TypeError('network');
    }) as unknown as typeof fetch;
    await expect(
      buatApi(buatKlien({ fetch: mati, sesi: b, penyimpananCache: cache })).harga({ komoditas_id: 'cmd_cabai_merah' })
    ).rejects.toMatchObject({ kode: 'jaringan' });
  });

  test('amplop galat baku dan Retry-After pada 429', async () => {
    const sesi = buatSesi({});
    sesi.masukDenganPin('petani', '482013');
    const { f } = palsu([
      () => json({ error: { kode: 'kuota_habis', pesan: 'Kuota habis; coba lagi nanti.', field: null } }, 429, { 'Retry-After': '17' })
    ]);
    const api = buatApi(buatKlien({ fetch: f, sesi }));
    const e = (await api.harga({ komoditas_id: 'cmd_x' }).catch((x) => x)) as GalatApi;
    expect(e).toBeInstanceOf(GalatApi);
    expect(e.kode).toBe('kuota_habis');
    expect(e.status).toBe(429);
    expect(e.retryAfter).toBe(17);
  });

  test('404 data_belum_cukup dibawa apa adanya (tidak jatuh ke cache)', async () => {
    const sesi = buatSesi({});
    sesi.masukDenganPin('petani', '482013');
    const { f } = palsu([() => json({ error: { kode: 'data_belum_cukup', pesan: 'Data harga belum cukup.', field: null } }, 404)]);
    const e = (await buatApi(buatKlien({ fetch: f, sesi })).harga({ komoditas_id: 'cmd_x' }).catch((x) => x)) as GalatApi;
    expect(e.kode).toBe('data_belum_cukup');
  });

  test('respons tidak sesuai kontrak ditolak', async () => {
    const { f } = palsu([() => json({ status: 'rusak' })]);
    await expect(buatApi(buatKlien({ fetch: f, sesi: buatSesi({}) })).kesehatan()).rejects.toMatchObject({
      kode: 'respons_tidak_sesuai'
    });
  });

  test('401 Bearer: refresh sekali lalu ulangi dengan token baru', async () => {
    const sesi = buatSesi({});
    sesi.masukDenganToken({ access_token: 'LAMA', refresh_token: 'R1', expires_in: 900 });
    const { f, log } = palsu([
      () => json({ error: { kode: 'tidak_berhak', pesan: 'Token kedaluwarsa.', field: null } }, 401),
      () => json({ access_token: 'BARU', refresh_token: 'R2', token_type: 'Bearer', expires_in: 900, peran: 'ceo' }),
      () => json({ data: [], next_cursor: null })
    ]);
    const api = buatApi(buatKlien({ fetch: f, sesi }));
    const r = await api.rekomendasi({ limit: 5 });
    expect(r.data.data).toEqual([]);
    expect(log.map((l) => l.url)).toEqual(['/api/v1/rekomendasi?limit=5', '/api/v1/auth/refresh', '/api/v1/rekomendasi?limit=5']);
    expect((log[2].init.headers as Record<string, string>).Authorization).toBe('Bearer BARU');
    expect(sesi.refreshToken()).toBe('R2');
  });

  test('401 dan refresh gagal: sesi dikeluarkan', async () => {
    const sesi = buatSesi({});
    sesi.masukDenganToken({ access_token: 'LAMA', refresh_token: 'R1', expires_in: 900 });
    const { f } = palsu([
      () => json({ error: { kode: 'tidak_berhak', pesan: 'x', field: null } }, 401),
      () => json({ error: { kode: 'tidak_berhak', pesan: 'reuse', field: null } }, 401)
    ]);
    const e = (await buatApi(buatKlien({ fetch: f, sesi })).rekomendasi().catch((x) => x)) as GalatApi;
    expect(e.status).toBe(401);
    expect(sesi.snapshot().masuk).toBe(false);
  });

  test('umpan-balik: komentar > 280 karakter ditolak sebelum dikirim; POST tidak di-cache', async () => {
    const sesi = buatSesi({});
    sesi.masukDenganPin('petani', '482013');
    const { f, log } = palsu([() => json({ status: 'diterima' })]);
    const cache = memori();
    const api = buatApi(buatKlien({ fetch: f, sesi, penyimpananCache: cache }));
    expect(() => api.umpanBalik({ nilai: 'bermanfaat', komentar: 'x'.repeat(281) })).toThrow();
    expect(log.length).toBe(0);
    await api.umpanBalik({ nilai: 'kurang_tepat', komentar: 'x'.repeat(280), komoditas_id: 'cmd_cabai_merah' });
    expect(log[0].init.method).toBe('POST');
    expect(JSON.parse(log[0].init.body as string)).toMatchObject({ nilai: 'kurang_tepat' });
    expect(cache.getItem('ttn.cache.petani:/api/v1/umpan-balik')).toBeNull();
  });

  test('login: oneOf tantangan OTP vs token', async () => {
    const { f } = palsu([
      () => json({ sesi_id: 'ses_1', otp_diperlukan: true }),
      () => json({ access_token: 'a', refresh_token: 'r', token_type: 'Bearer', expires_in: 900, peran: 'layanan' })
    ]);
    const api = buatApi(buatKlien({ fetch: f, sesi: buatSesi({}) }));
    const a = await api.authLogin('ceo', 'pw');
    expect('sesi_id' in a.data).toBe(true);
    const b = await api.authLogin('svc', 'pw');
    expect('access_token' in b.data).toBe(true);
  });
});
