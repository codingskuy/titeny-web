import { describe, expect, test } from 'bun:test';
import { teruskan } from '../src/lib/server/proxy';

function palsu(status = 200, bodi: unknown = { ok: 1 }) {
  const log: Array<{ url: string; init: RequestInit }> = [];
  const f = (async (url: string, init: RequestInit) => {
    log.push({ url, init });
    return new Response(JSON.stringify(bodi), {
      status,
      headers: { 'Content-Type': 'application/json', 'Set-Cookie': 'x=1', 'Cache-Control': 'public, max-age=21600' }
    });
  }) as unknown as typeof fetch;
  return { f, log };
}

describe('proxy /api/v1', () => {
  test('meneruskan GET + query dan hanya header auth yang diizinkan', async () => {
    const { f, log } = palsu();
    const r = await teruskan(
      new Request('http://web/api/v1/harga?komoditas_id=cmd_cabai_merah', {
        headers: { 'X-Zona-PIN': '482013', Cookie: 'rahasia=1', 'X-Lain': 'x' }
      }),
      'harga',
      'http://be:8080/',
      f
    );
    expect(log[0].url).toBe('http://be:8080/api/v1/harga?komoditas_id=cmd_cabai_merah');
    const h = log[0].init.headers as Headers;
    expect(h.get('x-zona-pin')).toBe('482013');
    expect(h.get('cookie')).toBeNull();
    expect(h.get('x-lain')).toBeNull();
    expect(r.headers.get('cache-control')).toBe('public, max-age=21600');
    expect(r.headers.get('set-cookie')).toBeNull();
  });

  test('menolak jalur di luar allowlist (event/masuk, analis, traversal)', async () => {
    const { f, log } = palsu();
    for (const p of ['event/masuk', 'analis/validasi', 'harga/../event/masuk', 'x']) {
      const r = await teruskan(new Request('http://web/x', { method: 'POST', body: '{}' }), p, 'http://be', f);
      expect(r.status).toBe(404);
    }
    expect(log.length).toBe(0);
  });

  test('POST rekomendasi status diizinkan, bodi dan idempotency diteruskan', async () => {
    const { f, log } = palsu();
    await teruskan(
      new Request('http://web/x', {
        method: 'POST',
        body: JSON.stringify({ status: 'dikerjakan', catatan: 'ok' }),
        headers: { Authorization: 'Bearer t', 'Content-Type': 'application/json' }
      }),
      'rekomendasi/rek_1/status',
      'http://be',
      f
    );
    expect(log[0].url).toBe('http://be/api/v1/rekomendasi/rek_1/status');
    expect((log[0].init.headers as Headers).get('authorization')).toBe('Bearer t');
  });

  test('bodi > 256 KB ditolak 413; metode lain 405', async () => {
    const { f } = palsu();
    const besar = await teruskan(
      new Request('http://web/x', { method: 'POST', body: 'x'.repeat(256 * 1024 + 1) }),
      'umpan-balik',
      'http://be',
      f
    );
    expect(besar.status).toBe(413);
    const put = await teruskan(new Request('http://web/x', { method: 'PUT' }), 'harga', 'http://be', f);
    expect(put.status).toBe(405);
  });

  test('upstream mati: 502 dengan amplop galat baku', async () => {
    const mati = (async () => {
      throw new TypeError('down');
    }) as unknown as typeof fetch;
    const r = await teruskan(new Request('http://web/x'), 'kesehatan', 'http://be', mati);
    expect(r.status).toBe(502);
    expect((await r.json()).error.kode).toBe('kesalahan_server');
  });
});
