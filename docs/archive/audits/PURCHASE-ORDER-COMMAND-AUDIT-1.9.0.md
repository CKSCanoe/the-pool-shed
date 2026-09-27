# Pool Shed v1.9.0 Purchase Order Command Audit

## Scope
This release starts from v1.8.0 Warehouse Precision Desk and implements the approved Purchase Order Supplier Command plus the easy booking-in process.

## Purchasing
- Purchase Orders now open as a supplier-side twin of the approved Sales Order Command.
- Seven PO tabs: Items & Costing, Demand Sources, Supplier Confirmation, Deliveries & Receipts, Costs & Invoice Match, Returns & Credits, Activity.
- Purchasing primary sections: Purchase Orders, Procurement Demand, Suppliers, Supplier Returns & Credits, Invoice Matching.
- Procurement Demand can merge uncovered Sales Order shortages into an existing Draft PO for the same supplier.
- PO line links show where demand originated without overriding physical-stock FIFO allocation.
- Supplier confirmation records confirmed quantity, ETA, cost and notes/exceptions.
- Deliveries & Receipts is read-only from Purchasing and reflects Warehouse receipt/QC records.
- Three-way cost view compares PO value, confirmed value, received value and supplier invoice.

## Booking-in / Warehouse
- One-confirmation booking-in replaces repetitive line-by-line receiving for normal deliveries.
- Operator selects the PO, enters supplier delivery reference/note, records quantity and a clear QC decision per line, then confirms once.
- Accepted stock: receipt is created -> stock releases to selected/recommended location -> exact-SKU FIFO allocates to oldest eligible Sales Orders.
- Damaged stock: receipt is created -> stock moves to Quarantine -> it remains blocked from allocation.
- Shortage / wrong-item decisions remain outstanding and create warehouse exceptions; they do not fake a receipt.
- No normal Goods-In control asks staff to choose a Sales Order.
- Existing post-FIFO manual reallocation remains available only with a reason and audit trail.

## Supplier Returns & Credits
- Mis-orders, supplier errors, damage, warranties, duplicates and no-longer-required stock can be returned from the original PO.
- Only free stock can be returned.
- Return stock moves to `L-RETURNS-HOLD`; physical On Hand is preserved while Available is reduced.
- Return record keeps PO, receipt, supplier, product, supplier SKU, quantity, original unit cost, expected credit, reason and status.

## Release coherence
- package version: 1.9.0
- runtime query strings: `?v=1.9.0`
- service worker cache: `pool-shed-v1.9.0-purchase-order-command`
- new runtime authority: `public/purchase-workspace.js`
- new CSS authority: `system/44-purchase-order-command.css`
- CSS architecture now contains 17 maintained modules.

## Fresh verification
`npm run build` passes and produces `dist/`.

Focused/new regressions pass:
- Purchase Order Supplier Command structure
- one-confirmation Warehouse booking-in
- Supplier Return / Returns Hold behavior
- Purchase Order visual ownership and responsive guards
- Warehouse FIFO allocation and controlled reallocation
- Warehouse Precision Desk structure and visual guard
- PO catalogue/picker performance and UI
- receiving ledger
- fulfilment lifecycle
- Sales Order command/detail/customer picker
- Customer Design Lab parity
- Dashboard command/final composition
- CSS architecture, visual consistency, contrast and readability

Full `npm run validate` passes through all UI, warehouse, sales, catalogue, bundle, receiving, workspace sync, performance and accounting-core checks, then stops when `test-accounting-database.mjs` tries to import missing development dependency `@electric-sql/pglite`.

The following remaining non-database tests were run separately after that blocker and pass:
- accounting API
- project engine
- project AI
- bundle system v2
- dashboard review
- dashboard command
- release assets / JavaScript parse

Database-only tests not executed in this extracted environment:
- `test-accounting-database.mjs`
- `test-workspace-database.mjs`
- `test-project-database.mjs`

## Browser acceptance limitation
A normal deployed-browser acceptance pass is still recommended for final visual review of PO list/detail, tab switching, product picker, easy booking-in, Returns Hold and responsive widths. The local execution environment used for this release does not provide a reliable normal browser acceptance path, so this audit does not claim a production-browser screenshot pass.
