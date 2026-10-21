import type { PageLoad } from './$types';

export const load: PageLoad = ({ url }) => ({
  zona: url.searchParams.get('zona') ?? undefined
});
