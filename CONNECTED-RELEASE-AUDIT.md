> Historical accounting-build audit. The project release adds protected phase billing and other features; see PROJECT-RELEASE-AUDIT.md for the current scope.

# Connected accounting release audit

Base: the completed Pool Shed Performance Update. Original download and earlier release folders were not edited. This ZIP contains the whole application, server source, database migrations, build output, tests and setup instructions.

## Included

- Accounting & Xero dashboard, reviewed full-order sales-invoice drafts, existing Xero contact/account/tax selection, linked balances and visible sync exceptions.
- OAuth connection with single-use expiring state, secure cookie, explicit organisation choice, encrypted server-only tokens and refresh locking.
- Durable document/export queue, unique local source mapping, provider idempotency key, safe retry of known-safe failures and explicit reconciliation of ambiguous submissions.
- Signed, deduplicated webhook inbox; scheduled authoritative invoice reads; payment/credit/balance updates and payment reversals. Remote financial data does not mutate warehouse stock or dispatch status.
- Database-controlled finance membership. Optional server-enforced workspace saves reject stale snapshots, over-reserved/negative stock and changes to receipt/putaway history, and retain previous revisions.
- Encrypted export and integrity-verification tool. API responses bypass the offline cache.

## Changed files

| Files | Change |
| --- | --- |
| `api/finance.js` | Authenticated finance API, OAuth, webhook, worker, mapping/reconciliation |
| `server/accounting.js` | Encryption, signatures, Xero/DB requests, validation and inbound updates |
| `database/001-accounting.sql` | Finance tables, permissions, atomic queue/lease/webhook functions |
| `database/002-workspace-hardening.sql` | Optional secure snapshot saving, membership and revision history |
| `public/accounting-workspace.js` | Accounting screen and invoice-workflow link |
| `public/index.html`, `public/professional-workspace.css` | Load new screen and align form spacing |
| `public/service-worker.js` | Cache version; exclude API/authenticated requests |
| `public/assets/js/01-legacy-01.js` | Optional secure RPC save with no legacy fallback |
| `scripts/build.sh`, `vercel.json`, schedule example | Public feature flag; preserve API routing; server duration; optional scheduler |
| `scripts/test-accounting*.mjs`, `scripts/test-workspace-database.mjs` | Crypto/API/SQL regression checks |
| `scripts/test-workspace-sync.mjs`, `scripts/test-browser-smoke.cjs` | Secure-save and accounting browser regression coverage |
| `scripts/accounting-backup.mjs` | Encrypted export and verification |
| `package.json`, `pnpm-lock.yaml` | PostgreSQL test runtime and test commands |
| `README.md`, setup/audit/results documents | Deployment and limitations |
| `dist/` | Rebuilt browser application; server files remain outside the public build |

`CHANGED-FILES.json` lists the exact new/modified files relative to the performance release, excluding installed dependencies. Test screenshots are generated from isolated fixtures.

## Verification

All 19 commands in the validation chain passed: existing purchasing/receiving/putaway/stock/fulfilment/catalogue/tool/performance checks, plus accounting unit/API tests and both PostgreSQL migrations in PGlite. The API tests use a simulated provider, including OAuth replay rejection, payment return and uncertain-create handling. They are not a live Xero certification.

The browser smoke test visits 73 section views and exercises receiving, transfers, quarantine, shipping and tool returns. Additional mocked accounting checks select an order and explicit financial mappings, submit a draft and confirm unchanged stock. Local browser tests do not establish production load times or real multi-user throughput.

## Remaining caveats and work

1. No production deployment, database migration, Xero authorisation or scheduler has been activated. Setup is required before bidirectional syncing operates. Credentials are not included.
2. This is a Xero integration and accounting workspace, not a complete new statutory accounting package. Bank feeds/reconciliation, journals, VAT returns, payroll and financial statements remain in Xero. There is no new local general ledger.
3. The UI exports one full sales-order draft with a shared tax treatment. Partial invoicing, mixed-tax lines, new contact creation, credit-note creation, attachments, supplier-bill UI and automatic editing of existing Xero invoices remain outstanding. The API validates ACCPAY payloads, but supplier-bill workflows are not presented as a completed feature.
4. Only linked invoices return. The bounded worker processes one export and up to three refreshes per run. Larger workloads need batching, throughput measurement and stronger monitoring. Hosting minute schedules may require a paid plan; the example is not enabled by default.
5. Warehouse persistence still uses snapshots. The optional migration strengthens server checks but is not the requested full entity/transaction migration. Conflicting offline snapshots require manual review. Broader module-specific server permissions are not finished.
6. The export tool is not a transaction-consistent database backup or proven restore system. Enable managed backups, perform a restore drill, and define revision-history retention; the optional revision table currently retains every prior save.
7. Live Xero demo acceptance, two-device testing, production load tests, monitored recovery, email delivery and carrier integration verification remain outstanding. This release must not be described as flawless or as completing all previously proposed upgrades.
