import { describe, expect, test } from 'bun:test';
import { MatchersV3, PactV3 } from '@pact-foundation/pact';
import path from 'node:path';
import { GalatApi, buatKlien } from '../../src/lib/klien';

const { like, regex, integer, eachLike } = MatchersV3;

const pact = new PactV3({
  consumer: 'titeny-web',
  provider: 'titeny-backend-service',
  dir: path.resolve(import.meta.dir, '../../pacts'),
  logLevel: 'warn'
});

describe('kontrak konsumen titeny-web -> titeny-backend-service', () => {
  test('GET /api/v1/kesehatan', async () => {
    pact
      .given('layanan sehat')
      .uponReceiving('permintaan kesehatan')
      .withRequest({ method: 'GET', path: '/api/v1/kesehatan' })
      .willRespondWith({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: {
          status: 'ok',
          job_terakhir: regex(/^\d{4}-\d{2}-\d{2}T.+$/, '2026-10-04T04:00:12+07:00'),
          versi_api: like('v1.0.0')
        }
      });
    await pact.executeTest(async (mock) => {
      const k = buatKlien({ baseUrl: mock.url });
      const h = await k.kesehatan();
      expect(h.status).toBe('ok');
    });
  });

  test('GET /api/v1/harga dengan PIN zona', async () => {
    pact
      .given('prediksi harga cabai merah tersedia')
      .uponReceiving('permintaan harga H+1..H+7')
      .withRequest({
        method: 'GET',
        path: '/api/v1/harga',
        query: { komoditas_id: 'cmd_cabai_merah', pasar_id: 'psr_jakarta_timur_01' },
        headers: { 'X-Zona-PIN': '123456' }
      })
      .willRespondWith({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: {
          komoditas_id: 'cmd_cabai_merah',
          pasar_id: 'psr_jakarta_timur_01',
          deret: eachLike({
            tanggal: '2026-10-05',
            horizon: 'H+1',
            harga_prediksi: integer(42500),
            rentang_bawah: integer(39000),
            rentang_atas: integer(46000),
            kepercayaan: regex(/^(tinggi|sedang|rendah)$/, 'sedang')
          }),
          model_version: like('harga_v1.0.0'),
          dihitung_pada: regex(/^\d{4}-\d{2}-\d{2}T.+$/, '2026-10-04T04:00:12+07:00')
        }
      });
    await pact.executeTest(async (mock) => {
      const k = buatKlien({ baseUrl: mock.url, zonaPin: '123456' });
      const r = await k.bacaHarga({ komoditasId: 'cmd_cabai_merah', pasarId: 'psr_jakarta_timur_01' });
      expect(r.deret[0].horizon).toBe('H+1');
      expect(r.deret[0].harga_prediksi % 500).toBe(0);
    });
  });

  test('GET /api/v1/harga tanpa PIN -> 401 amplop Galat', async () => {
    pact
      .given('permintaan tanpa kredensial')
      .uponReceiving('permintaan harga tanpa PIN')
      .withRequest({
        method: 'GET',
        path: '/api/v1/harga',
        query: { komoditas_id: 'cmd_cabai_merah', pasar_id: 'psr_jakarta_timur_01' }
      })
      .willRespondWith({
        status: 401,
        headers: { 'Content-Type': 'application/json' },
        body: { error: { kode: 'tidak_berhak', pesan: like('PIN zona diperlukan.') } }
      });
    await pact.executeTest(async (mock) => {
      const k = buatKlien({ baseUrl: mock.url });
      const err = await k
        .bacaHarga({ komoditasId: 'cmd_cabai_merah', pasarId: 'psr_jakarta_timur_01' })
        .catch((e) => e);
      expect(err).toBeInstanceOf(GalatApi);
      expect((err as GalatApi).status).toBe(401);
    });
  });
});
