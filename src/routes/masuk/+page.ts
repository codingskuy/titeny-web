import { adalahPeran } from '$lib/akses';
import type { PageLoad } from './$types';

export const load: PageLoad = ({ url }) => {
  const p = url.searchParams.get('peran');
  return { peran: adalahPeran(p) ? p : null };
};
