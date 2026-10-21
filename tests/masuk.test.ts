import { describe, expect, test } from 'bun:test';
import { masukDenganPin, mulaiMasukCeo, selesaikanMasukCeo } from '../src/lib/masuk';
import { GalatApi } from '../src/lib/klien';
import { buatSesi } from '../src/lib/sesi';

const ok = <T>(data: T) => Promise.resolve({ data, basi: false, diambilPada: '' });

describe('masuk per peran', () => {
  test('PIN valid: sesi terisi setelah probe sukses', async () => {
    const sesi = buatSesi({});
    const r = await masukDenganPin({ rekomendasi: () => ok({ data: [] }) } as never, sesi, 'petani', '482013');
    expect(r.ok).toBe(true);
    expect(sesi.headerAuth()).toEqual({ 'X-Zona-PIN': '482013' });
  });

  test('PIN salah (401): sesi dibersihkan, pesan jelas', async () => {
    const sesi = buatSesi({});
    const api = { rekomendasi: () => Promise.reject(new GalatApi(401, 'tidak_berhak', 'x')) } as never;
    const r = await masukDenganPin(api, sesi, 'vendor', '000000');
    expect(r).toEqual({ ok: false, pesan: 'PIN salah atau sudah tidak berlaku.' });
    expect(sesi.snapshot().masuk).toBe(false);
  });

  test('PIN bukan 6 digit ditolak tanpa panggilan API', async () => {
    let dipanggil = false;
    const api = {
      rekomendasi: () => {
        dipanggil = true;
        return ok({});
      }
    } as never;
    const r = await masukDenganPin(api, buatSesi({}), 'petani', '12ab56');
    expect(r.ok).toBe(false);
    expect(dipanggil).toBe(false);
  });

  test('429 menyebut Retry-After', async () => {
    const api = { rekomendasi: () => Promise.reject(new GalatApi(429, 'kuota_habis', 'x', null, 42)) } as never;
    const r = await masukDenganPin(api, buatSesi({}), 'petani', '123456');
    expect(r.ok === false && r.pesan).toContain('42 detik');
  });

  test('CEO: login -> OTP -> token masuk sesi', async () => {
    const sesi = buatSesi({});
    const api = {
      authLogin: () => ok({ sesi_id: 'ses_1', otp_diperlukan: true }),
      authOtp: () =>
        ok({ access_token: 'A', refresh_token: 'R', token_type: 'Bearer', expires_in: 900, peran: 'ceo' })
    } as never;
    const l = await mulaiMasukCeo(api, 'ceo@x', 'pw');
    expect(l).toEqual({ ok: true, sesiId: 'ses_1' });
    const o = await selesaikanMasukCeo(api, sesi, 'ses_1', '123456');
    expect(o.ok).toBe(true);
    expect(sesi.headerAuth()).toEqual({ Authorization: 'Bearer A' });
  });

  test('CEO: login yang langsung memberi token (layanan) ditolak', async () => {
    const api = {
      authLogin: () =>
        ok({ access_token: 'A', refresh_token: 'R', token_type: 'Bearer', expires_in: 900, peran: 'layanan' })
    } as never;
    const r = await mulaiMasukCeo(api, 'svc', 'pw');
    expect(r.ok).toBe(false);
  });

  test('OTP menghasilkan token analis: ditolak dan sesi kosong', async () => {
    const sesi = buatSesi({});
    const api = {
      authOtp: () => ok({ access_token: 'A', refresh_token: 'R', token_type: 'Bearer', expires_in: 900, peran: 'analis' })
    } as never;
    const r = await selesaikanMasukCeo(api, sesi, 's', '123456');
    expect(r.ok).toBe(false);
    expect(sesi.snapshot().masuk).toBe(false);
  });

  test('OTP salah format ditolak lokal; OTP salah dari server memberi pesan', async () => {
    const sesi = buatSesi({});
    expect((await selesaikanMasukCeo({ authOtp: () => ok({}) } as never, sesi, 's', '12')).ok).toBe(false);
    const api = { authOtp: () => Promise.reject(new GalatApi(401, 'tidak_berhak', 'x')) } as never;
    const r = await selesaikanMasukCeo(api, sesi, 's', '123456');
    expect(r.ok).toBe(false);
  });
});
