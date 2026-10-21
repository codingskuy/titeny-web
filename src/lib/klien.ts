/**
 * Klien HTTP ke API Titeny (lewat proxy `/api/v1`). Kontrak: lihat `kontrak.ts`.
 *
 * - Header auth hanya dari modul `sesi` (PIN zona atau Bearer).
 * - Timeout 12 detik; untuk GET, bila timeout/jaringan/5xx dan ada cache, kembalikan cache
 *   terakhir + stempel waktu (`basi: true`). Tidak ada spinner tanpa batas.
 * - 401 pada akun Bearer: refresh token sekali (single-flight), lalu ulangi permintaan.
 * - 429: tidak diulang otomatis; `retryAfter` dibawa di galat.
 */
import type { z } from 'zod';
import { GalatSkema, TokenPasangSkema } from './kontrak';
import { sesi as sesiBawaan, type Penyimpanan, type Sesi } from './sesi';

export const TIMEOUT_MS = 12_000;

export class GalatApi extends Error {
  constructor(
    public status: number,
    public kode: string,
    pesan: string,
    public field: string | null = null,
    public retryAfter: number | null = null
  ) {
    super(pesan);
    this.name = 'GalatApi';
  }
}

export type Hasil<T> = {
  data: T;
  /** true bila data berasal dari cache karena permintaan gagal/timeout */
  basi: boolean;
  /** ISO-8601 saat data diambil dari server */
  diambilPada: string;
};

type Query = Record<string, string | number | undefined | null>;

type Opsi<T> = {
  metode?: 'GET' | 'POST';
  query?: Query;
  bodi?: unknown;
  skema: z.ZodType<T>;
  /** false untuk endpoint tanpa autentikasi (login, OTP, refresh, kesehatan) */
  auth?: boolean;
  idempotensi?: string;
  /** false = jangan simpan/baca cache */
  cache?: boolean;
};

export type OpsiKlien = {
  basis?: string;
  fetch?: typeof fetch;
  sesi?: Sesi;
  timeoutMs?: number;
  penyimpananCache?: Penyimpanan | null;
  sekarang?: () => Date;
};

const AWALAN_CACHE = 'ttn.cache.';

export function buatKlien(o: OpsiKlien = {}) {
  const basis = (o.basis ?? '/api/v1').replace(/\/$/, '');
  const ambil = o.fetch ?? ((...a: Parameters<typeof fetch>) => fetch(...a));
  const sesi = o.sesi ?? sesiBawaan;
  const timeoutMs = o.timeoutMs ?? TIMEOUT_MS;
  const cacheStore = o.penyimpananCache ?? null;
  const sekarang = o.sekarang ?? (() => new Date());

  let refreshBerjalan: Promise<boolean> | null = null;

  function bangunUrl(path: string, query?: Query): string {
    const sp = new URLSearchParams();
    for (const k of Object.keys(query ?? {}).sort()) {
      const v = query![k];
      if (v !== undefined && v !== null && v !== '') sp.set(k, String(v));
    }
    const qs = sp.toString();
    return `${basis}${path}${qs ? `?${qs}` : ''}`;
  }

  function kunciCache(url: string): string {
    return `${AWALAN_CACHE}${sesi.peranAktif() ?? 'anon'}:${url}`;
  }

  function bacaCache<T>(url: string, skema: z.ZodType<T>): Hasil<T> | null {
    try {
      const mentah = cacheStore?.getItem(kunciCache(url));
      if (!mentah) return null;
      const o2 = JSON.parse(mentah) as { data: unknown; diambilPada: string };
      const p = skema.safeParse(o2.data);
      return p.success ? { data: p.data, basi: true, diambilPada: o2.diambilPada } : null;
    } catch {
      return null;
    }
  }

  function tulisCache(url: string, data: unknown, diambilPada: string) {
    try {
      cacheStore?.setItem(kunciCache(url), JSON.stringify({ data, diambilPada }));
    } catch {
      /* kuota penuh: abaikan */
    }
  }

  async function kirim(url: string, metode: string, headers: Record<string, string>, bodi?: unknown): Promise<Response> {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeoutMs);
    try {
      return await ambil(url, {
        method: metode,
        headers,
        body: bodi === undefined ? undefined : JSON.stringify(bodi),
        signal: ac.signal
      });
    } finally {
      clearTimeout(timer);
    }
  }

  async function galatDari(r: Response): Promise<GalatApi> {
    const ra = Number(r.headers.get('Retry-After'));
    const retryAfter = Number.isFinite(ra) && ra > 0 ? ra : null;
    try {
      const p = GalatSkema.safeParse(await r.json());
      if (p.success) {
        const e = p.data.error;
        return new GalatApi(r.status, e.kode, e.pesan, e.field ?? null, retryAfter);
      }
    } catch {
      /* bodi bukan JSON */
    }
    return new GalatApi(r.status, 'kesalahan_server', `Permintaan gagal (${r.status}).`, null, retryAfter);
  }

  async function perbaruiToken(): Promise<boolean> {
    const rt = sesi.refreshToken();
    if (!rt) return false;
    refreshBerjalan ??= (async () => {
      try {
        const r = await kirim(`${basis}/auth/refresh`, 'POST', { 'Content-Type': 'application/json' }, {
          refresh_token: rt
        });
        if (!r.ok) return false;
        const p = TokenPasangSkema.safeParse(await r.json());
        if (!p.success) return false;
        sesi.perbaruiToken(p.data);
        return true;
      } catch {
        return false;
      } finally {
        setTimeout(() => (refreshBerjalan = null), 0);
      }
    })();
    return refreshBerjalan;
  }

  async function minta<T>(path: string, opsi: Opsi<T>): Promise<Hasil<T>> {
    const metode = opsi.metode ?? 'GET';
    const url = bangunUrl(path, opsi.query);
    const pakaiCache = metode === 'GET' && opsi.cache !== false;

    const buatHeader = () => {
      const h: Record<string, string> = { Accept: 'application/json' };
      if (opsi.bodi !== undefined) h['Content-Type'] = 'application/json';
      if (opsi.idempotensi) h['X-Idempotency-Key'] = opsi.idempotensi;
      if (opsi.auth !== false) Object.assign(h, sesi.headerAuth());
      return h;
    };

    const cadangan = (e: GalatApi): Hasil<T> => {
      const c = pakaiCache ? bacaCache(url, opsi.skema) : null;
      if (c) return c;
      throw e;
    };

    let r: Response;
    try {
      if (opsi.auth !== false && sesi.aksesHampirKedaluwarsa()) await perbaruiToken();
      r = await kirim(url, metode, buatHeader(), opsi.bodi);
      if (r.status === 401 && opsi.auth !== false && sesi.jenisAuth() === 'bearer') {
        if (await perbaruiToken()) r = await kirim(url, metode, buatHeader(), opsi.bodi);
        else sesi.keluar();
      }
    } catch (e) {
      const aborsi = e instanceof DOMException ? e.name === 'AbortError' : (e as Error)?.name === 'AbortError';
      return cadangan(
        new GalatApi(0, aborsi ? 'timeout' : 'jaringan', aborsi ? 'Server terlalu lama menjawab.' : 'Tidak ada koneksi ke server.')
      );
    }

    if (!r.ok) {
      const g = await galatDari(r);
      if (r.status >= 500) return cadangan(g);
      throw g;
    }

    let json: unknown;
    try {
      json = await r.json();
    } catch {
      return cadangan(new GalatApi(r.status, 'respons_tidak_sesuai', 'Jawaban server bukan JSON.'));
    }
    const p = opsi.skema.safeParse(json);
    if (!p.success) {
      return cadangan(new GalatApi(r.status, 'respons_tidak_sesuai', 'Jawaban server tidak sesuai kontrak.'));
    }
    const diambilPada = sekarang().toISOString();
    if (pakaiCache) tulisCache(url, json, diambilPada);
    return { data: p.data, basi: false, diambilPada };
  }

  function hapusCache() {
    try {
      const s = cacheStore as (Penyimpanan & { length?: number; key?: (i: number) => string | null }) | null;
      if (!s || typeof s.length !== 'number' || !s.key) return;
      const hapus: string[] = [];
      for (let i = 0; i < s.length; i++) {
        const k = s.key(i);
        if (k?.startsWith(AWALAN_CACHE)) hapus.push(k);
      }
      hapus.forEach((k) => s.removeItem(k));
    } catch {
      /* abaikan */
    }
  }

  return { minta, hapusCache, bangunUrl };
}

export type Klien = ReturnType<typeof buatKlien>;
