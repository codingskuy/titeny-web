<script lang="ts">
  import { PERAN_VALID, namaPeran } from '$lib/akses';

  const penjelasan = {
    petani: 'Kapan jual atau tahan? Prediksi harga H+1 sampai H+7.',
    vendor: 'Stok berapa untuk besok? Harga besok dan demand zona.',
    ceo: 'Margin aman? Peta surplus/defisit dan rekomendasi.'
  } as const;
</script>

<svelte:head><title>Titeny — Pilih peran</title></svelte:head>

<main class="mx-auto max-w-md px-4 py-8">
  <h1 id="beranda-judul" class="text-2xl font-bold">Titeny</h1>
  <p class="mt-1 text-ttn-lembut">Papan insight ChefGenie. Pilih peran Anda untuk masuk.</p>

  <ul class="mt-6 space-y-3">
    {#each PERAN_VALID as p}
      <li>
        <a
          id={`peran-${p}`}
          href={`/masuk?peran=${p}`}
          class="block rounded-lg border border-ttn-garis bg-ttn-kartu p-4 hover:border-ttn-primer"
        >
          <span class="block text-lg font-semibold">{namaPeran[p]}</span>
          <span class="block text-sm text-ttn-lembut">{penjelasan[p]}</span>
        </a>
      </li>
    {/each}
  </ul>
</main>
