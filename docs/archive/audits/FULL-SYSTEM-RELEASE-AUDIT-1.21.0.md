# Pool Shed v1.21.0 Full System Release Audit

## Release purpose

v1.21.0 consolidates the approved Pool Shed modules into one final system package and applies release-wide polish rather than adding a new business subsystem.

Final main navigation:

Dashboard → CRM → Projects → Sales Orders → Project Purchasing → Product Hub → Inventory → Purchasing → Warehouse → Fulfilment → Accounting → Analytics → Automation → Settings

## Final polish completed

- Replaced legacy main-navigation labels `Customers & Suppliers`, `Jobs / Projects`, and `Order Requests` with the approved final terminology while preserving internal IDs and existing records.
- Updated the suggested operating flow to include Projects, Project Purchasing and Automation.
- Advanced the application, runtime assets, service-worker registration and cache namespace to v1.21.0.
- Production Readiness now reports the current v1.21.0 release identity and keeps Returns & Credits routing aligned to Warehouse Inbound.
- Historical Xero and Production Readiness regression guards now verify feature retention on newer releases instead of incorrectly freezing the entire application at v1.20.x.
- Xero remains deliberately parked in `Ready to Connect` mode. No live OAuth authorisation, tenant selection or provider synchronisation is enabled by this release.
- Added `START-HERE.md`, `FULL-SYSTEM.env.example`, `CURRENT-RELEASE.txt` and current-first README guidance for handoff.

## Protected system areas retained

The existing regression suite passed for the following before the database-only dependency boundary:

- Xero safe-mode/readiness contract
- Production Readiness journeys and read-only diagnostics
- Settings permission roles, overrides, approval limits, financial visibility and enforcement
- Smart Assistant Pool Shed-only retrieval, provenance, product finding, training and knowledge-gap behaviour
- Automation Flow Builder, simulation, approvals and audit
- Analytics governed metrics, reporting, system export and drill-downs
- Finance AR/AP, customer allocation, credit exposure, supplier matching and reconciliation
- Supplier Command credit control, delivery timers, smart flags, product/price-list controls
- Goods Note shipment locking and return-led stock restoration
- Fulfilment pick/pack/dispatch controls
- Inventory location and engineer-van controls
- Product Hub search, bundles and replenishment
- Project commercial controls and close-out gates
- Purchase Order Command, Goods-In and supplier returns
- Warehouse FIFO allocation, quarantine and manual reallocation controls
- Sales Order Command, customer finder, allocation, fulfilment and asset freshness
- CSS ownership, contrast, readability and responsive authority checks
- Runtime asset and JavaScript parsing checks

## Full validator result

`npm run validate` passed the complete application suite until the first database-only test attempted to import `@electric-sql/pglite`.

The three database-only tests remain unexecuted in this environment because the dependency is unavailable at runtime:

- `scripts/test-accounting-database.mjs`
- `scripts/test-workspace-database.mjs`
- `scripts/test-project-database.mjs`

The dependency is declared in `package.json`. An installation attempt was made during final acceptance but timed out and did not create `node_modules`.

This is recorded in `FINAL-DATABASE-GAPS-1.21.0.txt`.

## Tests after the database boundary

The remaining non-database tests were executed separately and passed:

- Accounting API controls
- Project engine
- Project AI guardrails
- Bundle Product System
- Dashboard review
- Dashboard command
- Release asset validation

Evidence: `FINAL-AFTER-DB-NONDB-1.21.0.txt`.

## Production build

`npm run build` completed successfully.

- CSS rebuilt from 27 maintained source modules.
- Deployable application written to `dist/`.
- Runtime validation passed on `dist/`.

Evidence:

- `FINAL-BUILD-1.21.0.txt`
- `FINAL-RUNTIME-DIST-1.21.0.txt`

## Runtime asset audit

The final release asset test reports:

- 50 / 50 referenced runtime assets present
- every public/server/API JavaScript file parses successfully

## Browser acceptance

Automated browser acceptance is not claimed.

- `npm run test:browser` cannot start because `playwright` is not installed in this extracted environment.
- A direct Chromium headless fallback was attempted and timed out because the container browser cannot establish its D-Bus environment.

Evidence:

- `FINAL-BROWSER-1.21.0.txt`
- `FINAL-CHROMIUM-1.21.0.err`

A real deployment/browser/device acceptance pass remains a go-live requirement.

## Xero state

Xero is prepared but inactive.

`XERO_INTEGRATION_MODE=ready`

The server-side safety gate continues to block OAuth connect, callback processing, webhooks, cron/provider sync and other live Xero operations unless Live mode is deliberately enabled after production acceptance.

See `XERO-CONNECTION-READY.md`.

## Go-live items still requiring a real environment

1. Install dependencies and run the three database-backed tests.
2. Run Playwright/browser acceptance on supported desktop/mobile browsers.
3. Verify Supabase production migrations, backup and restore.
4. Test real roles and approval limits using representative staff accounts.
5. Validate email/notification integrations if enabled.
6. Test Xero against a Demo Company while retaining `Ready` until that acceptance begins.
7. Complete accountant review of Xero accounts/tax mappings before live tenant connection.

## Conclusion

v1.21.0 is the consolidated full Pool Shed system package. Application-level regression, runtime, CSS/readability, production build and post-database-boundary non-DB tests are green. The remaining database and browser checks are explicitly unverified because their required dependencies/environment are unavailable here and have not been converted into false passes.
