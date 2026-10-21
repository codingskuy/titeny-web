/** Format tampilan: IDR dengan pemisah titik (42.500), waktu Asia/Jakarta. */
const idr = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 });
const desimal = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 });

export const rupiah = (n: number): string => `Rp${idr.format(n)}`;
export const angka = (n: number): string => idr.format(n);
export const kg = (n: number): string => `${desimal.format(n)} kg`;

export function stempelWib(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  const t = new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).format(d);
  return `${t.replace(/\./g, ':').replace(/(\d{2}):(\d{2})$/, '$1.$2')} WIB`;
}

/** Tanggal hari ini di Asia/Jakarta, `YYYY-MM-DD`. */
export function hariIniWib(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

/** `2026-10-05` -> `5 Okt`. */
export function tanggalPendek(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return new Intl.DateTimeFormat('id-ID', { timeZone: 'UTC', day: 'numeric', month: 'short' }).format(new Date(Date.UTC(y, m - 1, d)));
}
