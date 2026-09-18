#!/usr/bin/env bash
set -euo pipefail
ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
DIST="$ROOT/dist"

node "$ROOT/scripts/test-quote-builder-v132.mjs"
node "$ROOT/scripts/test-quotes-project-purchasing-v131.mjs"
node "$ROOT/scripts/test-quote-studio-v131.mjs"
node "$ROOT/scripts/test-quote-portal-v131.mjs"
node "$ROOT/scripts/test-quote-workflows-v131.mjs"
node "$ROOT/scripts/test-deployment-lock-v1271.mjs"
node "$ROOT/scripts/test-azzy-contrast-v1272.mjs"
node "$ROOT/scripts/test-azzy-panel-v1273.mjs"
node "$ROOT/scripts/test-release-v1273.mjs"
node "$ROOT/scripts/test-responsive-release-v128.mjs"

node "$ROOT/scripts/build-css.mjs"
test -f "$ROOT/public/production-readiness-engine.js"

rm -rf "$DIST"
mkdir -p "$DIST"
cp -R "$ROOT/public/." "$DIST/"

SUPABASE_URL_VALUE="${SUPABASE_URL:-}"
SUPABASE_KEY_VALUE="${SUPABASE_PUBLISHABLE_KEY:-${SUPABASE_ANON_KEY:-}}"

python3 - "$DIST/config.js" "$SUPABASE_URL_VALUE" "$SUPABASE_KEY_VALUE" "${SECURE_WORKSPACE_WRITES:-false}" <<'PY'
import json,sys
path,url,key,secure=sys.argv[1:]
with open(path,'w',encoding='utf-8') as f:
    f.write('window.POOL_SHED_CONFIG = '+json.dumps({'supabaseUrl':url,'supabasePublishableKey':key,'secureWorkspaceWrites':secure.lower()=='true'})+';\n')
PY

node "$ROOT/scripts/validate-runtime.mjs" "$DIST"
echo "Built deployable static application into $DIST"
