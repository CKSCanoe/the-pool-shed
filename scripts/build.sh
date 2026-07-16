#!/usr/bin/env bash
set -euo pipefail
project_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
dist_root="$project_root/dist"
rm -rf "$dist_root"
mkdir -p "$dist_root/.openai" "$dist_root/server"
cp -R "$project_root/public/." "$dist_root/"
SUPABASE_URL_VALUE="${SUPABASE_URL:-}"
SUPABASE_KEY_VALUE="${SUPABASE_PUBLISHABLE_KEY:-${SUPABASE_ANON_KEY:-}}"
python3 - "$dist_root/config.js" "$SUPABASE_URL_VALUE" "$SUPABASE_KEY_VALUE" <<'PY'
import json,sys
path,url,key=sys.argv[1:]
open(path,'w').write('window.POOL_SHED_CONFIG = '+json.dumps({'supabaseUrl':url,'supabasePublishableKey':key})+';\n')
PY
if [ -f "$project_root/.openai/hosting.json" ]; then cp "$project_root/.openai/hosting.json" "$dist_root/.openai/hosting.json"; fi
python3 - "$dist_root/index.html" "$dist_root/service-worker.js" "$dist_root/server/index.js" <<'PY'
import json,sys
html_path,sw_path,out_path=sys.argv[1:]
html=open(html_path,encoding='utf-8').read()
sw=open(sw_path,encoding='utf-8').read()
source='const html = '+json.dumps(html)+';\nconst serviceWorker = '+json.dumps(sw)+';\nexport default { async fetch(request) { const url = new URL(request.url); if (url.pathname === "/service-worker.js") return new Response(serviceWorker, { headers: { "content-type": "application/javascript; charset=utf-8", "cache-control": "no-cache" } }); return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-cache" } }); } };\n'
open(out_path,'w',encoding='utf-8').write(source)
PY
echo "Built The Pool Shed Live V1.5 into $dist_root"
