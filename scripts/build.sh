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

run_node_stage "payment operations" test-payment-operations-v147.mjs

run_node_stage "workspace and sales safety" \
  test-egress-sync-v148.mjs \
  test-migration-014.mjs \
  test-migration-015.mjs \
  test-migration-016.mjs \
  test-delta-refresh-v149.mjs \
  test-record-saves-v149.mjs \
  test-migration-017.mjs \
  test-migration-018.mjs \
  test-migration-019.mjs \
  test-role-view-v150.mjs \
  test-migration-021.mjs \
  test-migration-022.mjs \
  test-migration-023.mjs \
  test-migration-024.mjs \
  test-finance-media-v151.mjs \
  test-migration-025.mjs \
  test-xero-ledger-push-v151.mjs \
  test-xero-handoff-ui-v151.mjs \
  test-migration-026.mjs \
  test-fleet-media-v152.mjs \
  test-fleet-ui-v152.mjs \
  test-migration-028.mjs \
  test-fleet-reminders-v153.mjs \
  test-migration-029.mjs \
  test-sales-invoicing-v154.mjs \
  test-frame-v155.mjs \
  test-orders-v156.mjs \
  test-customer-emails-v157.mjs \
  test-van-stock-v158.mjs \
  test-workspace-load-v158.mjs \
  test-customer-accounts-v159.mjs \
  test-core-stock-v160.mjs \
  test-profit-v161.mjs \
  test-locked-reads-v162.mjs \
  test-contracts-v163.mjs \
  test-monthly-pack-v164.mjs \
  test-web-shop-v165.mjs \
  test-navigation-v166.mjs \
  test-catalogue-paging-v167.mjs \
  test-speed-v168.mjs \
  test-look-pilot-v169.mjs \
  test-look-sales-v170.mjs \
  test-custom-items-v171.mjs \
  test-quote-editor-v172.mjs \
  test-quote-specs-v173.mjs \
  test-quote-customer-v174.mjs \
  test-quote-html-v175.mjs \
  test-look-all-v176.mjs \
  test-css-hygiene-v177.mjs \
  test-jump-to-v178.mjs \
  test-saved-views-v179.mjs \
  test-workspace-audit-v1451.mjs \
  test-commercial-audits-v146.mjs \
  test-audit-device-recovery.mjs \
  test-quiet-shared-autosave-v1462.mjs \
  test-workspace-sync.mjs \
  test-fast-cold-start-v145.mjs \
  test-large-workspace-persistence-v1452.mjs \
  test-sales-order-safety-hotfix.mjs \
  test-sales-order-xero-copy-v145.mjs \
  test-sales-order-catalogue-chemical-v157.mjs \
  test-sales-order-quantity-layout-v158.mjs \
  test-sales-order-custom-price-apply-v159.mjs \
  test-sales-order-customer-discount-v160.mjs \
  test-product-import-shared-persistence-v161.mjs \
  test-shared-one-truth-v162.mjs \
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
