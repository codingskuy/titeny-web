import { z } from 'zod';

/** Klien tipis API Titeny v1 — tipe diturunkan dari docs/api/openapi.yaml (titeny-backend-service). */

export const Kepercayaan = z.enum(['tinggi', 'sedang', 'rendah']);
export type Kepercayaan = z.infer<typeof Kepercayaan>;

export const KesehatanSchema = z.object({
  status: z.literal('ok'),
  job_terakhir: z.string(),
  versi_api: z.string()
});
export type Kesehatan = z.infer<typeof KesehatanSchema>;

export const PrediksiHargaSchema = z.object({
  tanggal: z.string(),
  horizon: z.enum(['H+1', 'H+2', 'H+3', 'H+4', 'H+5', 'H+6', 'H+7']),
  harga_prediksi: z.number().int(),
  rentang_bawah: z.number().int(),
  rentang_atas: z.number().int(),
  kepercayaan: Kepercayaan,
  alasan_singkat: z.string().optional()
});
export type PrediksiHarga = z.infer<typeof PrediksiHargaSchema>;

export const PrediksiHargaResponsSchema = z.object({
  komoditas_id: z.string(),
  pasar_id: z.string(),
  deret: z.array(PrediksiHargaSchema),
  model_version: z.string(),
  dihitung_pada: z.string()
});
export type PrediksiHargaRespons = z.infer<typeof PrediksiHargaResponsSchema>;

export const GalatSchema = z.object({
  error: z.object({
    kode: z.enum([
      'tidak_ditemukan',
      'validasi_gagal',
      'tidak_berhak',
      'kuota_habis',
      'data_belum_cukup',
      'kesalahan_server'
    ]),
    pesan: z.string(),
    field: z.string().nullable().optional()
  })
});

export class GalatApi extends Error {
  constructor(
    public status: number,
    public kode: string,
    pesan: string
  ) {
    super(pesan);
    this.name = 'GalatApi';
  }
}

export type OpsiKlien = {
  baseUrl: string;
  /** PIN zona 6 digit (petani/vendor) -> header X-Zona-PIN. */
  zonaPin?: string;
  /** JWT akses (CEO/analis) -> header Authorization. */
  token?: string;
  fetch?: typeof fetch;
};

export function buatKlien(opsi: OpsiKlien) {
  const f = opsi.fetch ?? fetch;
  const base = opsi.baseUrl.replace(/\/$/, '');

  async function get<T>(path: string, skema: z.ZodType<T>, auth: boolean): Promise<T> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (auth && opsi.zonaPin) headers['X-Zona-PIN'] = opsi.zonaPin;
    if (auth && opsi.token) headers['Authorization'] = `Bearer ${opsi.token}`;
    const r = await f(`${base}${path}`, { headers });
    const badan: unknown = await r.json().catch(() => null);
    if (!r.ok) {
      const g = GalatSchema.safeParse(badan);
      if (g.success) throw new GalatApi(r.status, g.data.error.kode, g.data.error.pesan);
      throw new GalatApi(r.status, 'kesalahan_server', `Respons ${r.status} tak dikenal`);
    }
    return skema.parse(badan);
  }

  return {
    kesehatan: () => get('/api/v1/kesehatan', KesehatanSchema, false),
    bacaHarga: (q: { komoditasId: string; pasarId: string; dari?: string; sampai?: string }) => {
      const p = new URLSearchParams({ komoditas_id: q.komoditasId, pasar_id: q.pasarId });
      if (q.dari) p.set('dari', q.dari);
      if (q.sampai) p.set('sampai', q.sampai);
      return get(`/api/v1/harga?${p}`, PrediksiHargaResponsSchema, true);
    }
  };
}
