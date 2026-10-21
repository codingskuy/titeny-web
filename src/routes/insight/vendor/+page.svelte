<script lang="ts">
  import { onMount } from 'svelte';
  import { analitik } from '$lib/analitik';

  onMount(() => {
    analitik.resetHalaman();
    analitik.catat({ nama: 'papan.dibuka' });
  });
</script>

<svelte:head><title>Papan vendor — Titeny</title></svelte:head>

<main class="py-6">
  <h1 class="text-2xl font-bold">Papan vendor</h1>
  <p class="mt-2 text-ttn-lembut">Isi papan menyusul pada tiket berikutnya.</p>
</main>
