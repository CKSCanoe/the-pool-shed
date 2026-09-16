# Pool Shed v1.13.0 Fulfilment Command Release Audit

## Release

- Version: `1.13.0`
- Release: Fulfilment Command
- Approved design: Option A · Fulfilment Command
- Baseline: v1.12.1 Transfer Guard
- Primary runtime authority: `public/fulfilment-workspace.js`
- Fulfilment control engine: `public/fulfilment-control-engine.js`
- CSS authority: `public/assets/css/system/48-fulfilment-command.css`
- Service-worker cache: `pool-shed-v1.13.0-fulfilment-command`

## Authority model

Fulfilment is the physical outbound control layer. Sales Orders remain the commercial demand record, Goods Notes remain the outbound transaction record, and Inventory/Warehouse remain the physical stock truth. The release does not create a second stock ledger or duplicate Sales Order quantities.

The Fulfilment Command provides:

- Overview command centre
- Goods Notes
- Pick Queue
- Pack Bench
- Dispatch
- Collections
- Delivery Exceptions
- History
- search by Goods Note, Sales Order, customer, SKU, postcode and tracking
- Priority, Due Today, Blocked, Collection and Partial filters
- live queue metrics and exception cards
- Problem → reason → action attention queue

## Button and action coverage

A dedicated release regression verifies every Fulfilment command action has a handler, plus delegated section and filter controls.

Covered command actions:

- Print queue
- Batch pick
- New shipment
- Open Goods Note
- Back to queue
- Open pick
- Open pack
- Update dispatch
- Ship
- Notify collection customer
- Put on hold
- Release hold
- Open Sales Order
- Review split / partial fulfilment

The `Update dispatch` dynamic action was specifically caught by the new coverage test and wired to the pack/dispatch editor before release.

## Operational safeguards

### Hold

An operational Hold is a real Goods Note state. While held, Print, Pick, Pack and Ship progression is blocked. Hold reason, time and user are recorded. Releasing the Hold restores normal progression.

The legacy Goods Note path is guarded as well, so opening a Goods Note from Sales Orders or another route cannot bypass Fulfilment Command controls.

### Dispatch gate

Shipment requires the appropriate controls to be satisfied before stock can leave Inventory.

Courier dispatch requires:

- Goods Note packed
- full line quantities packed
- allocation still covers the shipment
- eligible physical stock still covers the shipment
- delivery address
- courier
- real tracking / carrier label reference

Pool Bros van delivery requires:

- Goods Note packed
- full line quantities packed
- allocation still covers the shipment
- eligible physical stock still covers the shipment
- delivery address

Customer collection requires:

- Goods Note packed
- physical stock and allocation coverage
- customer collection notification before collection is completed

### Atomic stock-out

Shipment now preflights the complete Goods Note before mutating stock. If any line cannot be fully covered, the shipment posts no stock movements and the Goods Note remains unshipped.

When stock is valid, the shipment can consume the required quantity across multiple eligible warehouse rows. Each actual source movement is recorded. Sales Order allocations are released only as part of the successful shipment transaction.

This prevents the previous risk of partially consuming one location and then presenting the Goods Note as successfully shipped.

### Packing race protection

The pack/shipping modal rechecks the underlying pack action on Save. If the Goods Note has become Held or otherwise invalid while the modal was open, the save is rejected and no false success message or delivery-note print occurs.

## Preserved integrations

The release preserves and regression-checks:

- partial / multiple Goods Notes per Sales Order
- existing Goods Note lifecycle
- Sales Order status synchronisation
- allocation release on shipment
- Warehouse FIFO allocation
- Warehouse booking-in
- Inventory transfer safeguards, including all-or-nothing van top-ups
- Purchase Order Command
- Product Hub and Product Details terminology
- Project 360 engine and Project close-out controls
- Customer and Dashboard authority surfaces
- offline/service-worker runtime coherence

## Release coherence

All local runtime assets are versioned to the current package release. The service-worker registration is now also explicitly `service-worker.js?v=1.13.0`, and the service-worker cache namespace is `pool-shed-v1.13.0-fulfilment-command`.

Older regression tests that had incorrectly frozen the whole application at v1.12.x were corrected to verify current release coherence rather than requiring historical version numbers. Their functional assertions remain intact.

## Fresh verification

`npm run build` completed successfully on the final code state and generated the deployable `dist/` application.

The complete `npm run validate` chain passed every test through the accounting core, including:

- Fulfilment Command engine
- Fulfilment Command workspace
- exhaustive Fulfilment button/action coverage
- Hold and legacy-path guard coverage
- Fulfilment visual/readability/responsive guard
- Fulfilment release/runtime/cache wiring
- Inventory control and engineer-stock intelligence
- Inventory cross-module connections
- Product Hub engine, replenishment, Product Details, bundles and imports
- Project commercial-control and close-out gates
- Purchase Order Command, booking-in and supplier returns
- Warehouse FIFO, Precision Desk and visual guards
- UI ownership and service-worker coherence
- Sales Order command, finder, list, detail and customer picker
- runtime validation
- CSS architecture across 21 ownership modules
- visual consistency, contrast and readability
- Catalogue Health and Bundle Studio
- partial fulfilment lifecycle
- PO catalogue performance and picker
- receiving ledger
- workspace sync and performance
- accounting core

The full validation command then stopped at `scripts/test-accounting-database.mjs` because the extracted release does not contain the development dependency `@electric-sql/pglite`.

The following database-only regressions could therefore not execute in this environment:

- `scripts/test-accounting-database.mjs`
- `scripts/test-workspace-database.mjs`
- `scripts/test-project-database.mjs`

All remaining non-database tests after that boundary were executed separately on the same final code state and passed:

- `scripts/test-accounting-api.mjs`
- `scripts/test-project-engine.mjs`
- `scripts/test-project-ai.mjs`
- `scripts/test-bundle-system-v2.mjs`
- `scripts/test-dashboard-review.mjs`
- `scripts/test-dashboard-command.mjs`
- `scripts/test-release-assets.mjs`

`test-release-assets.mjs` confirmed all 38 referenced assets exist and every public/server/API JavaScript file parses.

## Browser acceptance limitation

`npm run test:browser` was attempted. It cannot execute because the extracted release does not include the `playwright` package. Therefore this audit does not claim browser/pixel acceptance.

Deployment acceptance should include a normal browser pass of:

- Fulfilment Overview and queue filters
- Goods Note detail
- Hold / Release
- Pack modal
- Update dispatch
- courier Ship gate
- Pool Bros van delivery
- customer collection flow
- partial fulfilment
- blocked/insufficient-stock shipment
- narrower desktop/tablet widths
- service-worker upgrade from v1.12.x

## Result

v1.13.0 makes Fulfilment an exception-led outbound command system while preserving the established Sales Order, Warehouse, Inventory and Goods Note authority boundaries. The release specifically protects against dead command buttons, stale cached runtime assets, Hold bypass, missing dispatch data and partial/unsafe physical stock deductions.
