/**
 * Daftar komoditas. ASUMSI: slug diturunkan dari deskripsi skema `KomoditasId` di openapi.yaml
 * (pola `^cmd_[a-z_]+$`); kontrak belum punya endpoint daftar komoditas (lihat ADR-0004).
 */
export const KOMODITAS_HARGA = [
  { id: 'cmd_beras_medium', nama: 'Beras medium' },
  { id: 'cmd_telur_ayam', nama: 'Telur ayam' },
  { id: 'cmd_cabai_merah', nama: 'Cabai merah' },
  { id: 'cmd_cabai_rawit', nama: 'Cabai rawit' },
  { id: 'cmd_bawang_merah', nama: 'Bawang merah' },
  { id: 'cmd_bawang_putih', nama: 'Bawang putih' },
  { id: 'cmd_minyak_goreng_curah', nama: 'Minyak goreng curah' },
  { id: 'cmd_gula_pasir', nama: 'Gula pasir' },
  { id: 'cmd_daging_ayam', nama: 'Daging ayam' },
  { id: 'cmd_daging_sapi', nama: 'Daging sapi' },
  { id: 'cmd_tomat', nama: 'Tomat' },
  { id: 'cmd_kangkung', nama: 'Kangkung' }
] as const;

export const KOMODITAS_PANEN: readonly string[] = [
  'cmd_padi',
  'cmd_jagung',
  'cmd_cabai_merah',
  'cmd_cabai_rawit',
  'cmd_bawang_merah',
  'cmd_tomat'
];

export const namaKomoditas = (id: string): string =>
  KOMODITAS_HARGA.find((k) => k.id === id)?.nama ??
  (id === 'cmd_padi' ? 'Padi' : id === 'cmd_jagung' ? 'Jagung' : id.replace(/^cmd_/, '').replaceAll('_', ' '));

export const adalahKomoditas = (id: string | null | undefined): id is string =>
  !!id && (KOMODITAS_HARGA.some((k) => k.id === id) || KOMODITAS_PANEN.includes(id));
