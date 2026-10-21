<script lang="ts">
  import { onMount } from 'svelte';
  import { analitik } from '$lib/analitik';
  import { api } from '$lib/api';
  import { stempelWib } from '$lib/format';
  import { KOMODITAS_HARGA } from '$lib/komoditas';
  import { aturKonteks } from '$lib/konteks.svelte';
  import type { Rekomendasi } from '$lib/kontrak';
  import { pesanGalat } from '$lib/masuk';
  import {
    CATATAN_MAKS,
    KABUPATEN,
    gantiRekomendasi,
    jalankanTerbatas,
    kunciSel,
    muatMatriks,
    muatRekomendasi,
    muatSel,
    transisiBerikut,
    validasiCatatan,
    type SelMatriks
  } from '$lib/papan/ceo';
  import { peringatanDariSinyal } from '$lib/papan/vendor';
  import { terlihat } from '$lib/terlihat';

  /** Revalidasi CEO tiap 15 menit (TECHSTACK); polling, bukan push. */
  const POLL_MS = 15 * 60 * 1000;

  let tab = $state<'ringkasan' | 'akurasi'>('ringkasan');
  let matriks = $state<Record<string, SelMatriks>>({});
  let memuatMatriks = $state(true);
  let rekomendasi = $state<Rekomendasi[] | null>(null);
  let galatRek = $state<string | null>(null);
  let diambilRek = $state<string | null>(null);
  let basiRek = $state(false);
  let sudahDibuka = false;

  let formId = $state<string | null>(null);
  let catatan = $state('');
  let galatForm = $state<string | null>(null);
  let mengirim = $state(false);

  async function muatSemua() {
    memuatMatriks = true;
    const [m, r] = await Promise.all([muatMatriks(api), muatRekomendasi(api)]);
    matriks = Object.fromEntries(m);
    memuatMatriks = false;
    if (r.status === 'ok') {
      rekomendasi = r.data.data;
      diambilRek = r.diambilPada;
      basiRek = r.basi;
      galatRek = null;
    } else {
      galatRek = r.status === 'galat' ? r.pesan : 'Belum ada rekomendasi.';
    }
    const ok = Object.values(matriks).find((s) => s.sel.status === 'ok');
    const mv = ok && ok.sel.status === 'ok' ? ok.sel.data.model_version : undefined;
    aturKonteks({ model_version: mv });
    if (!sudahDibuka) {
      sudahDibuka = true;
      analitik.resetHalaman();
      analitik.catat({ nama: 'papan.dibuka', model_version: mv });
    }
  }

  async function muatUlangGagal() {
    const gagal = Object.values(matriks).filter((s) => s.sel.status === 'galat');
    memuatMatriks = true;
    const baru = await jalankanTerbatas(gagal.map((s) => () => muatSel(api, s.komoditas_id, s.kabupaten_id)));
    matriks = { ...matriks, ...Object.fromEntries(baru.map((b) => [kunciSel(b.komoditas_id, b.kabupaten_id), b])) };
    memuatMatriks = false;
  }

  $effect(() => {
    void muatSemua();
  });
  $effect(() => {
    const t = setInterval(() => void muatSemua(), POLL_MS);
    return () => clearInterval(t);
  });
  onMount(() => () => aturKonteks({}));

  const jumlahGagal = $derived(Object.values(matriks).filter((s) => s.sel.status === 'galat').length);

  function bukaForm(id: string) {
    formId = id;
    catatan = '';
    galatForm = null;
  }

  async function kirimStatus(r: Rekomendasi) {
    const tujuan = transisiBerikut(r.status);
    const v = validasiCatatan(catatan);
    if (!tujuan) return;
    if (!v.ok) {
      galatForm = v.pesan;
      return;
    }
    mengirim = true;
    galatForm = null;
    try {
      const hasil = await api.ubahStatusRekomendasi(r.id, { status: tujuan, catatan: v.nilai });
      rekomendasi = gantiRekomendasi(rekomendasi ?? [], hasil.data);
      formId = null;
    } catch (e) {
      galatForm = pesanGalat(e);
      if (e instanceof Error && 'status' in e && (e as { status: number }).status === 409) void muatSemua();
    } finally {
      mengirim = false;
    }
  }

  const kelas = {
    hijau: 'bg-ttn-hijau-latar text-ttn-hijau',
    kuning: 'bg-ttn-kuning-latar text-ttn-kuning',
    merah: 'bg-ttn-merah-latar text-ttn-merah'
  } as const;
  const ikon = { hijau: '●', kuning: '▲', merah: '■' } as const;
  const labelStatus = { baru: 'Baru', dikerjakan: 'Dikerjakan', selesai: 'Selesai' } as const;
  const tabKelas = (aktif: boolean) =>
    `flex-1 border-b-2 px-3 py-2 font-semibold ${aktif ? 'border-ttn-primer text-ttn-primer' : 'border-transparent text-ttn-lembut'}`;
</script>

<svelte:head><title>Papan CEO — Titeny</title></svelte:head>

<main class="py-4">
  <h1 class="text-2xl font-bold">Papan CEO / Operasional</h1>

  <div class="mt-3 flex border-b border-ttn-garis" role="tablist" aria-label="Bagian papan">
    <button role="tab" id="tab-ringkasan" aria-selected={tab === 'ringkasan'} aria-controls="panel-ringkasan" class={tabKelas(tab === 'ringkasan')} onclick={() => (tab = 'ringkasan')}>Ringkasan</button>
    <button role="tab" id="tab-akurasi" aria-selected={tab === 'akurasi'} aria-controls="panel-akurasi" class={tabKelas(tab === 'akurasi')} onclick={() => (tab = 'akurasi')}>Akurasi</button>
  </div>

  {#if tab === 'ringkasan'}
    <div role="tabpanel" id="panel-ringkasan" aria-labelledby="tab-ringkasan">
      <!-- Matriks -->
      <section class="mt-4 rounded-lg border border-ttn-garis bg-ttn-kartu p-3" aria-labelledby="h-matriks" use:terlihat={{ kartu: 'matriks' }}>
        <h2 id="h-matriks" class="font-semibold">Surplus / defisit: 5 kabupaten × 12 komoditas</h2>
        {#if memuatMatriks && Object.keys(matriks).length === 0}
          <p class="mt-2 text-ttn-lembut" role="status">Memuat matriks…</p>
        {:else}
          <table class="mt-2 w-full table-fixed text-center text-[10px]">
            <caption class="sr-only">Sinyal demand tiap komoditas (baris) per kabupaten (kolom)</caption>
            <thead>
              <tr class="border-b border-ttn-garis">
                <th scope="col" class="w-[22%] py-1 text-left">Komoditas</th>
                {#each KABUPATEN as kab}
                  <th scope="col" class="py-1 text-[9px]">{kab.nama}</th>
                {/each}
              </tr>
            </thead>
            <tbody>
              {#each KOMODITAS_HARGA as k}
                <tr class="border-b border-ttn-garis/60">
                  <th scope="row" class="py-1 pr-1 text-left font-medium break-words">{k.nama}</th>
                  {#each KABUPATEN as kab}
                    {@const s = matriks[kunciSel(k.id, kab.id)]?.sel}
                    <td class="p-0.5">
                      {#if s?.status === 'ok'}
                        {@const p = peringatanDariSinyal(s.data.sinyal)}
                        <span class="block rounded py-1 font-bold {kelas[p.kunci]}" title={`${k.nama} ${kab.nama}: ${p.teks}`}>
                          <span aria-hidden="true">{ikon[p.kunci]}</span><span class="sr-only">{p.teks}</span>
                        </span>
                      {:else if s?.status === 'galat'}
                        <span class="block rounded bg-ttn-merah-latar py-1 text-ttn-merah" title={s.pesan}>!<span class="sr-only">Gagal: {s.pesan}</span></span>
                      {:else}
                        <span class="block py-1 text-ttn-lembut" title={s?.pesan ?? ''}>–<span class="sr-only">{s?.pesan ?? 'Tidak ada data'}</span></span>
                      {/if}
                    </td>
                  {/each}
                </tr>
              {/each}
            </tbody>
          </table>
          <p class="mt-2 text-xs text-ttn-lembut">
            <span class="rounded px-1 {kelas.hijau}">● Seimbang</span>
            <span class="rounded px-1 {kelas.kuning}">▲ Surplus</span>
            <span class="rounded px-1 {kelas.merah}">■ Defisit</span>
            – tidak ada data, ! gagal dimuat.
          </p>
          {#if jumlahGagal > 0}
            <p class="mt-2 text-sm text-ttn-merah" role="alert">{jumlahGagal} sel gagal dimuat (mis. kuota 60 permintaan/menit).</p>
            <button class="mt-1 rounded-md border border-ttn-garis px-3 py-1" onclick={() => void muatUlangGagal()} disabled={memuatMatriks}>Muat ulang sel gagal</button>
          {/if}
        {/if}
      </section>

      <!-- Kurva omzet vs margin -->
      <section class="mt-4 rounded-lg border border-ttn-garis bg-ttn-kartu p-3" aria-labelledby="h-kurva" use:terlihat={{ kartu: 'kurva_omzet_margin' }}>
        <h2 id="h-kurva" class="font-semibold">Omzet vs margin, 30 hari</h2>
        <p class="mt-2 rounded-md bg-ttn-kuning-latar px-3 py-2 text-sm text-ttn-kuning" role="status">
          Data keuangan harian (S10) dan anotasi intervensi belum tersedia di API. Kurva menunggu endpoint pada kontrak.
        </p>
      </section>

      <!-- Rekomendasi -->
      <section class="mt-4 rounded-lg border border-ttn-garis bg-ttn-kartu p-3" aria-labelledby="h-rek" use:terlihat={{ kartu: 'rekomendasi' }}>
        <h2 id="h-rek" class="font-semibold">5 rekomendasi prioritas</h2>
        {#if basiRek && diambilRek}
          <p role="status" class="mt-2 rounded-md bg-ttn-kuning-latar px-3 py-2 text-sm text-ttn-kuning">Menampilkan data tersimpan per {stempelWib(diambilRek)}.</p>
        {/if}
        {#if galatRek}
          <p class="mt-2 text-ttn-lembut" role="status">{galatRek}</p>
        {:else if rekomendasi === null}
          <p class="mt-2 text-ttn-lembut" role="status">Memuat…</p>
        {:else if rekomendasi.length === 0}
          <p class="mt-2 text-ttn-lembut">Belum ada rekomendasi.</p>
        {:else}
          <ol class="mt-2 space-y-3">
            {#each rekomendasi.slice(0, 5) as r (r.id)}
              {@const tujuan = transisiBerikut(r.status)}
              <li class="rounded-md border border-ttn-garis p-3">
                <div class="flex items-start justify-between gap-2">
                  <p class="text-xs text-ttn-lembut">Zona {r.zona}</p>
                  <span class="rounded-full border border-ttn-garis px-2 py-0.5 text-xs font-semibold">{labelStatus[r.status]}</span>
                </div>
                <ul class="mt-1 list-disc pl-5 text-sm">
                  {#each r.teks as t}<li>{t}</li>{/each}
                </ul>
                {#if r.catatan}<p class="mt-1 text-xs text-ttn-lembut">Catatan: {r.catatan}</p>{/if}
                {#if tujuan}
                  {#if formId === r.id}
                    <form class="mt-2" onsubmit={(e) => { e.preventDefault(); void kirimStatus(r); }}>
                      <label class="block text-sm" for={`cat-${r.id}`}>Catatan untuk “{labelStatus[tujuan]}” (wajib)</label>
                      <textarea id={`cat-${r.id}`} class="mt-1 w-full rounded-md border border-ttn-garis px-2 py-1 text-sm" rows="2" maxlength={CATATAN_MAKS} bind:value={catatan}></textarea>
                      <p class="text-right text-xs text-ttn-lembut">{CATATAN_MAKS - [...catatan].length} karakter tersisa</p>
                      {#if galatForm}<p class="text-sm text-ttn-merah" role="alert">{galatForm}</p>{/if}
                      <div class="mt-1 flex gap-2">
                        <button class="flex-1 rounded-md bg-ttn-primer px-3 py-2 font-semibold text-ttn-primer-teks disabled:opacity-60" disabled={mengirim}>{mengirim ? 'Menyimpan…' : 'Simpan'}</button>
                        <button type="button" class="rounded-md border border-ttn-garis px-3 py-2" onclick={() => (formId = null)}>Batal</button>
                      </div>
                    </form>
                  {:else}
                    <button class="mt-2 rounded-md border border-ttn-primer px-3 py-1 text-sm font-semibold text-ttn-primer" onclick={() => bukaForm(r.id)}>Tandai {labelStatus[tujuan].toLowerCase()}</button>
                  {/if}
                {/if}
              </li>
            {/each}
          </ol>
        {/if}
      </section>
    </div>
  {:else}
    <div role="tabpanel" id="panel-akurasi" aria-labelledby="tab-akurasi">
      <section class="mt-4 rounded-lg border border-ttn-garis bg-ttn-kartu p-3" aria-labelledby="h-akurasi" use:terlihat={{ kartu: 'akurasi' }}>
        <h2 id="h-akurasi" class="font-semibold">Jejak akurasi: MAPE H+7 per komoditas, 4 minggu terakhir</h2>
        <p class="mt-2 rounded-md bg-ttn-kuning-latar px-3 py-2 text-sm text-ttn-kuning" role="status">
          Data MAPE belum tersedia di API (belum ada endpoint akurasi pada kontrak), sehingga jejak tidak dapat ditampilkan.
        </p>
        <button class="mt-3 w-full cursor-not-allowed rounded-md bg-ttn-garis px-4 py-2 font-semibold text-ttn-lembut" disabled>Ekspor CSV (maks 500 baris)</button>
        <p class="mt-1 text-xs text-ttn-lembut">Ekspor di web dibatasi 500 baris; ekspor massal hanya di desktop analis.</p>
      </section>
    </div>
  {/if}
</main>
