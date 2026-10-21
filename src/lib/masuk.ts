/**
 * Alur masuk per peran. Logika murni (tanpa DOM) agar bisa diuji.
 *
 * - petani/vendor: tautan peran + PIN zona 6 digit. Kontrak tidak punya endpoint verifikasi PIN,
 *   jadi PIN diperiksa dengan satu panggilan baca `GET /rekomendasi?limit=1` (ASUMSI, lihat ADR-0003).
 * - CEO: akun + OTP (`/auth/login` lalu `/auth/otp/verifikasi`). Token layanan/analis ditolak.
 */
import type { Api } from './api';
import { GalatApi } from './klien';
import { POLA_PIN, type Sesi } from './sesi';

export type Hasil<T = object> = ({ ok: true } & T) | { ok: false; pesan: string };

export function pesanGalat(e: unknown): string {
  if (e instanceof GalatApi) {
    if (e.kode === 'timeout') return 'Server terlalu lama menjawab. Coba lagi.';
    if (e.kode === 'jaringan') return 'Tidak ada koneksi ke server.';
    if (e.status === 429) return `Terlalu banyak percobaan. Coba lagi dalam ${e.retryAfter ?? 60} detik.`;
    if (e.status === 401) return 'Data masuk salah atau sudah kedaluwarsa.';
    if (e.status === 403) return 'Akses ditolak untuk peran ini.';
    return e.message;
  }
  return 'Terjadi kesalahan tak terduga.';
}

export async function masukDenganPin(
  api: Pick<Api, 'rekomendasi'>,
  sesi: Sesi,
  peran: 'petani' | 'vendor',
  pin: string
): Promise<Hasil> {
  if (!POLA_PIN.test(pin)) return { ok: false, pesan: 'PIN harus 6 digit angka.' };
  sesi.masukDenganPin(peran, pin);
  try {
    await api.rekomendasi({ limit: 1 });
    return { ok: true };
  } catch (e) {
    sesi.keluar();
    if (e instanceof GalatApi && e.status === 401) return { ok: false, pesan: 'PIN salah atau sudah tidak berlaku.' };
    return { ok: false, pesan: pesanGalat(e) };
  }
}

export async function mulaiMasukCeo(
  api: Pick<Api, 'authLogin'>,
  username: string,
  password: string
): Promise<Hasil<{ sesiId: string }>> {
  if (!username.trim() || !password) return { ok: false, pesan: 'Isi nama akun dan kata sandi.' };
  try {
    const r = await api.authLogin(username.trim(), password);
    if ('access_token' in r.data) {
      return { ok: false, pesan: 'Akun ini bukan akun CEO (tidak memakai OTP).' };
    }
    return { ok: true, sesiId: r.data.sesi_id };
  } catch (e) {
    return { ok: false, pesan: pesanGalat(e) };
  }
}

export async function selesaikanMasukCeo(
  api: Pick<Api, 'authOtp'>,
  sesi: Sesi,
  sesiId: string,
  otp: string
): Promise<Hasil> {
  if (!/^\d{6}$/.test(otp)) return { ok: false, pesan: 'Kode OTP harus 6 digit angka.' };
  try {
    const r = await api.authOtp(sesiId, otp);
    if (r.data.peran === 'analis' || r.data.peran === 'layanan') {
      return { ok: false, pesan: 'Akun ini bukan akun CEO.' };
    }
    sesi.masukDenganToken(r.data);
    return { ok: true };
  } catch (e) {
    return { ok: false, pesan: pesanGalat(e) };
  }
}
