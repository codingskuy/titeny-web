/**
 * Fungsi per endpoint (operationId di openapi.yaml). Semua angka datang dari API;
 * klien TIDAK menghitung ulang model.
 */
import { buatKlien, type Klien } from './klien';
import {
  KesehatanSkema,
  LoginRespons,
  PrediksiDemandSkema,
  PrediksiHargaResponsSkema,
  PrediksiPanenResponsSkema,
  RekomendasiDaftarSkema,
  RekomendasiSkema,
  StatusDiterimaSkema,
  TokenPasangSkema,
  UbahStatusSkema,
  UmpanBalikSkema,
  type UbahStatusInput,
  type UmpanBalikInput
} from './kontrak';
import { sesi, penyimpananAman } from './sesi';

export function buatApi(k: Klien) {
  return {
    kesehatan: () => k.minta('/kesehatan', { skema: KesehatanSkema, auth: false }),

    authLogin: (username: string, password: string) =>
      k.minta('/auth/login', { metode: 'POST', bodi: { username, password }, skema: LoginRespons, auth: false }),
    authOtp: (sesi_id: string, otp: string) =>
      k.minta('/auth/otp/verifikasi', { metode: 'POST', bodi: { sesi_id, otp }, skema: TokenPasangSkema, auth: false }),

    harga: (q: { komoditas_id: string; pasar_id?: string; dari?: string; sampai?: string }) =>
      k.minta('/harga', { query: q, skema: PrediksiHargaResponsSkema }),
    demand: (q: { komoditas_id: string; zona: string; horizon?: 'H+7_total_kg' | 'H+30' }) =>
      k.minta('/demand', { query: q, skema: PrediksiDemandSkema }),
    panen: (q: { komoditas_id: string; kabupaten_id?: string; minggu?: string; limit?: number; cursor?: string }) =>
      k.minta('/panen', { query: q, skema: PrediksiPanenResponsSkema }),
    rekomendasi: (q: { zona?: string; limit?: number; cursor?: string } = {}) =>
      k.minta('/rekomendasi', { query: q, skema: RekomendasiDaftarSkema }),

    ubahStatusRekomendasi: (id: string, bodi: UbahStatusInput) =>
      k.minta(`/rekomendasi/${encodeURIComponent(id)}/status`, {
        metode: 'POST',
        bodi: UbahStatusSkema.parse(bodi),
        skema: RekomendasiSkema,
        cache: false
      }),
    umpanBalik: (bodi: UmpanBalikInput) =>
      k.minta('/umpan-balik', {
        metode: 'POST',
        bodi: UmpanBalikSkema.parse(bodi),
        skema: StatusDiterimaSkema,
        cache: false
      })
  };
}

export type Api = ReturnType<typeof buatApi>;

const klien = buatKlien({
  penyimpananCache: penyimpananAman(() => (typeof localStorage === 'undefined' ? undefined : localStorage))
});
let sebelumnya = sesi.snapshot().masuk;
sesi.langgan(() => {
  const sekarangMasuk = sesi.snapshot().masuk;
  if (sebelumnya && !sekarangMasuk) klien.hapusCache();
  sebelumnya = sekarangMasuk;
});

export const api: Api = buatApi(klien);
export { klien };
