/**
 * Papan CEO: matriks surplus/defisit 5 kabupaten x 12 komoditas, rekomendasi prioritas,
 * ekspor CSV terbatas. Semua angka/sinyal dari API.
 *
 * ASUMSI (ADR-0006): kontrak `GET /demand` memakai `zona` (zona rute/pasar), bukan kabupaten.
 * Matriks memanggil `/demand?zona=<kabupaten_id>`; sel yang dijawab 404 tampil "tidak ada data".
 */
import type { Api } from '../api';
import { KOMODITAS_HARGA } from '../komoditas';
import type { PrediksiDemand, Rekomendasi, StatusRekomendasi } from '../kontrak';
import { bungkus, type Bagian } from './muat';

export const KABUPATEN = [
  { id: 'kab_karawang', nama: 'Karawang' },
  { id: 'kab_subang', nama: 'Subang' },
  { id: 'kab_garut', nama: 'Garut' },
  { id: 'kab_brebes', nama: 'Brebes' },
  { id: 'kab_malang', nama: 'Malang' }
] as const;

/** Batas kuota server 60 permintaan/menit per token: matriks = 60 sel, jadi dibatasi paralelnya. */
export async function jalankanTerbatas<T>(tugas: readonly (() => Promise<T>)[], paralel = 6): Promise<T[]> {
  const hasil: T[] = new Array(tugas.length);
  let i = 0;
  const pekerja = Array.from({ length: Math.min(paralel, tugas.length) }, async () => {
    while (i < tugas.length) {
      const n = i++;
      hasil[n] = await tugas[n]();
    }
  });
  await Promise.all(pekerja);
  return hasil;
}

export type SelMatriks = { komoditas_id: string; kabupaten_id: string; sel: Bagian<PrediksiDemand> };
export const kunciSel = (k: string, kab: string) => `${k}|${kab}`;

export function muatSel(api: Pick<Api, 'demand'>, komoditas_id: string, kabupaten_id: string): Promise<SelMatriks> {
  return bungkus(api.demand({ komoditas_id, zona: kabupaten_id }), {
    tidak_ditemukan: 'Tidak ada data.',
    data_belum_cukup: 'Data belum cukup.'
  }).then((sel) => ({ komoditas_id, kabupaten_id, sel }));
}

export async function muatMatriks(api: Pick<Api, 'demand'>, paralel = 6): Promise<Map<string, SelMatriks>> {
  const tugas = KOMODITAS_HARGA.flatMap((k) => KABUPATEN.map((kab) => () => muatSel(api, k.id, kab.id)));
  const hasil = await jalankanTerbatas(tugas, paralel);
  return new Map(hasil.map((h) => [kunciSel(h.komoditas_id, h.kabupaten_id), h]));
}

export async function muatRekomendasi(api: Pick<Api, 'rekomendasi'>) {
  return bungkus(api.rekomendasi({ limit: 5 }), {});
}

/** Transisi sah: baru -> dikerjakan -> selesai (kontrak: status tujuan hanya dikerjakan|selesai). */
export function transisiBerikut(s: StatusRekomendasi): 'dikerjakan' | 'selesai' | null {
  if (s === 'baru') return 'dikerjakan';
  if (s === 'dikerjakan') return 'selesai';
  return null;
}

export const CATATAN_MAKS = 140;

export function validasiCatatan(teks: string): { ok: true; nilai: string } | { ok: false; pesan: string } {
  const t = teks.trim();
  if (t.length === 0) return { ok: false, pesan: 'Catatan wajib diisi.' };
  if ([...t].length > CATATAN_MAKS) return { ok: false, pesan: `Catatan maksimal ${CATATAN_MAKS} karakter.` };
  return { ok: true, nilai: t };
}

export function gantiRekomendasi(daftar: readonly Rekomendasi[], baru: Rekomendasi): Rekomendasi[] {
  return daftar.map((r) => (r.id === baru.id ? baru : r));
}

export const BARIS_EKSPOR_MAKS = 500;

/** CSV aman (RFC 4180) dan anti injeksi rumus; dipotong 500 baris data. */
export function buatCsv(kolom: readonly string[], baris: readonly (readonly (string | number)[])[], maks = BARIS_EKSPOR_MAKS) {
  const esc = (v: string | number) => {
    let s = String(v);
    if (/^[=+\-@\t\r]/.test(s) && typeof v === 'string') s = `'${s}`;
    return /[",\n\r]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
  };
  const dipakai = baris.slice(0, maks);
  const teks = [kolom, ...dipakai].map((r) => r.map(esc).join(',')).join('\r\n') + '\r\n';
  return { teks, jumlah: dipakai.length, terpotong: baris.length > maks };
}
