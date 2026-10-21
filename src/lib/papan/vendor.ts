/**
 * Papan vendor: baris tabel besok, saran stok, peringatan sinyal.
 * Angka demand/harga dari API (`demand_v1.0.0`); klien TIDAK menghitung model. Satu-satunya
 * hitungan di klien adalah rumus saran stok yang ditetapkan produk:
 *   saran = demand harian rerata (demand H+7 / 7) x 1,15 buffer - stok di tangan  (min 0)
 * dihitung dalam sen-kg (integer) agar bebas galat floating point.
 */
import type { Api } from '../api';
import { KOMODITAS_HARGA } from '../komoditas';
import type { PrediksiDemand, PrediksiHargaRespons, Sinyal } from '../kontrak';
import { bungkus, type Bagian } from './muat';
import type { Penyimpanan } from '../sesi';

export const BUFFER_PERSEN = 115;

export function saranStokKg(demand7Kg: number, stokKg: number): number {
  const centiKg = Math.round((demand7Kg * BUFFER_PERSEN) / 7) - Math.round(stokKg * 100);
  return Math.max(0, centiKg) / 100;
}

export function parseKg(teks: string): number | null {
  const t = teks.trim().replace(',', '.');
  if (t === '' || !/^\d+(\.\d{1,2})?$/.test(t)) return null;
  const n = Number(t);
  return n <= 1_000_000 ? n : null;
}

const KUNCI_STOK = 'ttn.vendor.stok';

export function buatPenyimpananStok(store: Penyimpanan | null) {
  const baca = (): Record<string, number> => {
    try {
      const o = JSON.parse(store?.getItem(KUNCI_STOK) ?? '{}') as Record<string, unknown>;
      return Object.fromEntries(Object.entries(o).filter(([, v]) => typeof v === 'number' && v >= 0)) as Record<string, number>;
    } catch {
      return {};
    }
  };
  return {
    baca,
    simpan(id: string, nilai: number | null) {
      try {
        const cur = baca();
        if (nilai === null) delete cur[id];
        else cur[id] = nilai;
        store?.setItem(KUNCI_STOK, JSON.stringify(cur));
      } catch {
        /* penyimpanan penuh/diblokir: tetap di memori */
      }
    }
  };
}

export type Peringatan = { kunci: 'hijau' | 'kuning' | 'merah'; teks: string };

/** Warna + TEKS (bukan warna saja). Kontrak: sinyal surplus|seimbang|defisit; "waspada" = surplus (ASUMSI, ADR-0005). */
export function peringatanDariSinyal(s: Sinyal): Peringatan {
  if (s === 'defisit') return { kunci: 'merah', teks: 'Defisit' };
  if (s === 'surplus') return { kunci: 'kuning', teks: 'Waspada (surplus)' };
  return { kunci: 'hijau', teks: 'Seimbang' };
}

export type BarisVendor = {
  id: string;
  nama: string;
  hargaBesok: number | null;
  demand7: number | null;
  saran: number | null;
  peringatan: Peringatan | null;
  tanggalDemand: string | null;
  status: 'ok' | 'kosong' | 'galat';
  pesan: string | null;
  modelVersion: string | null;
  zona: string | null;
};

export function buatBaris(
  k: { id: string; nama: string },
  harga: Bagian<PrediksiHargaRespons>,
  demand: Bagian<PrediksiDemand>,
  stokKg: number
): BarisVendor {
  const h1 = harga.status === 'ok' ? (harga.data.deret.find((p) => p.horizon === 'H+1') ?? null) : null;
  const d = demand.status === 'ok' ? demand.data : null;
  const galat = [harga, demand].find((b) => b.status !== 'ok');
  return {
    id: k.id,
    nama: k.nama,
    hargaBesok: h1?.harga_prediksi ?? null,
    demand7: d?.demand_prediksi_kg ?? null,
    saran: d ? saranStokKg(d.demand_prediksi_kg, stokKg) : null,
    peringatan: d ? peringatanDariSinyal(d.sinyal) : null,
    tanggalDemand: d?.tanggal ?? null,
    status: !galat ? 'ok' : galat.status === 'kosong' ? 'kosong' : 'galat',
    pesan: galat && 'pesan' in galat ? galat.pesan : null,
    modelVersion: d?.model_version ?? null,
    zona: d?.zona ?? null
  };
}

/** ASUMSI (ADR-0005): kontrak tak punya penanda "S3 telat"; data dianggap estimasi bila tanggal demand atau job_terakhir < hari ini (WIB). */
export function adalahEstimasi(hariIni: string, jobTerakhir: string | null | undefined, barisOk: BarisVendor[]): boolean {
  const tgl = (s: string | null | undefined) => (s ? s.slice(0, 10) : null);
  const job = tgl(jobTerakhir);
  if (job !== null && job < hariIni) return true;
  return barisOk.some((b) => b.tanggalDemand !== null && b.tanggalDemand < hariIni);
}

export type Rawan = { jobTerakhir: string | null; basi: boolean; diambilPada: string | null };

export async function muatVendor(
  api: Pick<Api, 'harga' | 'demand' | 'kesehatan'>,
  q: { zona?: string }
): Promise<Rawan & { mentah: { id: string; nama: string; harga: Bagian<PrediksiHargaRespons>; demand: Bagian<PrediksiDemand> }[] }> {
  const [kes, mentah] = await Promise.all([
    bungkus(api.kesehatan(), {}),
    Promise.all(
      KOMODITAS_HARGA.map(async (k) => {
        const [harga, demand] = await Promise.all([
          bungkus(api.harga({ komoditas_id: k.id }), { data_belum_cukup: 'Data harga belum cukup.', tidak_ditemukan: 'Tidak dikenal.' }),
          bungkus(api.demand({ komoditas_id: k.id, zona: q.zona ?? '' }), {
            data_belum_cukup: 'Data demand belum cukup.',
            tidak_ditemukan: 'Prediksi demand belum tersedia.'
          })
        ]);
        return { id: k.id, nama: k.nama, harga, demand };
      })
    )
  ]);
  const basi = mentah.some((m) => (m.harga.status === 'ok' && m.harga.basi) || (m.demand.status === 'ok' && m.demand.basi));
  const stamp = mentah.flatMap((m) => [m.harga, m.demand]).find((b) => b.status === 'ok' && b.basi);
  return {
    mentah,
    jobTerakhir: kes.status === 'ok' ? kes.data.job_terakhir : null,
    basi,
    diambilPada: stamp && stamp.status === 'ok' ? stamp.diambilPada : null
  };
}
