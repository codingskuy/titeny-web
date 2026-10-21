/**
 * Konteks papan aktif (BUKAN kredensial): papan mengisi komoditas/zona/model_version
 * yang sedang tampil; umpan-balik dan analitik membacanya. Token hanya di `sesi.ts`.
 */
export const konteks = $state<{ komoditas_id?: string; zona?: string; model_version?: string }>({});

export function aturKonteks(k: { komoditas_id?: string; zona?: string; model_version?: string }) {
  konteks.komoditas_id = k.komoditas_id;
  konteks.zona = k.zona;
  konteks.model_version = k.model_version;
}
