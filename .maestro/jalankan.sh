#!/usr/bin/env bash
# Menjalankan alur Maestro web: mock API + Vite dev, lalu `maestro test`.
# Prasyarat: bun, Maestro CLI >= 2 (mode web masih beta), Google Chrome. Pemakaian: .maestro/jalankan.sh [alur.yaml ...]
set -euo pipefail
cd "$(dirname "$0")/.."
export MAESTRO_CLI_NO_ANALYTICS=1 MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED=true E2E_TELEMETRY_DISABLED=1
export MOCK_PORT="${MOCK_PORT:-18921}" VITE_PORT="${VITE_PORT:-18922}"
command -v maestro >/dev/null || { echo "maestro tidak terpasang (https://maestro.dev); lihat docs/testing/maestro.md" >&2; exit 127; }

pids=()
trap 'kill "${pids[@]}" 2>/dev/null || true' EXIT
bun .maestro/harness/mock-api.ts & pids+=($!)
TITENY_API_URL="http://127.0.0.1:${MOCK_PORT}" bun run dev -- --port "$VITE_PORT" --host 127.0.0.1 --strictPort & pids+=($!)
for _ in $(seq 1 60); do curl -fs "http://127.0.0.1:${VITE_PORT}/" >/dev/null 2>&1 && break; sleep 1; done

alur=("$@"); [[ ${#alur[@]} -gt 0 ]] || alur=(.maestro/smoke.yaml .maestro/papan-petani.yaml .maestro/pin-salah.yaml)
maestro test -e "WEB_URL=http://127.0.0.1:${VITE_PORT}" "${alur[@]}"
