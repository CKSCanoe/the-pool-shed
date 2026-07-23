#!/usr/bin/env bash
set -euo pipefail
ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
DIST="$ROOT/dist"
rm -rf "$DIST"
mkdir -p "$DIST"
cp -R "$ROOT/public/." "$DIST/"
SUPABASE_URL_VALUE="${SUPABASE_URL:-}"
SUPABASE_KEY_VALUE="${SUPABASE_PUBLISHABLE_KEY:-${SUPABASE_ANON_KEY:-}}"
python3 - "$DIST/config.js" "$SUPABASE_URL_VALUE" "$SUPABASE_KEY_VALUE" <<'PY'
import json,sys
path,url,key=sys.argv[1:]
with open(path,'w',encoding='utf-8') as f:
    f.write('window.POOL_SHED_CONFIG = '+json.dumps({'supabaseUrl':url,'supabasePublishableKey':key})+';\n')
PY
node "$ROOT/scripts/validate-runtime.mjs" "$DIST"
echo "Built and runtime-validated The Pool Shed into $DIST"
