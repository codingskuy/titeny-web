/**
 * Uji kontrak sisi konsumen (Pact V3) untuk klien `src/lib/api.ts` + `klien.ts`.
 * Konsumen: titeny-web. Provider: titeny-backend-service. Berkas keluar: pacts/.
 * Bentuk respons diturunkan dari docs/api/openapi.yaml (backend, PR #10). Matcher dipakai
 * agar kontrak mengunci TIPE/POLA, bukan nilai contoh.
 */
import { describe, expect, test } from 'bun:test';
import { MatchersV3, PactV3 } from '@pact-foundation/pact';
import path from 'node:path';
import { buatApi } from '../../src/lib/api';
import { buatKlien, GalatApi } from '../../src/lib/klien';
import { buatSesi } from '../../src/lib/sesi';

const { like, regex, integer, eachLike, boolean } = MatchersV3;
const JSON_HDR = { 'Content-Type': 'application/json' };
const ISO = regex(/^\d{4}-\d{2}-\d{2}T.+$/, '2026-10-04T04:00:12+07:00');
const PIN = '482013';

const pact = new PactV3({
  consumer: 'titeny-web',
  provider: 'titeny-backend-service',
  dir: path.resolve(import.meta.dir, '../../pacts'),
  logLevel: 'error'
});

/** Klien nyata (tanpa cache/penyimpanan) diarahkan ke mock server Pact. */
function api(mockUrl: string, masuk?: (s: ReturnType<typeof buatSesi>) => void) {
  const sesi = buatSesi({});
  masuk?.(sesi);
  return buatApi(buatKlien({ basis: `${mockUrl}/api/v1`, sesi }));
}

describe('kontrak titeny-web -> titeny-backend-service', () => {
  test('GET /api/v1/kesehatan', async () => {
    pact
      .given('layanan sehat dan prediksi sudah dihitung')
      .uponReceiving('permintaan kesehatan tanpa kredensial')
      .withRequest({ method: 'GET', path: '/api/v1/kesehatan' })
      .willRespondWith({
        status: 200,
        headers: JSON_HDR,
        body: { status: 'ok', job_terakhir: ISO, versi_api: like('v1.0.0') }
      });
    await pact.executeTest(async (mock) => {
      const r = await api(mock.url).kesehatan();
      expect(r.data.status).toBe('ok');
      expect(r.basi).toBe(false);
    });
  });

  test('GET /api/v1/harga dengan PIN zona petani', async () => {
    pact
      .given('prediksi harga cabai merah di pasar zona PIN tersedia')
      .uponReceiving('permintaan harga H+1..H+7 dengan X-Zona-PIN')
      .withRequest({
        method: 'GET',
        path: '/api/v1/harga',
        query: { komoditas_id: 'cmd_cabai_merah', pasar_id: 'psr_jakarta_timur_01' },
        headers: { 'X-Zona-PIN': PIN }
      })
      .willRespondWith({
        status: 200,
        headers: JSON_HDR,
        body: {
          komoditas_id: 'cmd_cabai_merah',
          pasar_id: 'psr_jakarta_timur_01',
          deret: eachLike({
            tanggal: regex(/^\d{4}-\d{2}-\d{2}$/, '2026-10-05'),
            horizon: regex(/^H\+[1-7]$/, 'H+1'),
            harga_prediksi: integer(42500),
            rentang_bawah: integer(39000),
            rentang_atas: integer(46000),
            kepercayaan: regex(/^(tinggi|sedang|rendah)$/, 'sedang')
          }),
          model_version: like('harga_v1.0.0'),
          dihitung_pada: ISO
        }
      });
    await pact.executeTest(async (mock) => {
      const a = api(mock.url, (s) => s.masukDenganPin('petani', PIN));
      const r = await a.harga({ komoditas_id: 'cmd_cabai_merah', pasar_id: 'psr_jakarta_timur_01' });
      expect(r.data.deret[0].horizon).toBe('H+1');
      expect(r.data.deret[0].harga_prediksi).toBe(42500);
    });
  });

  test('GET /api/v1/harga tanpa kredensial -> 401 amplop Galat', async () => {
    pact
      .given('permintaan tanpa kredensial')
      .uponReceiving('permintaan harga tanpa PIN atau token')
      .withRequest({
        method: 'GET',
        path: '/api/v1/harga',
        query: { komoditas_id: 'cmd_cabai_merah', pasar_id: 'psr_jakarta_timur_01' }
      })
      .willRespondWith({
        status: 401,
        headers: JSON_HDR,
        body: { error: { kode: 'tidak_berhak', pesan: like('Token kedaluwarsa.') } }
      });
    await pact.executeTest(async (mock) => {
      const err = await api(mock.url)
        .harga({ komoditas_id: 'cmd_cabai_merah', pasar_id: 'psr_jakarta_timur_01' })
        .catch((e) => e);
      expect(err).toBeInstanceOf(GalatApi);
      expect((err as GalatApi).status).toBe(401);
      expect((err as GalatApi).kode).toBe('tidak_berhak');
    });
  });

  test('GET /api/v1/rekomendasi dengan PIN zona vendor', async () => {
    pact
      .given('rekomendasi untuk zona PIN vendor tersedia')
      .uponReceiving('permintaan daftar rekomendasi dengan limit')
      .withRequest({
        method: 'GET',
        path: '/api/v1/rekomendasi',
        query: { limit: '5', zona: 'jakarta_timur' },
        headers: { 'X-Zona-PIN': PIN }
      })
      .willRespondWith({
        status: 200,
        headers: JSON_HDR,
        body: {
          data: eachLike({
            id: like('rek_001'),
            zona: like('jakarta_timur'),
            teks: eachLike('Tambah stok cabai merah sekitar 300 kg.'),
            status: regex(/^(baru|dikerjakan|selesai)$/, 'baru')
          }),
          next_cursor: null
        }
      });
    await pact.executeTest(async (mock) => {
      const a = api(mock.url, (s) => s.masukDenganPin('vendor', PIN));
      const r = await a.rekomendasi({ zona: 'jakarta_timur', limit: 5 });
      expect(r.data.data[0].status).toBe('baru');
      expect(r.data.next_cursor).toBeNull();
    });
  });

  test('POST /api/v1/auth/login akun CEO -> tantangan OTP', async () => {
    pact
      .given('akun CEO ada dan kata sandi benar')
      .uponReceiving('login CEO langkah 1')
      .withRequest({
        method: 'POST',
        path: '/api/v1/auth/login',
        headers: JSON_HDR,
        body: { username: 'ceo-titeny', password: 'rahasia-uji' }
      })
      .willRespondWith({
        status: 200,
        headers: JSON_HDR,
        body: { sesi_id: like('sesi_abc123'), otp_diperlukan: boolean(true) }
      });
    await pact.executeTest(async (mock) => {
      const r = await api(mock.url).authLogin('ceo-titeny', 'rahasia-uji');
      expect('sesi_id' in r.data).toBe(true);
      expect('access_token' in r.data).toBe(false);
    });
  });

  test('POST /api/v1/auth/login kredensial salah -> 401 amplop Galat', async () => {
    pact
      .given('akun CEO ada dan kata sandi benar')
      .uponReceiving('login dengan kata sandi salah')
      .withRequest({
        method: 'POST',
        path: '/api/v1/auth/login',
        headers: JSON_HDR,
        body: { username: 'ceo-titeny', password: 'salah' }
      })
      .willRespondWith({
        status: 401,
        headers: JSON_HDR,
        body: { error: { kode: 'tidak_berhak', pesan: like('Kredensial tidak valid.') } }
      });
    await pact.executeTest(async (mock) => {
      const err = await api(mock.url)
        .authLogin('ceo-titeny', 'salah')
        .catch((e) => e);
      expect(err).toBeInstanceOf(GalatApi);
      expect((err as GalatApi).status).toBe(401);
    });
  });

  test('POST /api/v1/auth/otp/verifikasi -> pasangan token', async () => {
    pact
      .given('sesi OTP aktif dengan kode 123456')
      .uponReceiving('verifikasi OTP benar')
      .withRequest({
        method: 'POST',
        path: '/api/v1/auth/otp/verifikasi',
        headers: JSON_HDR,
        body: { sesi_id: 'sesi_abc123', otp: '123456' }
      })
      .willRespondWith({
        status: 200,
        headers: JSON_HDR,
        body: {
          access_token: like('eyJhbGciOiJIUzI1NiJ9.x.y'),
          refresh_token: like('rt_abc'),
          token_type: 'Bearer',
          expires_in: integer(900),
          peran: regex(/^(ceo|analis|layanan)$/, 'ceo')
        }
      });
    await pact.executeTest(async (mock) => {
      const r = await api(mock.url).authOtp('sesi_abc123', '123456');
      expect(r.data.token_type).toBe('Bearer');
      expect(r.data.expires_in).toBe(900);
    });
  });
});
