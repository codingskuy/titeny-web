import { analitik } from './analitik';

type Param = { kartu: string; komoditas_id?: string; zona?: string; model_version?: string };

/** Aksi Svelte: catat `kartu.terlihat` sekali saat >= 50% kartu masuk layar. */
export function terlihat(node: HTMLElement, param: Param) {
  if (typeof IntersectionObserver === 'undefined') return {};
  let p = param;
  const io = new IntersectionObserver(
    (es) => {
      if (es.some((e) => e.isIntersecting)) {
        analitik.catat({ nama: 'kartu.terlihat', ...p });
        io.disconnect();
      }
    },
    { threshold: 0.5 }
  );
  io.observe(node);
  return {
    update(baru: Param) {
      p = baru;
    },
    destroy() {
      io.disconnect();
    }
  };
}
