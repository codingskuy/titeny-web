/**
 * Lencana keputusan papan petani (PRD 20-alur / papan-insight §2). Aritmetika integer;
 * angka harga datang dari API, di sini hanya aturan lencana V1.
 *
 *  - H+3 naik >= 8% dari acuan DAN kepercayaan H+3 >= sedang  -> TAHAN 3 HARI
 *  - turun >= 8% (H+3 vs acuan)                               -> JUAL SEKARANG
 *  - selain itu                                                -> CICIL JUAL
 *
 * ASUMSI acuan: kontrak tidak punya "harga hari ini" (horizon mulai H+1). Acuan = titik
 * ber-tanggal hari ini bila ada, selain itu titik H+1 (lihat ADR-0004).
 */
import { rupiah } from '../format';
import type { PrediksiHarga } from '../kontrak';

export type Lencana = 'TAHAN 3 HARI' | 'JUAL SEKARANG' | 'CICIL JUAL';
export type Keputusan = { lencana: Lencana; alasan: string; acuan: PrediksiHarga | null; h3: PrediksiHarga | null };

export const AMBANG_PERSEN = 8;

export function pilihAcuan(deret: readonly PrediksiHarga[], hariIni: string): PrediksiHarga | null {
  return deret.find((p) => p.tanggal === hariIni) ?? deret.find((p) => p.horizon === 'H+1') ?? null;
}

/** Selisih persen dibulatkan ke bilangan bulat terdekat (hanya untuk teks). */
const persen = (dari: number, ke: number) => Math.round(((ke - dari) * 100) / dari);

export function tentukanKeputusan(deret: readonly PrediksiHarga[], hariIni: string): Keputusan {
  const acuan = pilihAcuan(deret, hariIni);
  const h3 = deret.find((p) => p.horizon === 'H+3') ?? null;
  if (!acuan || !h3 || acuan.harga_prediksi <= 0) {
    return { lencana: 'CICIL JUAL', alasan: 'Data H+3 belum lengkap, jual bertahap saja.', acuan, h3 };
  }
  const a = acuan.harga_prediksi;
  const naik8 = (h3.harga_prediksi - a) * 100 >= AMBANG_PERSEN * a;
  const turun8 = (a - h3.harga_prediksi) * 100 >= AMBANG_PERSEN * a;
  const cukupYakin = h3.kepercayaan === 'sedang' || h3.kepercayaan === 'tinggi';
  const rentang = `${rupiah(a)} ke ${rupiah(h3.harga_prediksi)}`;

  if (naik8 && cukupYakin) {
    return {
      lencana: 'TAHAN 3 HARI',
      alasan: `Harga H+3 diprediksi naik ${persen(a, h3.harga_prediksi)}% (${rentang}) dengan kepercayaan ${h3.kepercayaan}.`,
      acuan,
      h3
    };
  }
  if (turun8) {
    return {
      lencana: 'JUAL SEKARANG',
      alasan: `Harga H+3 diprediksi turun ${Math.abs(persen(a, h3.harga_prediksi))}% (${rentang}).`,
      acuan,
      h3
    };
  }
  if (naik8 && !cukupYakin) {
    return {
      lencana: 'CICIL JUAL',
      alasan: `Harga H+3 mungkin naik ${persen(a, h3.harga_prediksi)}% (${rentang}) tetapi kepercayaan rendah, jual bertahap.`,
      acuan,
      h3
    };
  }
  const p = persen(a, h3.harga_prediksi);
  return {
    lencana: 'CICIL JUAL',
    alasan: `Harga H+3 relatif stabil (${p >= 0 ? '+' : ''}${p}%, ${rentang}), jual bertahap.`,
    acuan,
    h3
  };
}

/** Lencana kuning "Akurasi terbatas" bila ada titik berkepercayaan rendah. */
export const akurasiTerbatas = (deret: readonly PrediksiHarga[]): boolean => deret.some((p) => p.kepercayaan === 'rendah');
