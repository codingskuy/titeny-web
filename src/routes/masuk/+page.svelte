<script lang="ts">
  import { goto } from '$app/navigation';
  import { api } from '$lib/api';
  import { PERAN_VALID, namaPeran } from '$lib/akses';
  import { masukDenganPin, mulaiMasukCeo, selesaikanMasukCeo } from '$lib/masuk';
  import { sesi } from '$lib/sesi';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  let pin = $state('');
  let username = $state('');
  let password = $state('');
  let otp = $state('');
  let sesiId: string | null = $state(null);
  let galat: string | null = $state(null);
  let sibuk = $state(false);

  async function kirimPin(e: SubmitEvent) {
    e.preventDefault();
    if (data.peran !== 'petani' && data.peran !== 'vendor') return;
    sibuk = true;
    galat = null;
    const r = await masukDenganPin(api, sesi, data.peran, pin.trim());
    sibuk = false;
    if (r.ok) await goto(`/insight/${data.peran}`);
    else galat = r.pesan;
  }

  async function kirimAkun(e: SubmitEvent) {
    e.preventDefault();
    sibuk = true;
    galat = null;
    const r = await mulaiMasukCeo(api, username, password);
    sibuk = false;
    if (r.ok) {
      sesiId = r.sesiId;
      password = '';
    } else galat = r.pesan;
  }

  async function kirimOtp(e: SubmitEvent) {
    e.preventDefault();
    if (!sesiId) return;
    sibuk = true;
    galat = null;
    const r = await selesaikanMasukCeo(api, sesi, sesiId, otp.trim());
    sibuk = false;
    if (r.ok) await goto('/insight/ceo');
    else galat = r.pesan;
  }

  const kelasInput = 'mt-1 w-full rounded-md border border-ttn-garis bg-ttn-kartu px-3 py-2 text-base';
  const kelasTombol =
    'mt-4 w-full rounded-md bg-ttn-primer px-4 py-3 font-semibold text-ttn-primer-teks disabled:opacity-60';
</script>

<svelte:head><title>Masuk — Titeny</title></svelte:head>

<main class="mx-auto max-w-md px-4 py-8">
  <a href="/" class="text-sm text-ttn-lembut underline">&larr; Pilih peran</a>

  {#if data.peran === null}
    <h1 class="mt-3 text-2xl font-bold">Masuk</h1>
    <p class="mt-1 text-ttn-lembut">Pilih peran terlebih dahulu.</p>
    <ul class="mt-4 space-y-2">
      {#each PERAN_VALID as p}
        <li><a class="underline" href={`/masuk?peran=${p}`}>{namaPeran[p]}</a></li>
      {/each}
    </ul>
  {:else if data.peran === 'ceo'}
    <h1 class="mt-3 text-2xl font-bold">Masuk sebagai CEO</h1>
    {#if sesiId === null}
      <form onsubmit={kirimAkun} class="mt-4">
        <label class="block" for="akun">Nama akun</label>
        <input id="akun" class={kelasInput} autocomplete="username" bind:value={username} required />
        <label class="mt-3 block" for="sandi">Kata sandi</label>
        <input id="sandi" type="password" class={kelasInput} autocomplete="current-password" bind:value={password} required />
        <button class={kelasTombol} disabled={sibuk}>{sibuk ? 'Memeriksa…' : 'Lanjut'}</button>
      </form>
    {:else}
      <form onsubmit={kirimOtp} class="mt-4">
        <p class="text-ttn-lembut">Kode OTP 6 digit sudah dikirim. Masukkan di bawah.</p>
        <label class="mt-3 block" for="otp">Kode OTP</label>
        <input
          id="otp"
          class={kelasInput}
          inputmode="numeric"
          autocomplete="one-time-code"
          maxlength="6"
          pattern="[0-9]{'{6}'}"
          bind:value={otp}
          required
        />
        <button class={kelasTombol} disabled={sibuk}>{sibuk ? 'Memeriksa…' : 'Masuk'}</button>
      </form>
    {/if}
  {:else}
    <h1 class="mt-3 text-2xl font-bold">Masuk sebagai {namaPeran[data.peran]}</h1>
    <form onsubmit={kirimPin} class="mt-4">
      <label class="block" for="pin">PIN zona (6 digit)</label>
      <input
        id="pin"
        class={kelasInput}
        inputmode="numeric"
        autocomplete="off"
        maxlength="6"
        pattern="[0-9]{'{6}'}"
        bind:value={pin}
        required
        aria-describedby="bantuan-pin"
      />
      <p id="bantuan-pin" class="mt-1 text-sm text-ttn-lembut">PIN dibagikan oleh pengelola zona Anda.</p>
      <button id="tombol-masuk" class={kelasTombol} disabled={sibuk}>{sibuk ? 'Memeriksa…' : 'Masuk'}</button>
    </form>
  {/if}

  {#if galat}
    <p id="masuk-galat" role="alert" class="mt-4 rounded-md bg-ttn-merah-latar px-3 py-2 text-ttn-merah">{galat}</p>
  {/if}
</main>
