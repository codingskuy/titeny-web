#!/usr/bin/env bash
# Uji properti Schemathesis terhadap openapi.yaml backend Titeny dan server lokal (TTN-WEB-TEST-SCHEMATHESIS).
#
# Prasyarat: titeny-backend-service berjalan dengan OTP_LOG_DEV=true dan DB yang sudah di-seed
# (contract/seed.py), `uvx`, `curl`, `python3`. Spec TIDAK disalin ke repo ini (sumber kebenaran ada di backend).
# Variabel:
#   SPEC          jalur/URL openapi.yaml (WAJIB), mis. ../titeny-backend-service/docs/api/openapi.yaml
#   BASE_URL      default http://127.0.0.1:8080 (tanpa /api/v1; path spec sudah memuatnya)
#   SERVER_LOG    berkas log server (WAJIB untuk akun CEO/analis; OTP dibaca dari log mode dev)
#   PIN_PETANI    default 482013 (harus ada di tabel zona_pin; lihat seed.py)
#   SANDI         kata sandi akun seed (default sandi-uji-lokal-1)
#   MAX_EXAMPLES  contoh per operasi (default 50)
#   REPORT_DIR    direktori laporan JUnit (default contract/laporan, diabaikan git)
# Telemetri dimatikan (SCHEMATHESIS_TELEMETRY=off). Tidak ada data dikirim keluar; hanya ke BASE_URL.
set -uo pipefail

SPEC="${SPEC:?isi SPEC (jalur/URL openapi.yaml backend)}"
BASE_URL="${BASE_URL:-http://127.0.0.1:8080}"
PIN_PETANI="${PIN_PETANI:-482013}"
SANDI="${SANDI:-sandi-uji-lokal-1}"
MAX_EXAMPLES="${MAX_EXAMPLES:-50}"
REPORT_DIR="${REPORT_DIR:-contract/laporan}"
CONFIG="$(dirname "$0")/schemathesis.toml"
export SCHEMATHESIS_TELEMETRY=off

json_ambil() { python3 -c 'import json,sys; print(json.load(sys.stdin)[sys.argv[1]])' "$1"; }

# Baca OTP terakhir untuk akun dari log server (buang kode warna ANSI).
otp_dari_log() {
  : "${SERVER_LOG:?isi SERVER_LOG untuk akun ber-OTP}"
  sed 's/\x1b\[[0-9;]*m//g' "$SERVER_LOG" | grep "username=$1 " | tail -1 | sed -E 's/.*otp=([0-9]{6}).*/\1/'
}

token_ber_otp() { # username
  local sesi otp
  sesi="$(curl -sf -X POST "$BASE_URL/api/v1/auth/login" -H 'content-type: application/json' \
    -d "{\"username\":\"$1\",\"password\":\"$SANDI\"}" | json_ambil sesi_id)" || return 1
  sleep 0.5
  otp="$(otp_dari_log "$1")"
  curl -sf -X POST "$BASE_URL/api/v1/auth/otp/verifikasi" -H 'content-type: application/json' \
    -d "{\"sesi_id\":\"$sesi\",\"otp\":\"$otp\"}" | json_ambil access_token
}

TOKEN_CEO="$(token_ber_otp ceo-uji)" || { echo "login ceo-uji gagal (seed? OTP_LOG_DEV? SERVER_LOG?)" >&2; exit 2; }
TOKEN_ANALIS="$(token_ber_otp analis-uji)" || { echo "login analis-uji gagal" >&2; exit 2; }
TOKEN_LAYANAN="$(curl -sf -X POST "$BASE_URL/api/v1/auth/login" -H 'content-type: application/json' \
  -d "{\"username\":\"layanan-uji\",\"password\":\"$SANDI\"}" | json_ambil access_token)" \
  || { echo "login layanan-uji gagal" >&2; exit 2; }

mkdir -p "$REPORT_DIR"
status=0

# Grup berkredensial memakai header tetap (-H), jadi pemeriksaan `ignored_auth` (ST401, yang memutasi
# kredensial) menghasilkan positif palsu di sana; kasus tanpa/dengan kredensial salah dicakup grup `publik`
# dan uji Pact 401. Grup `publik` tetap memakai semua pemeriksaan.
jalankan() { # nama, opsi schemathesis...
  local nama="$1"; shift
  local kecuali=()
  [ "$nama" != publik ] && kecuali=(--exclude-checks ignored_auth)
  echo "=== Schemathesis: $nama ==="
  uvx schemathesis --config-file "$CONFIG" run "$SPEC" \
    --url "$BASE_URL" --max-examples "$MAX_EXAMPLES" --workers 1 \
    --checks all "${kecuali[@]}" \
    --report junit --report-junit-path "$REPORT_DIR/$nama.xml" \
    "$@" || status=1
}

# Tanpa kredensial: kesehatan dan jalur masuk (auth/login, otp, refresh).
jalankan publik --include-tag Kesehatan --include-tag Auth
# Petani/vendor: PIN zona.
jalankan pin-zona --include-tag Prediksi --include-tag Rekomendasi --include-tag Umpan-balik -H "X-Zona-PIN: $PIN_PETANI"
# CEO: JWT akses.
jalankan ceo --include-tag Prediksi --include-tag Rekomendasi -H "Authorization: Bearer $TOKEN_CEO"
# Analis: antrean, validasi, tahan.
jalankan analis --include-tag Analis -H "Authorization: Bearer $TOKEN_ANALIS"
# Sumber event (token layanan, least-privilege).
jalankan layanan --include-tag Event -H "Authorization: Bearer $TOKEN_LAYANAN"

exit "$status"
