/** Pemuatan data papan (logika murni, teruji). Menerjemahkan galat API menjadi keadaan tampilan. */
import type { Api } from '../api';
import { GalatApi, type Hasil } from '../klien';
import type { PrediksiHargaRespons, PrediksiPanenRespons } from '../kontrak';
import { pesanGalat } from '../masuk';
import { KOMODITAS_PANEN } from '../komoditas';

export type Bagian<T> =
  | { status: 'ok'; data: T; basi: boolean; diambilPada: string }
  | { status: 'kosong'; pesan: string }
  | { status: 'galat'; pesan: string };

export async function bungkus<T>(p: Promise<Hasil<T>>, pesanKosong: Record<string, string>): Promise<Bagian<T>> {
  try {
    const h = await p;
    return { status: 'ok', data: h.data, basi: h.basi, diambilPada: h.diambilPada };
  } catch (e) {
    if (e instanceof GalatApi && pesanKosong[e.kode]) return { status: 'kosong', pesan: pesanKosong[e.kode] };
    return { status: 'galat', pesan: pesanGalat(e) };
  }
}

export type StatePetani = { harga: Bagian<PrediksiHargaRespons>; panen: Bagian<PrediksiPanenRespons> | null };

export async function muatPetani(
  api: Pick<Api, 'harga' | 'panen'>,
  q: { komoditas_id: string; pasar_id?: string; kabupaten_id?: string }
): Promise<StatePetani> {
  const [harga, panen] = await Promise.all([
    bungkus(api.harga({ komoditas_id: q.komoditas_id, pasar_id: q.pasar_id }), {
      data_belum_cukup: 'Data harga belum cukup.',
      tidak_ditemukan: 'Komoditas atau pasar tidak dikenal.'
    }),
    KOMODITAS_PANEN.includes(q.komoditas_id)
      ? bungkus(api.panen({ komoditas_id: q.komoditas_id, kabupaten_id: q.kabupaten_id }), {
          data_belum_cukup: 'Data panen belum cukup.',
          tidak_ditemukan: 'Prediksi panen belum tersedia.'
        })
      : Promise.resolve(null)
  ]);
  return { harga, panen };
}
