# Pool Shed v1.14.0 Goods Note Control Release Audit

## Release purpose
This release makes the Goods Note the operational centre of Fulfilment and hardens the sequence from fully allocated stock through picking, packing, dispatch and irreversible shipment.

## Implemented workflow
- Fully allocated Goods Notes are eligible for consolidated Pick Runs.
- Pick Runs group physical warehouse work by location and SKU while retaining Goods Note / Sales Order quantity breakdowns.
- Pick confirmation records actual source locations used by the picker.
- Parcel Goods Notes can be printed individually or in bulk for packed shipments and exclude internal cost/margin/location data.
- Pack & Dispatch supports Courier, Post / Royal Mail, Pool Bros Delivery and Customer Collection.
- Courier supports parcel count, per-parcel tracking, weight and dimensions.
- Post supports tracked/untracked service and postage/tracking reference.
- Pool Bros Delivery supports driver/engineer, vehicle/route, planned date and loaded confirmation.
- Collection uses Pack → Notify Customer → Collected with no fake tracking requirement.
- Ship validates full pick, full pack, allocation, physical stock and dispatch-mode requirements immediately before posting.
- Stock deduction is atomic and prefers the actual picked locations when those are recorded.
- Ship writes a permanent shipment lock. There is no Unship / Undo Ship action.
- Shipped Goods Notes expose Create Return / Credit with exact return quantities.
- Creating a Return / Sales Credit has zero stock effect. Returned stock only becomes available again when it is physically booked back in and processed through the existing return/QC restock or quarantine controls.

## Connected authority model
- Sales Order remains the commercial order.
- Goods Note owns outbound physical fulfilment.
- Warehouse / Inventory remain physical stock authority.
- Sales Credit owns customer return / credit control.
- Stock leaves only at Ship and cannot be restored by editing the shipped Goods Note.

## Verification performed
Fresh `npm run build` completed successfully on the final release state.

Fresh `npm run validate` passed every application test through the accounting core, including:
- v1.14 Goods Note engine, workspace, irreversible-lock and release wiring tests
- v1.13 Fulfilment Command regressions
- Inventory Location Control and engineer-stock tests
- Product Hub and replenishment tests
- Project commercial-control tests
- Purchase Order Command, supplier return and Warehouse booking-in tests
- Warehouse FIFO and Precision Desk tests
- Sales Order authority/finder tests
- CSS architecture, visual consistency, contrast and readability checks
- catalogue, bundle, partial-fulfilment, receiving, workspace sync and accounting-core checks

The validation chain then stopped at `scripts/test-accounting-database.mjs` because the extracted release environment does not contain the development-only dependency `@electric-sql/pglite`.

The remaining non-database tests after that boundary were run separately and passed:
- `scripts/test-accounting-api.mjs`
- `scripts/test-project-engine.mjs`
- `scripts/test-project-ai.mjs`
- `scripts/test-bundle-system-v2.mjs`
- `scripts/test-dashboard-review.mjs`
- `scripts/test-dashboard-command.mjs`
- `scripts/test-release-assets.mjs`

`test-release-assets.mjs` confirmed all 38 referenced runtime assets exist and all public/server/API JavaScript parses.

## Verification limitations
The following database-only tests could not execute because `@electric-sql/pglite` is not installed:
- `scripts/test-accounting-database.mjs`
- `scripts/test-workspace-database.mjs`
- `scripts/test-project-database.mjs`

The browser smoke test was attempted but could not start because `playwright` is not installed in the extracted release environment. This audit therefore does not claim browser/pixel acceptance.

## Release coherence
- package version: `1.14.0`
- service-worker cache: `pool-shed-v1.14.0-goods-note-control`
- runtime asset query strings: `?v=1.14.0`
- service-worker registration: `service-worker.js?v=1.14.0`
