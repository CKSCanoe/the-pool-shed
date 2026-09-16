# Pool Shed v1.12.0 Inventory Location Control Release Audit

## Release
- Version: 1.12.0
- Runtime cache: `pool-shed-v1.12.0-inventory-location-control`
- Inventory engine: `public/inventory-control-engine.js`
- Inventory workspace authority: `public/inventory-workspace.js`
- Inventory CSS authority: `public/assets/css/system/47-inventory-location-control.css`
- Product Hub user-facing terminology updated from Product 360 to Product Details.

## What was implemented

### Location-first Inventory authority
Inventory now uses the approved Option C architecture. The principal operating surface is Locations, with connected views for Engineer Vans, Project Stock, Stock, Overview, Transfers & Top-Ups, Cycle Counts, Missing / Damaged, Stock Movements, and Exceptions & Alerts.

Every location reads the existing physical stock records. No duplicate Inventory stock ledger was introduced.

### Engineer Van control
Engineer Vans are treated as managed mini-warehouses. Per location/SKU the workspace shows:
- On Hand
- Allocated / Project-reserved
- Available
- Min
- Target
- Max
- upcoming Project / Engineer Request demand
- suggested internal move
- last movement
- count status
- stock health

Van readiness is calculated from free stock after reservations. Stock already committed to a Project therefore does not make normal van stock appear healthy.

### Internal top-ups and returns
Van top-ups use the existing `moveStockBetweenLocations` stock mutation and movement audit path. The Inventory engine selects eligible free Warehouse stock and cannot create a supplier PO.

Excess/over-Max van stock can be returned to an eligible Warehouse location through the same physical transfer engine.

If Warehouse free stock cannot cover a shortage, Inventory directs the user to Product Hub Replenishment instead of implementing a second supplier-purchasing process.

### Min / Target / Max controls
Location thresholds remain stored in the existing `restockRules` data. Inventory provides direct editable Min / Target / Max controls and validates ordering so Target cannot fall below Min and Max cannot fall below Target.

### Smart Min
Smart Min recommendations use recent outbound/transfer usage plus open Engineer Request / Project demand. Suggestions are advisory only. A threshold is changed only after a user explicitly applies the suggestion.

### Van profiles
The Inventory workspace includes reviewed profile presets:
- Standard Service Van
- Installation Van
- Summer Service
- Winter Service

Applying a profile requires an explicit user action after a preview. Profiles do not silently post stock movements or automatically change thresholds.

### Alerts and reminders
Inventory generates actionable exception records following Problem -> reason -> next action. Current alert classes include:
- core stock below Min
- over-Max / excess stock
- Project demand above free stock
- stock count due / overdue
- repeated stock variance

Critical/warning Inventory alerts can create daily in-app reminder records in the existing notification store. No external email/push automation was introduced; future Automation/Azzy can consume these events.

### Cycle counts
The new Inventory UI delegates actual count execution to the existing approved stock-take flow, retaining:
- location freeze safeguards
- expected/count quantities
- variance reason requirement
- submit for approval
- approve/recount/reject
- auditable stock movement posting

### Cross-module connections
Inventory is connected to the existing authority modules:
- Product links -> Product Hub Product Details
- Project Job Bins / Project demand -> Projects
- inbound PO references -> Purchase Order Command
- Warehouse action -> Warehouse
- supplier stock shortage -> Product Hub Replenishment
- internal top-up/return -> shared physical transfer engine
- cycle counts -> existing approved stock-take engine

Product Hub user-facing `Product 360` wording was replaced by `Product Details` as requested.

## New verification scripts
- `scripts/test-inventory-control-engine-v112.mjs`
- `scripts/test-inventory-location-control-v112.mjs`
- `scripts/test-inventory-engineer-stock-v112.mjs`
- `scripts/test-inventory-connections-v112.mjs`
- `scripts/test-inventory-visual-guard-v112.mjs`
- `scripts/test-inventory-release-wiring-v112.mjs`

The Inventory tests were developed RED -> GREEN before production implementation.

## Fresh verification evidence

### Production build
`npm run build` completed successfully on the final release tree.

Evidence is stored in `FINAL-BUILD-1.12.0.txt`.

### Full validation
A fresh `npm run validate` passed all application tests through the accounting core, including:
- Inventory v1.12.0 engine, workspace, engineer stock, cross-module connection, visual and release wiring tests
- Product Hub search, replenishment, Product Details, bundles, setup/import and visual ownership
- Project commercial/stock/billing/close-out regressions
- Purchase Order Command, easy booking-in and supplier return regressions
- Warehouse FIFO allocation, Precision Desk and visual ownership
- Sales Order command/finder/list/detail/customer-picker regressions
- runtime validation
- CSS architecture with 20 maintained ownership modules
- visual consistency, contrast and readability
- catalogue health and bundle workflows
- fulfilment lifecycle
- receiving ledger
- workspace sync and performance
- accounting core

The full command then stopped at `scripts/test-accounting-database.mjs` because the extracted release does not contain the development-only dependency `@electric-sql/pglite`.

Evidence is stored in `FINAL-VALIDATE-1.12.0.txt`.

### Database-only verification limitation
The following tests cannot execute in this environment because they import `@electric-sql/pglite`:
- `scripts/test-accounting-database.mjs`
- `scripts/test-workspace-database.mjs`
- `scripts/test-project-database.mjs`

This release must not be described as having a completely green full validation suite in this environment.

### Remaining non-database regressions
After the PGlite boundary, the following were run separately on the same final code state and passed:
- Accounting API
- Project engine
- Project AI
- Bundle Product System
- Dashboard review
- Dashboard command
- release-assets / JavaScript parsing

`test-release-assets.mjs` confirms all 36 referenced runtime assets exist and every public/server/API JavaScript file parses.

Evidence is stored in `FINAL-AFTER-DB-NONDB-1.12.0.txt`.

### Browser acceptance limitation
`npm run test:browser` was attempted. It cannot execute because the extracted package does not contain the `playwright` dependency. This audit therefore does not claim deployed-browser or pixel-level acceptance.

Evidence is stored in `FINAL-BROWSER-1.12.0.txt`.

A deployment acceptance pass should specifically check:
- Inventory Locations landing screen
- Engineer Vans and van detail at normal/compressed desktop widths
- Min / Target / Max editing
- Smart Min review/apply
- profile preview/apply
- top-up and return actions
- Project links
- Product Details links
- Purchase Order inbound links
- cycle-count handoff
- Stock Movements
- Exceptions & Alerts
- service-worker upgrade from v1.11.0

## Result
v1.12.0 makes Inventory the physical location/engineer-stock control layer while preserving Product Hub, Warehouse, Purchasing and Projects as their existing source-of-truth modules. The implementation is connected through shared data and stock movement engines rather than duplicated quantities or parallel workflows.
