/** Geometri grafik garis + pita P10-P90 (SVG murni; tanpa pustaka grafik). */
export type Titik = { label: string; nilai: number; bawah: number; atas: number };
export type Geometri = {
  lebar: number;
  tinggi: number;
  garis: string;
  pita: string;
  titik: { x: number; y: number; label: string }[];
  yMin: number;
  yMaks: number;
  yDariNilai: (v: number) => number;
};

export function hitungGrafik(titik: readonly Titik[], lebar = 340, tinggi = 180, pad = { k: 8, a: 8, kn: 8, b: 24 }): Geometri {
  const n = titik.length;
  const semua = titik.flatMap((t) => [t.bawah, t.atas, t.nilai]);
  let yMin = n ? Math.min(...semua) : 0;
  let yMaks = n ? Math.max(...semua) : 1;
  if (yMin === yMaks) {
    yMin -= 1;
    yMaks += 1;
  }
  const w = lebar - pad.k - pad.kn;
  const h = tinggi - pad.a - pad.b;
  const x = (i: number) => pad.k + (n <= 1 ? w / 2 : (i * w) / (n - 1));
  const y = (v: number) => pad.a + h - ((v - yMin) * h) / (yMaks - yMin);
  const f = (v: number) => Math.round(v * 10) / 10;
  const garis = titik.map((t, i) => `${i ? 'L' : 'M'}${f(x(i))},${f(y(t.nilai))}`).join(' ');
  const atas = titik.map((t, i) => `${i ? 'L' : 'M'}${f(x(i))},${f(y(t.atas))}`).join(' ');
  const bawah = [...titik.keys()]
    .reverse()
    .map((i) => `L${f(x(i))},${f(y(titik[i].bawah))}`)
    .join(' ');
  return {
    lebar,
    tinggi,
    garis,
    pita: n ? `${atas} ${bawah} Z` : '',
    titik: titik.map((t, i) => ({ x: f(x(i)), y: f(y(t.nilai)), label: t.label })),
    yMin,
    yMaks,
    yDariNilai: y
  };
}
