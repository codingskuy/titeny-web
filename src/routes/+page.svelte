<svelte:head>
  <title>Titeny — Papan Insight</title>
</svelte:head>

<main class="mx-auto max-w-3xl p-4">
  <h1 class="text-2xl font-bold" data-testid="judul-beranda">Titeny — Papan Insight</h1>
  <p class="opacity-70">Pilih peran untuk melihat prediksi harga, panen, dan demand.</p>
  <nav class="mt-4 grid gap-3" aria-label="Pilih peran">
    <a class="rounded border p-4" href="/insight/petani" data-testid="peran-petani">Petani</a>
    <a class="rounded border p-4" href="/insight/vendor" data-testid="peran-vendor">Vendor</a>
    <a class="rounded border p-4" href="/insight/ceo" data-testid="peran-ceo">CEO</a>
  </nav>
</main>
