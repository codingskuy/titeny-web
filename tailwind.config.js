/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    extend: {
      // TOKEN SEMENTARA: nilai ada di src/app.css (:root --ttn-*); titeny-design belum ada.
      colors: {
        ttn: {
          latar: 'var(--ttn-latar)',
          kartu: 'var(--ttn-kartu)',
          garis: 'var(--ttn-garis)',
          teks: 'var(--ttn-teks)',
          lembut: 'var(--ttn-teks-lembut)',
          primer: 'var(--ttn-primer)',
          'primer-teks': 'var(--ttn-primer-teks)',
          hijau: 'var(--ttn-hijau)',
          'hijau-latar': 'var(--ttn-hijau-latar)',
          kuning: 'var(--ttn-kuning)',
          'kuning-latar': 'var(--ttn-kuning-latar)',
          merah: 'var(--ttn-merah)',
          'merah-latar': 'var(--ttn-merah-latar)'
        }
      }
    }
  },
  plugins: []
};
