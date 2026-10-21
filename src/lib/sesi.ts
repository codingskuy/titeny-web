/**
 * Sesi masuk per peran. SATU-SATUNYA tempat kredensial (PIN zona, access/refresh token)
 * disimpan. Tidak ada state global/store lain yang memegang token (TTN-WEB-005).
 *
 * - petani/vendor: PIN zona 6 digit, dikirim sebagai header `X-Zona-PIN`.
 * - CEO: JWT akses 15 menit + refresh 7 hari, dikirim sebagai `Authorization: Bearer`.
 *
 * Kredensial hidup di variabel tertutup (closure). Hanya PIN yang dipertahankan di
 * sessionStorage agar muat ulang halaman tidak memaksa masuk lagi; token CEO sengaja
 * hanya di memori (bahaya XSS) sehingga muat ulang meminta masuk + OTP lagi.
 */
import type { Peran } from './kontrak';

export interface Penyimpanan {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}

export type PasanganToken = { access_token: string; refresh_token: string; expires_in: number };
export type Pemilik = 'pin' | 'bearer' | null;

const KUNCI_PIN = 'ttn.sesi.pin';
export const POLA_PIN = /^\d{6}$/;

export function penyimpananAman(ambil: () => Storage | undefined): Penyimpanan | null {
  try {
    const s = ambil();
    if (!s) return null;
    const probe = '__ttn_probe__';
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}

export function buatSesi(opsi: { penyimpanan?: Penyimpanan | null; sekarang?: () => number } = {}) {
  const simpan = opsi.penyimpanan ?? null;
  const sekarang = opsi.sekarang ?? Date.now;

  let peran: Peran | null = null;
  let pin: string | null = null;
  let akses: string | null = null;
  let refresh: string | null = null;
  let aksesKedaluwarsa = 0;
  const pendengar = new Set<() => void>();

  const beri = () => pendengar.forEach((f) => f());

  // pulihkan PIN dari sessionStorage (token CEO tidak pernah dipulihkan)
  try {
    const mentah = simpan?.getItem(KUNCI_PIN);
    if (mentah) {
      const o = JSON.parse(mentah) as { peran?: string; pin?: string };
      if ((o.peran === 'petani' || o.peran === 'vendor') && o.pin && POLA_PIN.test(o.pin)) {
        peran = o.peran;
        pin = o.pin;
      }
    }
  } catch {
    /* abaikan data rusak */
  }

  function setToken(p: PasanganToken) {
    akses = p.access_token;
    refresh = p.refresh_token;
    aksesKedaluwarsa = sekarang() + p.expires_in * 1000;
  }

  return {
    masukDenganPin(untuk: 'petani' | 'vendor', nilaiPin: string) {
      if (!POLA_PIN.test(nilaiPin)) throw new Error('PIN harus 6 digit angka.');
      peran = untuk;
      pin = nilaiPin;
      akses = refresh = null;
      try {
        simpan?.setItem(KUNCI_PIN, JSON.stringify({ peran: untuk, pin: nilaiPin }));
      } catch {
        /* tanpa penyimpanan: tetap di memori */
      }
      beri();
    },
    masukDenganToken(p: PasanganToken) {
      peran = 'ceo';
      pin = null;
      setToken(p);
      try {
        simpan?.removeItem(KUNCI_PIN);
      } catch {
        /* abaikan */
      }
      beri();
    },
    perbaruiToken(p: PasanganToken) {
      setToken(p);
      beri();
    },
    keluar() {
      peran = pin = akses = refresh = null;
      aksesKedaluwarsa = 0;
      try {
        simpan?.removeItem(KUNCI_PIN);
      } catch {
        /* abaikan */
      }
      beri();
    },
    /** Data non-rahasia untuk UI. */
    snapshot(): { masuk: boolean; peran: Peran | null } {
      return { masuk: peran !== null, peran };
    },
    peranAktif(): Peran | null {
      return peran;
    },
    /** Header autentikasi sesuai peran aktif; objek kosong bila belum masuk. */
    headerAuth(): Record<string, string> {
      if (peran === 'ceo' && akses) return { Authorization: `Bearer ${akses}` };
      if ((peran === 'petani' || peran === 'vendor') && pin) return { 'X-Zona-PIN': pin };
      return {};
    },
    jenisAuth(): Pemilik {
      if (peran === 'ceo' && akses) return 'bearer';
      if ((peran === 'petani' || peran === 'vendor') && pin) return 'pin';
      return null;
    },
    refreshToken(): string | null {
      return refresh;
    },
    aksesHampirKedaluwarsa(marginMs = 30_000): boolean {
      return peran === 'ceo' && sekarang() + marginMs >= aksesKedaluwarsa;
    },
    langgan(fn: () => void): () => void {
      pendengar.add(fn);
      return () => pendengar.delete(fn);
    }
  };
}

export type Sesi = ReturnType<typeof buatSesi>;

export const sesi: Sesi = buatSesi({
  penyimpanan: penyimpananAman(() => (typeof sessionStorage === 'undefined' ? undefined : sessionStorage))
});
