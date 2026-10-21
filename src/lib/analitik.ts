/**
 * Instrumentasi adopsi (BR-302/304/305). Tiga peristiwa: `papan.dibuka`, `kartu.terlihat`,
 * `umpan_balik.diberi`, berisi peran, komoditas/zona, `model_version` -- TANPA data pribadi.
 * Skema `.strict()` menolak field tak dikenal (mis. PIN, token, komentar bebas).
 *
 * CATATAN KONTRAK: openapi.yaml backend belum punya endpoint penampung peristiwa analitik.
 * Sink bawaan hanya menyimpan buffer di memori (dan console.debug saat dev). Ganti lewat
 * `aturSink()` begitu kontrak endpoint terbit (lihat ADR-0003, "gap kontrak").
 */
import { z } from 'zod';
import { Peran } from './kontrak';
import { sesi } from './sesi';

const Slug = z.string().regex(/^[a-z0-9_]{1,64}$/);

export const PeristiwaSkema = z
  .object({
    nama: z.enum(['papan.dibuka', 'kartu.terlihat', 'umpan_balik.diberi']),
    peran: Peran,
    komoditas_id: z.string().regex(/^cmd_[a-z_]+$/).optional(),
    zona: Slug.optional(),
    kartu: Slug.optional(),
    model_version: z.string().regex(/^[a-z_]+_v\d+\.\d+\.\d+$/).optional(),
    waktu: z.string()
  })
  .strict();
export type Peristiwa = z.infer<typeof PeristiwaSkema>;
export type MasukanPeristiwa = Omit<Peristiwa, 'peran' | 'waktu'>;
export type Sink = (p: Peristiwa) => void;

export function buatAnalitik(
  o: {
    sink?: Sink;
    peran?: () => Peran | null;
    sekarang?: () => Date;
  } = {}
) {
  let sink: Sink = o.sink ?? (() => {});
  const peran = o.peran ?? (() => sesi.peranAktif());
  const sekarang = o.sekarang ?? (() => new Date());
  const terlihat = new Set<string>();

  return {
    aturSink(s: Sink) {
      sink = s;
    },
    /** Mengembalikan peristiwa yang dikirim, atau null bila ditolak/duplikat. Tidak pernah melempar. */
    catat(m: MasukanPeristiwa): Peristiwa | null {
      const p = peran();
      if (!p) return null;
      const hasil = PeristiwaSkema.safeParse({ ...m, peran: p, waktu: sekarang().toISOString() });
      if (!hasil.success) return null;
      if (m.nama === 'kartu.terlihat') {
        const k = `${m.kartu ?? ''}|${m.komoditas_id ?? ''}|${m.zona ?? ''}`;
        if (terlihat.has(k)) return null;
        terlihat.add(k);
      }
      try {
        sink(hasil.data);
      } catch {
        /* analitik tak boleh merusak papan */
      }
      return hasil.data;
    },
    /** Panggil saat berpindah papan agar `kartu.terlihat` dihitung ulang. */
    resetHalaman() {
      terlihat.clear();
    }
  };
}

export type Analitik = ReturnType<typeof buatAnalitik>;

const buffer: Peristiwa[] = [];
export const peristiwaTertunda = (): readonly Peristiwa[] => buffer;

export const analitik: Analitik = buatAnalitik({
  sink: (p) => {
    buffer.push(p);
    if (buffer.length > 200) buffer.shift();
    if (import.meta.env?.DEV) console.debug('[analitik]', p);
  }
});
