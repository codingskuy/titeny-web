/**
 * Proxy `/api/v1/*` untuk klien web. Web tidak menulis ke DB; hanya meneruskan ke API
 * Titeny. Allowlist jalur = least-privilege: tanpa `event/masuk` dan `analis/*`.
 */
const JALUR_BOLEH = [
  /^kesehatan$/,
  /^harga$/,
  /^demand$/,
  /^panen$/,
  /^rekomendasi$/,
  /^rekomendasi\/[^/]+\/status$/,
  /^umpan-balik$/,
  /^auth\/login$/,
  /^auth\/otp\/verifikasi$/,
  /^auth\/refresh$/
];
const HEADER_MASUK = ['authorization', 'x-zona-pin', 'x-idempotency-key', 'content-type', 'accept'];
const HEADER_KELUAR = ['content-type', 'cache-control', 'retry-after', 'vary'];
export const BODI_MAKS = 256 * 1024;

const galat = (status: number, kode: string, pesan: string) =>
  new Response(JSON.stringify({ error: { kode, pesan, field: null } }), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });

export async function teruskan(
  req: Request,
  path: string,
  upstream: string,
  f: typeof fetch = fetch
): Promise<Response> {
  if (req.method !== 'GET' && req.method !== 'POST') return galat(405, 'validasi_gagal', 'Metode tidak didukung.');
  if (path.includes('..') || !JALUR_BOLEH.some((r) => r.test(path))) {
    return galat(404, 'tidak_ditemukan', 'Jalur tidak tersedia.');
  }
  let bodi: ArrayBuffer | undefined;
  if (req.method === 'POST') {
    bodi = await req.arrayBuffer();
    if (bodi.byteLength > BODI_MAKS) return galat(413, 'validasi_gagal', 'Bodi terlalu besar.');
  }
  const h = new Headers();
  for (const k of HEADER_MASUK) {
    const v = req.headers.get(k);
    if (v) h.set(k, v);
  }
  const url = new URL(req.url);
  const target = `${upstream.replace(/\/$/, '')}/api/v1/${path}${url.search}`;
  try {
    const r = await f(target, { method: req.method, headers: h, body: bodi, signal: AbortSignal.timeout(10_000) });
    const out = new Headers();
    for (const k of HEADER_KELUAR) {
      const v = r.headers.get(k);
      if (v) out.set(k, v);
    }
    return new Response(await r.arrayBuffer(), { status: r.status, headers: out });
  } catch {
    return galat(502, 'kesalahan_server', 'API Titeny tidak dapat dihubungi.');
  }
}
