#!/usr/bin/env bash
set -euo pipefail
ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
DIST="$ROOT/dist"
VERCEL_OUT="$ROOT/.vercel/output"
STATIC_OUT="$VERCEL_OUT/static"

rm -rf "$DIST" "$VERCEL_OUT"
mkdir -p "$DIST" "$STATIC_OUT"
cp -R "$ROOT/public/." "$DIST/"
cp -R "$ROOT/public/." "$STATIC_OUT/"

SUPABASE_URL_VALUE="${SUPABASE_URL:-}"
SUPABASE_KEY_VALUE="${SUPABASE_PUBLISHABLE_KEY:-${SUPABASE_ANON_KEY:-}}"

write_config() {
  local target="$1"
  python3 - "$target" "$SUPABASE_URL_VALUE" "$SUPABASE_KEY_VALUE" <<'PY'
import json,sys
path,url,key=sys.argv[1:]
with open(path,'w',encoding='utf-8') as f:
    f.write('window.POOL_SHED_CONFIG = '+json.dumps({'supabaseUrl':url,'supabasePublishableKey':key})+';\n')
PY
}

write_config "$DIST/config.js"
write_config "$STATIC_OUT/config.js"

cat > "$VERCEL_OUT/config.json" <<'JSON'
{
  "version": 3,
  "cleanUrls": true,
  "trailingSlash": false,
  "routes": [
    { "handle": "filesystem" },
    { "src": "/.*", "dest": "/index.html" }
  ]
}
JSON

node "$ROOT/scripts/validate-runtime.mjs" "$DIST"
node "$ROOT/scripts/validate-runtime.mjs" "$STATIC_OUT"

echo "Built standard output into $DIST"
echo "Built Vercel Build Output API into $STATIC_OUT"
