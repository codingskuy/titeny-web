import type { Peran } from './kontrak';

export const PERAN_VALID: readonly Peran[] = ['petani', 'vendor', 'ceo'];

export const adalahPeran = (v: string | null | undefined): v is Peran => PERAN_VALID.includes(v as Peran);

export const namaPeran: Record<Peran, string> = { petani: 'Petani', vendor: 'Vendor', ceo: 'CEO / Operasional' };

/** Peran dari path `/insight/<peran>...`; null bila bukan papan. */
export function peranDariPath(pathname: string): Peran | null {
  const m = /^\/insight\/([^/]+)/.exec(pathname);
  return m && adalahPeran(m[1]) ? m[1] : null;
}

/** Penjaga papan: sesi harus cocok dengan peran papan; selain itu arahkan ke Masuk. */
export function tujuanPenjaga(pathname: string, peranSesi: Peran | null): string | null {
  const p = peranDariPath(pathname);
  if (!p) return null;
  return peranSesi === p ? null : `/masuk?peran=${p}`;
}
