import { adalahKomoditas } from '$lib/komoditas';
import type { PageLoad } from './$types';

export const load: PageLoad = ({ url }) => {
  const k = url.searchParams.get('komoditas_id');
  return {
    komoditas_id: adalahKomoditas(k) ? k : 'cmd_cabai_merah',
    pasar_id: url.searchParams.get('pasar_id') ?? undefined,
    kabupaten_id: url.searchParams.get('kabupaten_id') ?? undefined
  };
};
