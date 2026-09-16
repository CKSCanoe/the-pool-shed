# Pool Shed v1.8.0 Warehouse Precision Desk Release Audit

## Scope

This release implements the approved Warehouse Concept C, Precision Desk, while preserving the approved Dashboard, Customer and Sales Order authority layers.

## Stock allocation contract

- Accepted warehouse stock allocates automatically to exact-SKU open Sales Order shortages.
- FIFO priority is oldest Sales Order creation date first, then earliest due date, then Sales Order ID.
- A PO-origin Sales Order link is traceability/demand-source metadata only and never jumps an older eligible Sales Order.
- Receiving and Quarantine stock cannot hard-allocate.
- Surplus accepted stock remains free stock after open shortages are satisfied.
- Manual reallocation is available only after automatic allocation, requires a reason, is quantity-safe, recalculates source/destination status and writes an audit movement/event.

## Warehouse workspace

Warehouse now uses the approved Precision Desk information architecture:

1. Work Queue
2. Inbound
3. Transfers
4. Returns & Quarantine
5. Counts
6. Audit

Inbound follows Receive → QC → Putaway. Stock is staged into Receiving/QC before acceptance. Accepted stock is put away then passed through FIFO allocation. Damaged/wrong stock is isolated from available stock.

## Visual ownership

- Added `public/assets/css/system/35-warehouse-workspace.css` as the scoped Warehouse presentation owner.
- Added `public/warehouse-workspace.js` as the Warehouse workflow/presentation authority layer.
- Production CSS build now contains 16 maintained modules.
- Warehouse tables are contained, the inspector collapses responsively, and sub-micro text was removed after readability regression testing.

## Release coherence

- Package version advanced to 1.8.0.
- Local JS/CSS runtime assets use `?v=1.8.0`.
- Service worker namespace advanced to `pool-shed-v1.8.0-warehouse-precision`.
- Warehouse runtime is precached and loaded after the approved Sales workspace.

## Verification performed

Fresh automated checks passed for:

- Warehouse FIFO allocation and controlled reallocation;
- Warehouse Precision Desk structure/process controls;
- Warehouse visual overflow/responsive guard;
- UI ownership and service-worker coherence;
- Sales Order compact command/finder/detail/asset freshness/customer picker;
- Dashboard and Customer parity protections;
- CSS architecture, visual consistency, colour contrast and readability;
- Catalogue Health, Bundle Studio and bundle sales intelligence;
- Fulfilment lifecycle and receiving ledger;
- PO catalogue performance and PO picker UI;
- production overhaul, workspace sync, tools, ledger performance;
- accounting core/API;
- project engine/AI;
- release asset existence and JavaScript parse checks.

`npm run build` completed successfully and generated a validated `dist/`.

## Verification limitations

The extracted release does not contain the development-only `@electric-sql/pglite` package. The full validation chain therefore stops when it reaches `test-accounting-database.mjs`. The other PGlite-only scripts, `test-workspace-database.mjs` and `test-project-database.mjs`, are also not executable in this environment. Remaining non-PGlite tests were run separately and passed.

A production browser acceptance screenshot could not be executed because the available Chromium installation is administrator-blocked from both localhost and file URLs. The Warehouse visual regression tests and selected Design Lab were used for layout validation, but deployed browser acceptance remains required.
