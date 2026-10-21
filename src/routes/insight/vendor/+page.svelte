<script lang="ts">
  import { onMount } from 'svelte';
  import { analitik } from '$lib/analitik';
  import { api } from '$lib/api';
  import { angka, hariIniWib, kg, rupiah, stempelWib } from '$lib/format';
  import { aturKonteks } from '$lib/konteks.svelte';
  import { penyimpananAman } from '$lib/sesi';
  import { terlihat } from '$lib/terlihat';
  import {
    adalahEstimasi,
    buatBaris,
    buatPenyimpananStok,
    muatVendor,
    parseKg
  } from '$lib/papan/vendor';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  /** Polling 30 menit (cache server 6 jam), bukan push. */
  const POLL_MS = 30 * 60 * 1000;
  const penyimpan = buatPenyimpananStok(
    penyimpananAman(() => (typeof localStorage === 'undefined' ? undefined : localStorage))
  );

  type Hasil = Awaited<ReturnType<typeof muatVendor>>;
  let hasil = $state<Hasil | null>(null);
  let memuat = $state(true);
  let stok = $state<Record<string, number>>({});
  let teksStok = $state<Record<string, string>>({});
  let sudahDibuka = false;

  onMount(() => {
    stok = penyimpan.baca();
    teksStok = Object.fromEntries(Object.entries(stok).map(([k, v]) => [k, String(v).replace('.', ',')]));
    return () => aturKonteks({});
  });

  async function muat() {
    memuat = true;
    hasil = await muatVendor(api, { zona: data.zona });
    memuat = false;
    const ok = hasil.mentah.find((m) => m.demand.status === 'ok');
    const d = ok && ok.demand.status === 'ok' ? ok.demand.data : null;
    aturKonteks({ zona: d?.zona, model_version: d?.model_version });
    if (!sudahDibuka) {
      sudahDibuka = true;
      analitik.resetHalaman();
      analitik.catat({ nama: 'papan.dibuka', zona: d?.zona, model_version: d?.model_version });
    }
  }

  $effect(() => {
    void data.zona;
    void muat();
  });
  $effect(() => {
    const t = setInterval(() => void muat(), POLL_MS);
    return () => clearInterval(t);
  });

  function ubahStok(id: string, teks: string) {
    teksStok[id] = teks;
    if (teks.trim() === '') {
      delete stok[id];
      penyimpan.simpan(id, null);
      return;
    }
    const n = parseKg(teks);
    if (n !== null) {
      stok[id] = n;
      penyimpan.simpan(id, n);
    }
  }

  const baris = $derived(
    (hasil?.mentah ?? []).map((m) => buatBaris({ id: m.id, nama: m.nama }, m.harga, m.demand, stok[m.id] ?? 0))
  );
  const estimasi = $derived(
    hasil ? adalahEstimasi(hariIniWib(), hasil.jobTerakhir, baris.filter((b) => b.status === 'ok')) : false
  );
  const semuaGalat = $derived(baris.length > 0 && baris.every((b) => b.status === 'galat'));

  const kelas = {
    hijau: 'bg-ttn-hijau-latar text-ttn-hijau',
    kuning: 'bg-ttn-kuning-latar text-ttn-kuning',
    merah: 'bg-ttn-merah-latar text-ttn-merah'
  } as const;
  const ikon = { hijau: '●', kuning: '▲', merah: '■' } as const;
</script>

<svelte:head><title>Papan vendor — Titeny</title></svelte:head>

<main class="py-4">
  <h1 class="text-2xl font-bold">Papan vendor</h1>
  <p class="mt-1 text-sm text-ttn-lembut">Tabel besok, saran stok, dan peringatan zona.</p>

  {#if memuat && !hasil}
    <p class="mt-4 text-ttn-lembut" role="status">Memuat data…</p>
  {/if}

  {#if hasil}
    {#if hasil.basi && hasil.diambilPada}
      <p role="status" class="mt-3 rounded-md bg-ttn-kuning-latar px-3 py-2 text-sm text-ttn-kuning">
        Server lambat atau tidak terjangkau. Menampilkan data tersimpan per {stempelWib(hasil.diambilPada)}.
      </p>
    {/if}
    {#if estimasi}
      <p role="status" class="mt-3 rounded-md bg-ttn-kuning-latar px-3 py-2 text-sm font-semibold text-ttn-kuning">
        Estimasi — transaksi kemarin belum masuk.
      </p>
    {/if}
    {#if semuaGalat}
      <p role="alert" class="mt-3 rounded-md bg-ttn-merah-latar px-3 py-2 text-ttn-merah">{baris[0]?.pesan}</p>
      <button class="mt-2 rounded-md border border-ttn-garis px-3 py-1" onclick={() => void muat()}>Coba lagi</button>
    {/if}

    <section class="mt-4 rounded-lg border border-ttn-garis bg-ttn-kartu p-3" aria-labelledby="h-tabel" use:terlihat={{ kartu: 'tabel_besok' }}>
      <h2 id="h-tabel" class="font-semibold">Tabel besok</h2>
      <table class="mt-2 w-full table-fixed text-left text-xs">
        <caption class="sr-only">Komoditas, harga besok, demand H+7 dalam kg, dan saran stok dalam kg</caption>
        <thead>
          <tr class="border-b border-ttn-garis">
            <th scope="col" class="w-[34%] py-1 pr-1">Komoditas</th>
            <th scope="col" class="w-[22%] py-1 pr-1">Harga besok</th>
            <th scope="col" class="w-[22%] py-1 pr-1">Demand H+7 (kg)</th>
            <th scope="col" class="py-1">Saran stok (kg)</th>
          </tr>
        </thead>
        <tbody>
          {#each baris as b (b.id)}
            <tr class="border-b border-ttn-garis/60 align-top">
              <th scope="row" class="py-2 pr-1 font-medium">
                {b.nama}
                <label class="mt-1 block text-[11px] font-normal text-ttn-lembut" for={`stok-${b.id}`}>Stok di tangan (kg)</label>
                <input
                  id={`stok-${b.id}`}
                  class="mt-0.5 w-full rounded border border-ttn-garis px-1 py-1 text-xs font-normal"
                  inputmode="decimal"
                  placeholder="0"
                  value={teksStok[b.id] ?? ''}
                  oninput={(e) => ubahStok(b.id, e.currentTarget.value)}
                  aria-invalid={(teksStok[b.id] ?? '') !== '' && parseKg(teksStok[b.id]) === null}
                />
              </th>
              {#if b.status === 'ok' && b.demand7 !== null && b.saran !== null}
                <td class="py-2 pr-1 break-words">{b.hargaBesok !== null ? rupiah(b.hargaBesok) : '-'}</td>
                <td class="py-2 pr-1">{angka(b.demand7)}</td>
                <td class="py-2">
                  <span class="font-semibold">{kg(b.saran)}</span>
                  {#if b.peringatan}
                    <span class="mt-1 block rounded px-1 py-0.5 font-semibold {kelas[b.peringatan.kunci]}">
                      <span aria-hidden="true">{ikon[b.peringatan.kunci]}</span> {b.peringatan.teks}
                    </span>
                  {/if}
                </td>
              {:else}
                <td class="py-2 text-ttn-lembut" colspan="3">{b.pesan ?? 'Data belum tersedia.'}</td>
              {/if}
            </tr>
          {/each}
        </tbody>
      </table>
      <p class="mt-2 text-xs text-ttn-lembut">
        Saran stok = demand harian rerata (H+7 ÷ 7) × 1,15 − stok di tangan. Stok yang Anda isi tersimpan di perangkat ini saja.
      </p>
    </section>
  {/if}
</main>
