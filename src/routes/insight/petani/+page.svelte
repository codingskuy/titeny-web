<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { analitik } from '$lib/analitik';
  import { api } from '$lib/api';
  import { rupiah, stempelWib, tanggalPendek, hariIniWib, kg } from '$lib/format';
  import GrafikGaris from '$lib/komponen/GrafikGaris.svelte';
  import { KOMODITAS_HARGA, namaKomoditas } from '$lib/komoditas';
  import { aturKonteks } from '$lib/konteks.svelte';
  import { akurasiTerbatas, tentukanKeputusan } from '$lib/papan/keputusan';
  import { muatPetani, type StatePetani } from '$lib/papan/muat';
  import { terlihat } from '$lib/terlihat';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  /** Polling (bukan push): data prediksi di-cache 6 jam, cek ulang tiap 30 menit. */
  const POLL_MS = 30 * 60 * 1000;
  /** Tautan form TitipO/Lumbung belum ada di kontrak; diatur lewat env saat tersedia (ADR-0004). */
  const URL_TAWAR_GUDANG: string | undefined = import.meta.env.VITE_URL_TAWAR_GUDANG;

  let isi = $state<StatePetani | null>(null);
  let memuat = $state(true);
  let sudahDibuka = false;

  async function muat() {
    memuat = true;
    const hasil = await muatPetani(api, {
      komoditas_id: data.komoditas_id,
      pasar_id: data.pasar_id,
      kabupaten_id: data.kabupaten_id
    });
    isi = hasil;
    memuat = false;
    const mv = hasil.harga.status === 'ok' ? hasil.harga.data.model_version : undefined;
    const zona = hasil.harga.status === 'ok' ? hasil.harga.data.pasar_id : undefined;
    aturKonteks({ komoditas_id: data.komoditas_id, zona, model_version: mv });
    if (!sudahDibuka && hasil.harga.status !== 'galat') {
      sudahDibuka = true;
      analitik.resetHalaman();
      analitik.catat({ nama: 'papan.dibuka', komoditas_id: data.komoditas_id, zona, model_version: mv });
    }
  }

  $effect(() => {
    // dibaca di sini agar efek berjalan ulang saat komoditas/pasar/kabupaten berubah
    void [data.komoditas_id, data.pasar_id, data.kabupaten_id];
    void muat();
  });

  $effect(() => {
    const t = setInterval(() => void muat(), POLL_MS);
    return () => clearInterval(t);
  });

  onMount(() => () => aturKonteks({}));

  const hargaOk = $derived(isi?.harga.status === 'ok' ? isi.harga : null);
  const deret = $derived(hargaOk?.data.deret ?? []);
  const keputusan = $derived(deret.length ? tentukanKeputusan(deret, hariIniWib()) : null);
  const terbatas = $derived(akurasiTerbatas(deret));
  const titik = $derived(
    deret.map((p) => ({ label: p.horizon, nilai: p.harga_prediksi, bawah: p.rentang_bawah, atas: p.rentang_atas }))
  );
  const panenOk = $derived(isi?.panen?.status === 'ok' ? isi.panen : null);
  const panenDeret = $derived(
    [...(panenOk?.data.deret ?? [])].sort((a, b) => a.minggu.localeCompare(b.minggu)).slice(0, 4)
  );

  const kelasLencana = {
    'TAHAN 3 HARI': 'bg-ttn-hijau-latar text-ttn-hijau border-ttn-hijau',
    'JUAL SEKARANG': 'bg-ttn-merah-latar text-ttn-merah border-ttn-merah',
    'CICIL JUAL': 'bg-ttn-kuning-latar text-ttn-kuning border-ttn-kuning'
  } as const;

  function pilih(e: Event) {
    const v = (e.currentTarget as HTMLSelectElement).value;
    void goto(`?komoditas_id=${encodeURIComponent(v)}`, { keepFocus: true, noScroll: true });
  }
</script>

<svelte:head><title>Papan petani — Titeny</title></svelte:head>

<main class="py-4">
  <h1 class="text-2xl font-bold">Papan petani</h1>

  <label class="mt-3 block text-sm font-medium" for="komoditas">Komoditas</label>
  <select
    id="komoditas"
    class="mt-1 w-full rounded-md border border-ttn-garis bg-ttn-kartu px-3 py-2 text-base"
    value={data.komoditas_id}
    onchange={pilih}
  >
    {#each KOMODITAS_HARGA as k}
      <option value={k.id}>{k.nama}</option>
    {/each}
  </select>

  {#if memuat && !isi}
    <p class="mt-4 text-ttn-lembut" role="status">Memuat data…</p>
  {/if}

  {#if isi}
    <!-- Kartu harga -->
    <section class="mt-4 min-w-0 rounded-lg border border-ttn-garis bg-ttn-kartu p-4" aria-labelledby="h-harga" use:terlihat={{ kartu: 'harga', komoditas_id: data.komoditas_id, zona: hargaOk?.data.pasar_id, model_version: hargaOk?.data.model_version }}>
      <h2 id="h-harga" class="font-semibold">Harga {namaKomoditas(data.komoditas_id)}: prediksi H+1 sampai H+7</h2>

      {#if isi.harga.status === 'ok'}
        {@const h = isi.harga}
        {#if h.basi}
          <p role="status" class="mt-2 rounded-md bg-ttn-kuning-latar px-3 py-2 text-sm text-ttn-kuning">
            Server lambat atau tidak terjangkau. Menampilkan data tersimpan per {stempelWib(h.diambilPada)}.
          </p>
        {/if}
        {#if terbatas}
          <p class="mt-2 inline-block rounded-full border border-ttn-kuning bg-ttn-kuning-latar px-3 py-1 text-sm font-semibold text-ttn-kuning">
            Akurasi terbatas
          </p>
        {/if}
        <div class="mt-3"><GrafikGaris {titik} judul={`Prediksi harga ${namaKomoditas(data.komoditas_id)} H+1 sampai H+7`} /></div>

        <table class="mt-3 w-full table-fixed text-left text-xs">
          <caption class="sr-only">Tabel prediksi harga dengan rentang P10–P90 dan kepercayaan</caption>
          <thead>
            <tr class="border-b border-ttn-garis">
              <th scope="col" class="w-1/4 py-1 pr-1">Hari</th>
              <th scope="col" class="w-1/4 py-1 pr-1">Prediksi</th>
              <th scope="col" class="w-1/3 py-1 pr-1">P10–P90</th>
              <th scope="col" class="py-1">Yakin</th>
            </tr>
          </thead>
          <tbody>
            {#each deret as p}
              <tr class="border-b border-ttn-garis/60 align-top">
                <th scope="row" class="py-1 pr-1 font-normal">{p.horizon}<br /><span class="text-ttn-lembut">{tanggalPendek(p.tanggal)}</span></th>
                <td class="py-1 pr-1 font-semibold">{rupiah(p.harga_prediksi)}</td>
                <td class="py-1 pr-1 break-words">{rupiah(p.rentang_bawah)}–{rupiah(p.rentang_atas)}</td>
                <td class="py-1">{p.kepercayaan}</td>
              </tr>
            {/each}
          </tbody>
        </table>
        <p class="mt-2 text-xs text-ttn-lembut">
          Model {h.data.model_version}, dihitung {stempelWib(h.data.dihitung_pada)}. Acuan perbandingan: harga
          {keputusan?.acuan ? `${keputusan.acuan.horizon} (${tanggalPendek(keputusan.acuan.tanggal)})` : '-'}.
        </p>
      {:else if isi.harga.status === 'kosong'}
        <p class="mt-3 rounded-md bg-ttn-kuning-latar px-3 py-2 font-semibold text-ttn-kuning" role="status">{isi.harga.pesan}</p>
      {:else}
        <p class="mt-3 rounded-md bg-ttn-merah-latar px-3 py-2 text-ttn-merah" role="alert">{isi.harga.pesan}</p>
        <button class="mt-2 rounded-md border border-ttn-garis px-3 py-1" onclick={() => void muat()}>Coba lagi</button>
      {/if}
    </section>

    <!-- Kartu keputusan -->
    {#if keputusan}
      <section class="mt-4 rounded-lg border border-ttn-garis bg-ttn-kartu p-4" aria-labelledby="h-keputusan" use:terlihat={{ kartu: 'keputusan', komoditas_id: data.komoditas_id, model_version: hargaOk?.data.model_version }}>
        <h2 id="h-keputusan" class="font-semibold">Saran keputusan</h2>
        <p class="mt-2 inline-block rounded-md border-2 px-4 py-2 text-lg font-bold {kelasLencana[keputusan.lencana]}">
          {keputusan.lencana}
        </p>
        <p class="mt-2">{keputusan.alasan}</p>
        {#if keputusan.h3?.alasan_singkat}
          <p class="mt-1 text-sm text-ttn-lembut">Faktor: {keputusan.h3.alasan_singkat.replaceAll('_', ' ')}</p>
        {/if}
      </section>
    {/if}

    <!-- Kartu cuaca-panen -->
    {#if isi.panen !== null}
      <section class="mt-4 rounded-lg border border-ttn-garis bg-ttn-kartu p-4" aria-labelledby="h-panen" use:terlihat={{ kartu: 'cuaca_panen', komoditas_id: data.komoditas_id }}>
        <h2 id="h-panen" class="font-semibold">Panen kabupaten: prediksi M+1 sampai M+4</h2>
        {#if isi.panen.status === 'ok'}
          {#if panenDeret.length === 0}
            <p class="mt-2 text-ttn-lembut">Belum ada prediksi panen.</p>
          {:else}
            <ul class="mt-2 space-y-1 text-sm">
              {#each panenDeret as p}
                <li>
                  <span class="font-medium">{p.minggu}</span>: {kg(p.panen_prediksi_kg)}
                  {#if p.rentang_bawah_kg !== undefined && p.rentang_atas_kg !== undefined}
                    <span class="text-ttn-lembut">({kg(p.rentang_bawah_kg)}–{kg(p.rentang_atas_kg)})</span>
                  {/if}
                  <span class="text-ttn-lembut">· yakin {p.kepercayaan}</span>
                </li>
              {/each}
            </ul>
          {/if}
        {:else}
          <p class="mt-2 text-ttn-lembut" role="status">{isi.panen.pesan}</p>
        {/if}
        <p class="mt-2 text-xs text-ttn-lembut">Data hujan 7 hari belum tersedia di API (menunggu kontrak cuaca).</p>
      </section>
    {/if}

    <!-- Tombol aksi -->
    <section class="mt-4 rounded-lg border border-ttn-garis bg-ttn-kartu p-4" aria-labelledby="h-aksi">
      <h2 id="h-aksi" class="font-semibold">Jual ke gudang</h2>
      {#if URL_TAWAR_GUDANG}
        <a
          class="mt-2 block rounded-md bg-ttn-primer px-4 py-3 text-center font-semibold text-ttn-primer-teks"
          href={URL_TAWAR_GUDANG}
          target="_blank"
          rel="noopener noreferrer">Tawarkan ke gudang</a
        >
      {:else}
        <button class="mt-2 w-full cursor-not-allowed rounded-md bg-ttn-garis px-4 py-3 font-semibold text-ttn-lembut" disabled>
          Tawarkan ke gudang
        </button>
        <p class="mt-1 text-xs text-ttn-lembut">Tautan form belum dikonfigurasi.</p>
      {/if}
      <p class="mt-2 text-xs text-ttn-lembut">Titeny tidak memproses jual-beli; tombol hanya membuka form TitipO/Lumbung.</p>
    </section>
  {/if}
</main>
