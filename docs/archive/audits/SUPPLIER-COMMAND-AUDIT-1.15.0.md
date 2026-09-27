# Pool Shed v1.15.0 Supplier Command Release Audit

Date: 16 September 2026
Baseline: v1.14.0 Goods Note Control
Release: v1.15.0 Supplier Command

## Approved design authority

The production implementation follows the approved original Option C composition, using `docs/design-labs/supplier-command-option-c-approved-v3.html` as the visual reference:

- compact Supplier Command metrics across the top
- supplier work queue in the main column
- Supplier Details directly beneath the queue
- Needs Attention and Quick Actions rail on the right
- dense Pool Shed operational styling rather than a generic CRM layout

## Supplier Details

Supplier Details now provides these connected sections:

- Overview
- Contacts
- Products & Price Lists
- Purchase Orders
- Late & Backorders
- Returns & Credits
- Bills & Credits
- Spend & Performance
- Notes & Activity

The daily Overview intentionally excludes 12-month spend. Spend remains available in Spend & Performance/reporting.

## Credit and payment control

The Overview derives and displays:

- Credit Limit
- Current Account Balance
- Available Credit
- Open PO Exposure
- Projected Exposure
- Projected Headroom
- outstanding supplier bills
- overdue supplier bills

Projected credit utilisation uses the supplier account balance plus outstanding open PO commitments. Warning levels are:

- below 70%: normal
- 70% to below 85%: watch
- 85% to below 100%: warning
- 100% or above: critical

Connected Xero/Accounting ACCPAY documents are preferred when available. Existing legacy `creditUsed` is retained as a fallback when no connected bills or local supplier invoice balances are available.

## Smart supplier flags

Supplier attention is derived from operational records rather than manually maintained cards. Current flags include:

- projected credit exposure approaching/exceeding limit
- late Purchase Orders
- partially received / short deliveries
- supplier chase due
- supplier invoice missing after full receipt
- supplier invoice requiring three-way match
- overdue unpaid supplier bills
- supplier return credit outstanding
- supplier price-list changes awaiting review

Each smart flag routes to the relevant Supplier Details section or connected PO/return workflow.

## Purchase Order delivery timer

The Supplier Command uses actual Purchase Order milestones:

Ordered -> Supplier Confirmed -> Promised ETA -> Physical Receipt

Open POs display live elapsed time as `Day X` plus the current promised-delivery position. Fully received POs freeze the actual order-to-receipt duration and early/on-time/late result. Completed PO history feeds supplier on-time percentage and average actual lead time.

## Products & Price Lists

The supplier product page is a supplier-filtered view of Product Hub. It does not create a second product master.

It supports:

- primary and alternate supplier offers for existing Pool Shed products
- Pool Shed SKU and supplier SKU
- supplier cost, RRP and margin
- lead time
- stock and current inbound quantity
- preferred supplier status
- discontinued and missing-supplier-SKU filters
- direct Product Details navigation
- supplier cost history
- supplier product CSV export
- supplier price-list CSV import template
- price-list import history

Price-list imports use review-before-commit. Comparing a supplier file creates a persistent pending review state for increased, decreased and unmatched rows. Approved matched rows update the supplier offer and retain cost-history/import audit. Unresolved rows remain flagged for review.

## Cross-module connections

Supplier Command is connected to existing authorities rather than creating shadow data:

- Purchase Orders remain the purchasing transaction authority
- Warehouse Goods-In remains physical receipt authority
- Product Hub remains product master authority
- Purchase Returns remain supplier return/credit authority
- Accounting/Xero remains supplier bill/payment authority
- Product Details opens from supplier products
- Book In routes to Warehouse Inbound
- Invoice Matching routes to Purchasing Invoice Matching
- Open Bill routes directly to the linked PO Cost & Invoice tab when a PO exists
- Supplier Returns & Credits routes to the existing purchasing return workflow

## New production authority files

- `public/supplier-command-engine.js`
- `public/supplier-command-workspace.js`
- `public/assets/css/system/49-supplier-command.css`

The Supplier Command CSS is included in the governed generated `app.css` bundle.

## Runtime and cache wiring

- package version: `1.15.0`
- service worker cache: `pool-shed-v1.15.0-supplier-command`
- all versioned HTML runtime assets use `?v=1.15.0`
- supplier engine loads after Purchasing authority
- supplier workspace loads after supplier engine
- both new supplier assets are included in the service-worker precache
- legacy service-worker registration points to `service-worker.js?v=1.15.0`

## Supplier-specific verification

Passing tests:

- `test-supplier-command-engine-v115.mjs`
- `test-supplier-command-workspace-v115.mjs`
- `test-supplier-command-actions-v115.mjs`
- `test-supplier-command-visual-v115.mjs`
- `test-supplier-command-release-v115.mjs`
- `test-supplier-command-purchase-routing-v115.mjs`

The action test covers the Supplier Command's main navigation, edit, modal, import/export, chase, ETA, Product Details, PO, returns, accounting and price-list controls.

## Protected regression verification

Protected regression checks passed for:

- v1.14 Goods Note Control
- v1.13 Fulfilment Command
- v1.12 Inventory Location Control and transfer authority
- v1.11 Product Hub and replenishment
- v1.10 Projects
- v1.9 Purchase Order Command and supplier returns
- Warehouse FIFO, booking-in and Precision Desk
- Sales Order Command
- Accounting core
- Dashboard
- UI ownership
- CSS architecture, visual consistency, contrast and readability
- release asset/runtime parsing

`test-release-assets.mjs` confirms all 40 referenced runtime assets exist and all public/server/API JavaScript parses.

## Production build

`npm run build` passes and generates the deployable `dist` application. The CSS build contains 22 maintained source modules including Supplier Command.

## Known environment limitations

The complete `npm run validate` chain passes every test through `test-accounting.mjs`, then cannot execute `test-accounting-database.mjs` because this extracted package does not contain `@electric-sql/pglite`.

The same missing dependency prevents:

- `test-accounting-database.mjs`
- `test-workspace-database.mjs`
- `test-project-database.mjs`

All remaining non-database tests after that boundary were run separately and passed, including Accounting API, Project engine/AI, bundle system, Dashboard and release assets.

`npm run test:browser` was attempted. It cannot start because the extracted package does not contain the `playwright` module, so automated browser/pixel acceptance is not claimed.

## Release conclusion

v1.15.0 preserves the existing transaction authorities while making Supplier Command the approved supplier-management authority surface. It adds connected supplier credit control, delivery performance, smart exceptions, supplier-only catalogue/price-list workflows and direct routes into the underlying operational records without duplicating stock, product or finance truth.
