# Pool Shed v1.16.0 Finance Command Release Audit

## Release
- Version: 1.16.0
- Authority: approved Option C Finance Command
- Baseline: v1.15.0 Supplier Command
- Operational accounting model: Pool Shed owns operational finance context; Xero remains the posted accounting ledger.

## Implemented Finance Command
- Exception-first Overview with Customers Owe Us, overdue debt, due-this-week receivables, supplier bills due/overdue, unallocated credits, invoice-ready work and Xero exceptions.
- Customer Accounts with outstanding, overdue, unapplied payments, unapplied credits, credit limit, open Sales Order exposure, projected exposure and chase history.
- Payment and credit allocation workspace with reviewed oldest-first suggestions and explicit allocation confirmation.
- Sales Order finance states derived from linked finance documents: Not Invoiced, Invoice Ready, Awaiting Payment, Part Paid, Paid, Overdue and Credit Balance.
- Credit Control with 70% watch, 85% warning and 100% hold defaults plus persistent customer policy/chase state.
- Supplier Accounts, Supplier Bills, Payment Runs and Supplier Credit handling.
- Three-Way Match using Purchase Order vs Goods-In vs Supplier Bill, including quantity/value mismatch and BLOCK PAYMENT status.
- Invoice Ready queue for operationally completed but uninvoiced Sales Orders/Goods Notes.
- Xero Sync page for connection/data movement and a separate Reconciliation page for Pool Shed vs Xero exceptions.
- Month End exception checklist and separate Reports area.
- Stable Xero IDs are used for linked document identity. No name-first accounting identity.
- Financial actions do not create physical stock movements.
- Reconciliation conflicts are explicit. No silent overwrite.

## Xero integration
- Existing OAuth, tenant binding, encrypted token handling, draft export, job queue and remote refresh architecture remains authoritative.
- Finance status/API is enriched for Finance Command consumption and reconciliation.
- Linked ACCREC/ACCPAY records prefer Xero remote amount/status data, with legacy local values only as fallback.
- Live Xero provider acceptance was not claimed in this release because no external production tenant was exercised during packaging.

## UX / design authority
- Option C Finance Command is the Accounting authority surface.
- Navigation: Overview; Customer Accounts; Customer Invoices; Payments & Allocations; Credit Control; Supplier Accounts; Supplier Bills; Payment Runs; Credits & Returns; Three-Way Match; Invoice Ready; Xero Sync; Reconciliation; Month End; Reports.
- Finance Command CSS is compiled into the single authoritative `assets/css/app.css` via `system/50-finance-command.css`.
- No second runtime stylesheet is loaded.
- Daily operational screens do not use 12-month spend as a primary KPI.
- Visible Finance Command actions are covered by the action contract test.

## Important regression fix during release QA
Full validation exposed two stale historical release guards and one CSS integration issue:
1. Supplier Command release guard incorrectly demanded package version 1.15.0 forever. It now verifies Supplier Command remains wired on release 1.15.0 or newer.
2. Legacy service-worker registration still requested `service-worker.js?v=1.15.0`. It now requests v1.16.0.
3. Finance Command initially loaded a second stylesheet. It is now built into the single application CSS authority.

## Verification evidence
### Finance Command suite
`npm run test:finance-command`
- PASS engine AR/AP, allocation, credit exposure, three-way match, reconciliation and month-end controls
- PASS Option C workspace structure and user-facing finance controls
- PASS visible action contract
- PASS visual authority guard
- PASS persistence and cross-module routing
- PASS Xero API enrichment contract
- PASS v1.16.0 release wiring/cache contract

### Full application validation
`npm run validate`
- All application/runtime/visual/feature tests passed through `scripts/test-accounting.mjs`.
- Validation then stopped at `scripts/test-accounting-database.mjs` because `@electric-sql/pglite` is not installed in the extracted package.
- This is the same database-only environment boundary documented in previous releases.

### Remaining non-database tests after the boundary
Run separately and PASS:
- `scripts/test-accounting-api.mjs`
- `scripts/test-project-engine.mjs`
- `scripts/test-project-ai.mjs`
- `scripts/test-bundle-system-v2.mjs`
- `scripts/test-dashboard-review.mjs`
- `scripts/test-dashboard-command.mjs`
- `scripts/test-release-assets.mjs`

`test-release-assets.mjs` result: all 42 referenced assets exist; every public/server/API JavaScript file parses.

### Production build
`npm run build`
- PASS
- `app.css` built from 23 maintained modules.
- runtime validation PASS
- deployable output generated in `dist/`.

### Browser smoke
`npm run test:browser`
- NOT EXECUTED to acceptance because the package does not include `playwright`.
- Exact failure: `Cannot find module 'playwright'`.
- No automated browser/pixel acceptance is claimed.

### Database-only tests not run
The following require unavailable `@electric-sql/pglite`:
- `scripts/test-accounting-database.mjs`
- `scripts/test-workspace-database.mjs`
- `scripts/test-project-database.mjs`

## Release files introduced / materially changed
- `public/finance-command-engine.js`
- `public/finance-command-workspace.js`
- `public/assets/css/system/50-finance-command.css`
- `api/finance.js`
- `public/index.html`
- `public/service-worker.js`
- `public/assets/js/01-legacy-01.js`
- `scripts/build-css.mjs`
- Finance Command v1.16.0 test suite
- release/version wiring in `package.json`
- design spec and implementation plan under `docs/superpowers/`

## Known deployment tasks
- Install/enable the database-test dependency in CI if full local PGlite acceptance is required.
- Exercise Xero OAuth and two-way finance workflows against an authorised non-production Xero organisation before production finance cutover.
- Install Playwright in the QA environment if automated browser acceptance is required.
