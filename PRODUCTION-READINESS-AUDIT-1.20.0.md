# Pool Shed v1.20.0 Production Readiness Audit

## Release purpose
v1.20.0 is the full-system QA, workflow-polish and production-readiness release built from the verified v1.19.0 Settings & Permissions baseline. It adds no new major business subsystem. Its purpose is to verify the existing platform as one connected operating system and make remaining go-live risks visible.

## New production-readiness authority
A read-only `production-readiness-engine.js` now evaluates seven critical journeys from canonical Pool Shed data:

1. Order to Cash
2. Procure to Pay
3. Project Commercial lifecycle
4. Returns & Credits
5. Engineer & Van Stock
6. Automation & Assistant
7. Reporting & Export

The engine separates **system/data blockers** from **live operational attention**. Normal work such as overdue debt, invoice-ready orders or late supplier deliveries is surfaced for action without falsely declaring the application unsafe. Integrity failures such as negative stock, over-allocation, missing authority engines or permission/approval-control gaps are blockers.

## Settings: Production Readiness
Settings now contains a dedicated **Production Readiness** page with:

- Release Health
- Critical Journeys
- Operational Attention
- Environment & Integrations
- Go-Live Checklist
- Read-only JSON readiness report export
- Direct navigation from each finding back to the owning Pool Shed authority surface

The diagnostics page does not mutate business records.

## Cross-module hardening performed
During the v1.20 pass:

- Project close-out diagnostics were restricted to projects actually at Commercial Review, Ready to Invoice or Completed/Complete so active work is not falsely flagged as a failed close-out.
- Project readiness findings route to the real Projects workspace.
- Physical return/QC findings route to Warehouse Inbound, matching the current Warehouse authority terminology.
- Settings release guards were made future-compatible so retaining Settings no longer prevents later application versions.
- Runtime assets and service-worker cache references were advanced to v1.20.0 with no stale v1.19.0 runtime references.
- Production Readiness styling was added as a maintained CSS source module (`system/54-production-readiness.css`) so generated `app.css` builds cannot erase the surface.
- The build script explicitly verifies the Production Readiness engine exists before creating the deployable bundle.

## Preserved business invariants
Regression verification retained the following critical controls:

- Exact-SKU FIFO allocation remains oldest eligible Sales Order first.
- PO demand linkage does not own stock allocation.
- Receiving and quarantine stock do not hard-allocate prematurely.
- Manual reallocation remains reason-required and auditable.
- Engineer/van transfer protection prevents invalid stock movement.
- Shipped Goods Notes remain irreversible and return-led.
- Returns/credits do not increase physical stock until Goods-In/QC resolves the returned goods.
- Project commercial margin, stock, billing and close-out controls remain intact.
- Supplier delivery, credit, price-list and invoice-match intelligence remains intact.
- Finance allocation, credit exposure, three-way matching and reconciliation remain intact.
- Analytics governed metrics and Admin-only Full System Export remain intact.
- Automation simulation/approval controls remain intact.
- Smart Assistant remains Pool Shed-only, permission-scoped and provenance-backed.
- Settings remains the central permission authority across UI, Assistant, Automation and Analytics export.

## Fresh final verification
The exact release tree was re-verified before packaging.

### v1.20 Production Readiness suite
PASS:
- Production Readiness engine journeys, blockers, attention and source authority
- Settings Production Readiness surface/action coverage
- Cross-module authority routes and lifecycle terminology
- v1.20 runtime/cache/release wiring

### Protected module regression
PASS:
- Settings permission engine and security enforcement
- Smart Assistant retrieval/provenance/training/knowledge-gap behaviour
- Automation Command validation/simulation/authority controls
- Analytics governed metrics and reporting/export engine
- Finance Command AR/AP, allocations, credit exposure, three-way match, reconciliation and month end
- Supplier Command credit/timers/flags/products/price lists
- Goods Note irreversible shipment lock
- Inventory control and location authority
- Product Hub search/bundle authority
- Project commercial engine
- Purchase Order Command
- Warehouse FIFO/allocation authority
- Sales Order Command

### Presentation and runtime
PASS:
- Single authoritative runtime CSS bundle
- Visual consistency checks
- Contrast/text rhythm checks
- Colour contrast checks
- Readability hardening checks
- `public` runtime validation
- production `dist` runtime validation
- production build
- 50 referenced runtime assets present
- all public/server/API JavaScript parses

## Known environment limitations
### Database-only automated acceptance
`npm run validate` passes application tests until `scripts/test-accounting-database.mjs`, where Node cannot resolve `@electric-sql/pglite` in this extracted package/runtime. This is the same environment limitation seen in previous release packages.

The non-database tests that appear after that boundary were run separately and passed:
- Accounting API
- Project engine
- Project AI guard
- Bundle Product System
- Dashboard review
- Dashboard Command
- Release asset audit

Database-only suites still requiring a dependency-enabled environment include accounting/workspace/project database tests.

### Automated browser acceptance
`npm run test:browser` was attempted and cannot start because the package does not contain the `playwright` module. Therefore v1.20.0 does **not** claim automated browser/pixel acceptance.

Before a real production cutover, run browser acceptance in the deployment/browser environment and run the PGlite-backed database suites in a dependency-enabled CI/runtime.

## Production readiness conclusion
The static application, production build, cross-module business engines, shared permissions, workflow guards, runtime assets and end-to-end diagnostic contracts are verified in this extracted release environment. The remaining unverified acceptance gates are explicitly limited to the missing PGlite-backed database automation and missing Playwright browser automation environment.
