import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';

/** `/insight` = pemilih peran; dialihkan ke landing. */
export const load: PageLoad = () => redirect(307, '/');
