#!/bin/zsh
set -euo pipefail
cd "$(dirname "$0")"
if [[ -f .env ]]; then
  set -a
  source .env
  set +a
fi
if [[ -z "${AZZY_GATEWAY_TOKEN:-}" ]]; then
  echo "Missing AZZY_GATEWAY_TOKEN. Copy .env.example to .env and set a strong token first."
  exit 1
fi
exec node server.mjs
