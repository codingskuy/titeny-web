<script lang="ts">
  import { api } from '$lib/api';
  import { analitik } from '$lib/analitik';
  import { konteks } from '$lib/konteks.svelte';
  import { pesanGalat } from '$lib/masuk';

  let nilai: 'bermanfaat' | 'kurang_tepat' | null = $state(null);
  let komentar = $state('');
  let status: 'diam' | 'kirim' | 'terkirim' | 'galat' = $state('diam');
  let pesan = $state('');
  const sisa = $derived(280 - komentar.length);

  async function kirim(e: SubmitEvent) {
    e.preventDefault();
    if (!nilai || status === 'kirim') return;
    status = 'kirim';
    try {
      await api.umpanBalik({
        nilai,
        komentar: komentar.trim() || undefined,
        komoditas_id: konteks.komoditas_id
      });
      analitik.catat({
        nama: 'umpan_balik.diberi',
        komoditas_id: konteks.komoditas_id,
        zona: konteks.zona,
        model_version: konteks.model_version
      });
      status = 'terkirim';
    } catch (err) {
      pesan = pesanGalat(err);
      status = 'galat';
    }
  }
</script>

<section class="mt-8 rounded-lg border border-ttn-garis bg-ttn-kartu p-4" aria-labelledby="judul-umpan-balik">
  <h2 id="judul-umpan-balik" class="font-semibold">Apakah papan ini membantu?</h2>
  {#if status === 'terkirim'}
    <p id="umpan-balik-terima" role="status" class="mt-2 text-ttn-hijau">Terima kasih, penilaian Anda tercatat.</p>
  {:else}
    <form onsubmit={kirim} class="mt-2">
      <div class="flex gap-2" role="group" aria-label="Penilaian">
        <button
          id="nilai-bermanfaat"
          type="button"
          class="flex-1 rounded-md border px-3 py-2 {nilai === 'bermanfaat' ? 'border-ttn-primer bg-ttn-hijau-latar font-semibold' : 'border-ttn-garis'}"
          aria-pressed={nilai === 'bermanfaat'}
          onclick={() => (nilai = 'bermanfaat')}>Bermanfaat</button
        >
        <button
          type="button"
          class="flex-1 rounded-md border px-3 py-2 {nilai === 'kurang_tepat' ? 'border-ttn-primer bg-ttn-kuning-latar font-semibold' : 'border-ttn-garis'}"
          aria-pressed={nilai === 'kurang_tepat'}
          onclick={() => (nilai = 'kurang_tepat')}>Kurang tepat</button
        >
      </div>
      <label class="mt-3 block text-sm" for="komentar-umpan-balik">Komentar (opsional, jangan tulis data pribadi)</label>
      <textarea
        id="komentar-umpan-balik"
        class="mt-1 w-full rounded-md border border-ttn-garis px-3 py-2"
        rows="3"
        maxlength="280"
        bind:value={komentar}
      ></textarea>
      <p class="text-right text-xs text-ttn-lembut">{sisa} karakter tersisa</p>
      <button
        id="kirim-umpan-balik"
        class="mt-2 w-full rounded-md bg-ttn-primer px-4 py-2 font-semibold text-ttn-primer-teks disabled:opacity-60"
        disabled={!nilai || status === 'kirim'}>{status === 'kirim' ? 'Mengirim…' : 'Kirim penilaian'}</button
      >
      {#if status === 'galat'}
        <p role="alert" class="mt-2 text-ttn-merah">{pesan}</p>
      {/if}
    </form>
  {/if}
  <p class="mt-2 text-xs text-ttn-lembut">Penilaian dipakai untuk metrik adopsi; tidak mengubah model otomatis.</p>
</section>
