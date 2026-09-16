# Pool Shed v1.21.0 Legacy Data Migration Audit

## Purpose
v1.21.0 adds an Admin-controlled recovery path for operational records saved in previous Pool Shed generations while retaining the v1.20 Production Readiness platform as the authority.

## Legacy sources
- `poolbros:system:appData` legacy browser workspace.
- Per-user `poolbros:*:appData` snapshots.
- IndexedDB `the-pool-shed-offline` / `state` / `appData`.
- Read-only Supabase `offline_sync_snapshots` through the authenticated current client when available.
- Manual JSON snapshot import.

## Safety contract
- Dry-run preview before apply.
- Existing populated current fields win.
- Existing current product/location stock balance wins and legacy quantity is skipped rather than added.
- Ambiguous identity matches become conflicts instead of guessed merges.
- Complete pre-migration workspace backup is generated before mutation and downloaded by the Settings workflow.
- Migration history is written to `legacyMigrationHistory` and normal Pool Shed `saveAppData` handles persistence/sync.
- Authentication, permissions, Xero connection state and current UI authority are not migrated from the old system.

## Identity matching
Products: ID/SKU, supplier SKU, barcode and MPN. Customers: ID/code, email and name+postcode. Suppliers: ID/name and derivation from legacy product/PO data. Locations: ID/name. Operational history uses stable IDs and deterministic fingerprints where an ID is absent.

## Release wiring
- Engine: `public/legacy-migration-engine.js`
- Settings authority: `Legacy Data Migration`
- CSS: `system/55-legacy-migration.css`
- Release: `1.21.0`
- Service worker: `pool-shed-v1.21.0-legacy-data-migration`

## Migrated legacy coverage
The migration planner now covers suppliers, customers, products, locations, projects/jobs, Sales Orders, Purchase Orders, standalone legacy sales history, stock balances, allocations, stock movements, Goods Notes, Engineer Requests, Sales Credits and notifications. Relationship IDs are remapped to the canonical records chosen during matching.

## Admin workflow
`Settings → Legacy Data Migration` is Admin-only and provides source discovery, manual JSON import, dry-run reporting, conflict visibility, current-workspace backup download and an explicitly confirmed apply action. Apply also creates a complete pre-migration backup before mutation and then routes persistence through the existing Pool Shed `saveAppData` path.

## Fresh verification evidence
Fresh verification on the final v1.21.0 source tree passed:
- Legacy Migration engine/workspace/release suite.
- Settings permissions, integration and security enforcement.
- Production Readiness retained-release suite.
- Supplier Command.
- Finance Command.
- Analytics Command.
- Automation + Azzy.
- Goods Note + Fulfilment.
- Warehouse FIFO/Precision/receiving/fulfilment lifecycle.
- Project engine and Project AI non-database tests.
- Accounting API.
- Bundle Product System.
- Dashboard review and Dashboard Command.
- Production build.
- Release asset audit: 51 referenced assets present and all public/server/API JavaScript parses.
- Built `dist` runtime validation.

## Environment-only acceptance boundaries
`npm run validate` reaches `scripts/test-accounting-database.mjs` and then stops because this extracted package does not contain the development test dependency `@electric-sql/pglite`. The application/accounting checks immediately before that boundary pass. This is the same database-only environment boundary documented in the v1.20 baseline.

`npm run test:browser` cannot start because this extracted package does not contain the `playwright` module. Automated browser/pixel acceptance is therefore not claimed. A deployed browser acceptance pass remains a go-live gate.

## Result
v1.21.0 provides a guarded migration path that can recover legacy Pool Shed operational information without restoring legacy UI/code or blindly replacing newer canonical records. The migration remains opt-in and review-first: discover/import → dry run → conflict review → backup → confirmed apply.
