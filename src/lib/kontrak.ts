/**
 * Skema zod + tipe klien, DITURUNKAN dari docs/api/openapi.yaml
 * (Coding-Skuy/titeny-backend-service, branch PR #10 `feat/ttn-be-005-aksi-analis-audit`,
 * commit 5447ae9). Bergantung pada titeny-backend-service#7..#10.
 * Jangan menambah field yang tidak ada di spec; ubah spec dulu di backend.
 */
import { z } from 'zod';

export const Peran = z.enum(['petani', 'vendor', 'ceo']);
export type Peran = z.infer<typeof Peran>;

export const Kepercayaan = z.enum(['tinggi', 'sedang', 'rendah']);
export type Kepercayaan = z.infer<typeof Kepercayaan>;

export const Sinyal = z.enum(['surplus', 'seimbang', 'defisit']);
export type Sinyal = z.infer<typeof Sinyal>;

export const KodeGalat = z.enum([
  'tidak_ditemukan',
  'validasi_gagal',
  'tidak_berhak',
  'kuota_habis',
  'data_belum_cukup',
  'kesalahan_server'
]);

export const GalatSkema = z.object({
  error: z.object({
    kode: KodeGalat,
    pesan: z.string(),
    field: z.string().nullable().optional()
  })
});

export const KesehatanSkema = z.object({
  status: z.literal('ok'),
  job_terakhir: z.string().nullable(),
  versi_api: z.string()
});
export type Kesehatan = z.infer<typeof KesehatanSkema>;

export const LoginTantanganSkema = z.object({
  sesi_id: z.string(),
  otp_diperlukan: z.literal(true)
});
export type LoginTantangan = z.infer<typeof LoginTantanganSkema>;

export const TokenPasangSkema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  token_type: z.literal('Bearer'),
  expires_in: z.number().int(),
  peran: z.enum(['ceo', 'analis', 'layanan']).optional()
});
export type TokenPasang = z.infer<typeof TokenPasangSkema>;

/** oneOf LoginTantangan | TokenPasang; dibedakan lewat keberadaan `access_token`. */
export const LoginRespons = z.union([TokenPasangSkema, LoginTantanganSkema]);
export type LoginRespons = z.infer<typeof LoginRespons>;

export const PrediksiHargaSkema = z.object({
  tanggal: z.string(),
  horizon: z.enum(['H+1', 'H+2', 'H+3', 'H+4', 'H+5', 'H+6', 'H+7']),
  harga_prediksi: z.number().int(),
  rentang_bawah: z.number().int(),
  rentang_atas: z.number().int(),
  kepercayaan: Kepercayaan,
  alasan_singkat: z.string().optional()
});
export type PrediksiHarga = z.infer<typeof PrediksiHargaSkema>;

export const PrediksiHargaResponsSkema = z.object({
  komoditas_id: z.string(),
  pasar_id: z.string(),
  deret: z.array(PrediksiHargaSkema),
  model_version: z.string(),
  dihitung_pada: z.string()
});
export type PrediksiHargaRespons = z.infer<typeof PrediksiHargaResponsSkema>;

export const PrediksiDemandSkema = z.object({
  jenis: z.literal('demand').optional(),
  komoditas_id: z.string(),
  zona: z.string(),
  tanggal: z.string().optional(),
  horizon: z.enum(['H+7_total_kg', 'H+30']),
  demand_prediksi_kg: z.number().min(0),
  rentang_bawah_kg: z.number().min(0).optional(),
  rentang_atas_kg: z.number().min(0).optional(),
  sinyal: Sinyal,
  rekomendasi: z.array(z.string()).max(3).optional(),
  model_version: z.string()
});
export type PrediksiDemand = z.infer<typeof PrediksiDemandSkema>;

export const PrediksiPanenSkema = z.object({
  jenis: z.literal('panen').optional(),
  komoditas_id: z.string(),
  kabupaten_id: z.string(),
  minggu: z.string(),
  panen_prediksi_kg: z.number().int(),
  rentang_bawah_kg: z.number().int().min(0).optional(),
  rentang_atas_kg: z.number().int().min(0).optional(),
  kepercayaan: Kepercayaan,
  model_version: z.string()
});
export type PrediksiPanen = z.infer<typeof PrediksiPanenSkema>;

export const PrediksiPanenResponsSkema = z.object({
  deret: z.array(PrediksiPanenSkema),
  dihitung_pada: z.string().optional(),
  next_cursor: z.string().nullable().optional()
});
export type PrediksiPanenRespons = z.infer<typeof PrediksiPanenResponsSkema>;

export const StatusRekomendasi = z.enum(['baru', 'dikerjakan', 'selesai']);
export type StatusRekomendasi = z.infer<typeof StatusRekomendasi>;

export const RekomendasiSkema = z.object({
  id: z.string(),
  zona: z.string(),
  teks: z.array(z.string()).max(3),
  status: StatusRekomendasi,
  penanggung_jawab: z.string().optional(),
  target_tanggal: z.string().optional(),
  catatan: z.string().max(140).optional()
});
export type Rekomendasi = z.infer<typeof RekomendasiSkema>;

export const RekomendasiDaftarSkema = z.object({
  data: z.array(RekomendasiSkema),
  next_cursor: z.string().nullable().optional()
});
export type RekomendasiDaftar = z.infer<typeof RekomendasiDaftarSkema>;

export const StatusDiterimaSkema = z.object({ status: z.literal('diterima') });

/** Bodi POST /umpan-balik (komentar maks 280 karakter). */
export const UmpanBalikSkema = z.object({
  nilai: z.enum(['bermanfaat', 'kurang_tepat']),
  komentar: z.string().max(280).optional(),
  komoditas_id: z
    .string()
    .regex(/^cmd_[a-z_]+$/)
    .optional()
});
export type UmpanBalikInput = z.infer<typeof UmpanBalikSkema>;

/** Bodi POST /rekomendasi/{id}/status (catatan maks 140; status hanya dikerjakan|selesai). */
export const UbahStatusSkema = z.object({
  status: z.enum(['dikerjakan', 'selesai']),
  catatan: z.string().max(140),
  penanggung_jawab: z.string().optional(),
  target_tanggal: z.string().optional()
});
export type UbahStatusInput = z.infer<typeof UbahStatusSkema>;
