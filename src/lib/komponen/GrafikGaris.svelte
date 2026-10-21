<script lang="ts">
  import { angka } from '$lib/format';
  import { hitungGrafik, type Titik } from '$lib/papan/grafik';

  let {
    titik,
    judul,
    satuan = 'Rp'
  }: { titik: Titik[]; judul: string; satuan?: string } = $props();

  const g = $derived(hitungGrafik(titik));
</script>

<figure class="w-full">
  <svg
    viewBox={`0 0 ${g.lebar} ${g.tinggi}`}
    class="h-auto w-full"
    role="img"
    aria-label={`${judul}. Rincian lengkap ada pada tabel di bawah grafik.`}
  >
    <path d={g.pita} fill="var(--ttn-hijau-latar)" stroke="none" />
    <path d={g.garis} fill="none" stroke="var(--ttn-primer)" stroke-width="2.5" stroke-linejoin="round" />
    {#each g.titik as t}
      <circle cx={t.x} cy={t.y} r="3.5" fill="var(--ttn-primer)" />
      <text x={t.x} y={g.tinggi - 6} text-anchor="middle" font-size="10" fill="var(--ttn-teks-lembut)">{t.label}</text>
    {/each}
    <text x="10" y="14" font-size="10" fill="var(--ttn-teks-lembut)">{satuan}{angka(g.yMaks)}</text>
    <text x="10" y={g.tinggi - 26} font-size="10" fill="var(--ttn-teks-lembut)">{satuan}{angka(g.yMin)}</text>
  </svg>
  <figcaption class="mt-1 text-xs text-ttn-lembut">Garis: prediksi. Pita hijau: rentang P10–P90.</figcaption>
</figure>
