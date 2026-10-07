#!/usr/bin/env bash
set -euo pipefail
ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
DIST="$ROOT/dist"

run_node_stage() {
  local stage="$1"
  shift
  printf '\n=== Pool Shed build: %s ===\n' "$stage"
  local test
  for test in "$@"; do
    printf '→ %s\n' "$test"
    if ! node "$ROOT/scripts/$test"; then
      printf '\n✖ BUILD GATE FAILED [%s]: %s\n' "$stage" "$test" >&2
      exit 1
    fi
  done
  printf '✓ %s passed\n' "$stage"
}

run_node_stage "workspace and sales safety" \
  test-workspace-audit-v1451.mjs \
  test-large-workspace-persistence-v1452.mjs \
  test-sales-order-safety-hotfix.mjs \
  test-sales-order-catalogue-chemical-v157.mjs \
  test-sales-order-line-delete-v147.mjs \
  test-sales-order-entry-cards-v147.mjs \
  test-sales-order-unification-v149.mjs \
  test-runtime-dead-code-v151.mjs \
  test-sales-order-vat-regression-v146.mjs \
  test-sales-order-subscriptions-v146.mjs

run_node_stage "purchasing" \
  test-supplier-command-workspace-v115.mjs \
  test-supplier-option-b-v151.mjs \
  test-supplier-onboarding-v148.mjs \
  test-supplier-funding-v149.mjs \
  test-purchase-custom-lines-v150.mjs \
  test-custom-po-catalogue-isolation-v153.mjs \
  test-purchase-order-filters-v152.mjs \
  test-purchase-order-command-v190.mjs \
  test-purchase-order-visual-guard-v190.mjs \
  test-purchase-returns-v190.mjs \
  test-purchase-order-parity-v200.mjs

run_node_stage "projects" \
  test-project-extra-quotes-v146.mjs \
  test-project-performance-v146.mjs \
  test-project-extra-sql-v146.mjs \
  test-project-hire-v145.mjs \
  test-project-labour-v146.mjs \
  test-project-live-commercial-v147.mjs \
  test-project-reporting-v153.mjs \
  test-project-settings-clean-v148.mjs \
  test-project-control-v144.mjs \
  test-project-email-v144.mjs \
  test-project-workspace-v143.mjs \
  test-project-profit-v142.mjs \
  test-project-engine.mjs \
  test-project-360-engine-v110.mjs

run_node_stage "quotes" \
  test-quote-editor-flow-v1412.mjs \
  test-quote-layers-v1411.mjs \
  test-quote-layout-v141.mjs \
  test-quote-layout-workspace-v141.mjs \
  test-quote-signatures-v140.mjs \
  test-quote-signing-flow-v140.mjs \
  test-quote-signing-api-v140.mjs \
  test-quote-refined-v139.mjs \
  test-quote-command-v138.mjs \
  test-quote-design-parity-v137.mjs \
  test-supabase-fresh-v134.mjs \
  test-business-media-v134.mjs \
  test-quote-process-authority-v133.mjs \
  test-quote-builder-v132.mjs \
  test-quotes-project-purchasing-v131.mjs \
  test-quote-studio-v131.mjs \
  test-quote-portal-v131.mjs \
  test-quote-workflows-v131.mjs

run_node_stage "authentication and backend compatibility" \
  test-login-command-v122.mjs \
  test-login-release-v122.mjs \
  test-origin-policy-v146.mjs \
  test-supabase-key-compat-v146.mjs \
  test-server-auth-hardening-v146.mjs \
  test-workspace-recovery-v155.mjs \
  test-safe-shared-workspace-v156.mjs

run_node_stage "Azzy" \
  test-deployment-lock-v1271.mjs \
  test-azzy-origin-policy.mjs \
  test-azzy-workspace-access-v151.mjs \
  test-azzy-resilience-v151.mjs \
  test-azzy-jarvis-final.mjs \
  test-azzy-poolshed-ready-final.mjs \
  test-azzy-brain-gateway.mjs \
  test-azzy-durable-memory.mjs

run_node_stage "responsive and accessibility" \
  test-responsive-release-v128.mjs \
  test-accessibility-shell-v1451.mjs \
  test-shell-polish-v146.mjs

printf '\n=== Pool Shed build: CSS ===\n'
node "$ROOT/scripts/build-css.mjs"
test -f "$ROOT/public/production-readiness-engine.js"

printf '\n=== Pool Shed build: assemble dist ===\n'
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

printf '\n=== Pool Shed build: runtime validation ===\n'
if ! node "$ROOT/scripts/validate-runtime.mjs" "$DIST"; then
  printf '\n✖ BUILD GATE FAILED [runtime validation]: validate-runtime.mjs\n' >&2
  exit 1
fi
printf '\n✓ Built and validated deployable application into %s\n' "$DIST"

# Deployment retrigger 2026-09-30 for Supplier Option B production release