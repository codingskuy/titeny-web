<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { namaPeran, peranDariPath, tujuanPenjaga } from '$lib/akses';
  import UmpanBalik from '$lib/komponen/UmpanBalik.svelte';
  import { sesi } from '$lib/sesi';

  let { children } = $props();

  let snap = $state(sesi.snapshot());
  $effect(() => sesi.langgan(() => (snap = sesi.snapshot())));

  const peranPapan = $derived(peranDariPath($page.url.pathname));
  const tujuan = $derived(tujuanPenjaga($page.url.pathname, snap.peran));

  $effect(() => {
    if (tujuan) void goto(tujuan, { replaceState: true });
  });

  function keluar() {
    sesi.keluar();
    void goto('/');
  }
</script>

{#if peranPapan && !tujuan}
  <header class="border-b border-ttn-garis bg-ttn-kartu">
    <div class="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
      <a href="/" class="font-bold">Titeny</a>
      <div class="flex items-center gap-3 text-sm">
        <span>{namaPeran[peranPapan]}</span>
        <button class="rounded-md border border-ttn-garis px-3 py-1" onclick={keluar}>Keluar</button>
      </div>
    </div>
  </header>
  <div class="mx-auto max-w-5xl px-4 pb-10">
    {@render children()}
    {#if peranPapan !== 'ceo'}
      <UmpanBalik />
    {/if}
  </div>
{:else}
  <p class="p-4 text-ttn-lembut" role="status">Mengarahkan ke halaman masuk…</p>
{/if}
