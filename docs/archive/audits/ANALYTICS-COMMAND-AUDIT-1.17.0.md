# Pool Shed v1.17.0 Analytics Command Release Audit

## Release
Pool Shed v1.17.0 Analytics Command with Reports & Data Export.

## Approved design implemented
The approved Analytics Command design has been implemented as the Analytics authority surface. The legacy Analytics renderer is replaced at runtime by the dedicated Analytics Command workspace while canonical Sales, Projects, Purchasing, Supplier, Inventory, Warehouse, Fulfilment and Finance records remain the source of truth.

## Analytics Command
Implemented pages:
- Overview
- Business Performance
- Sales
- Projects
- Operations
- Purchasing & Suppliers
- Inventory
- Finance
- Customers
- Products
- Metric Library
- Reports & Data Export

Overview is management-first with governed KPI cards, Management Attention, KPI Watchlist, Business Pulse, driver analysis and data-quality warnings.

## Governed metrics
The Analytics engine owns governed definitions and source metadata for Revenue, Gross Profit, Gross Margin, Quote Conversion, Overdue Debt, Stock Value, Supplier On-Time, Project Margin at Risk, Invoice Ready Value, Aged Stock and Stock-Out Risk.

Quote Conversion is intentionally unavailable when qualified won/lost quote outcomes are not stored. The engine returns a data-quality warning rather than manufacturing a conversion percentage.

## Management Attention
Initial rules cover margin pressure, overdue customer debt, supplier delivery deterioration, project commercial risk, aged stock and invoice-ready value. Each attention item contains an impact and direct route back to the underlying Pool Shed operational workspace.

## Reports & Data Export
Implemented areas:
- Report Builder
- Saved Reports
- Management Reports
- Data Export Centre
- All System Data
- Export History

The reporting catalogue exposes 20 governed datasets:
1. Customers
2. Customer Invoices
3. Customer Payments
4. Sales Orders
5. Projects
6. Products
7. Suppliers
8. Purchase Orders
9. Supplier Bills
10. Inventory Stock
11. Stock Movements
12. Warehouse & Goods-In
13. Goods Notes
14. Supplier Returns
15. Customer Returns & Credits
16. Engineer Vans
17. Project Purchasing
18. Notes & Activity
19. Xero Links
20. Audit Events

CSV downloads are generated from canonical dataset rows. Excel downloads use an Excel-compatible XML workbook rather than a renamed CSV. Cross-system report building supports governed joins including Customer -> Sales Order, Supplier -> Purchase Order and Product -> Inventory Stock.

## Full System Export
Full System Export is Admin-only. It contains:
- all 20 governed reporting datasets;
- the complete authorised Pool Shed workspace snapshot, including operational records/settings not yet represented by a dedicated reporting card;
- the linked finance/Xero document snapshot;
- a manifest describing version, generation time and scope.

Export History persists user, time, dataset/report, format, record count, filters and scope in `data.analyticsCommand.exportHistory`.

## Permissions
A safe current-user/Admin bridge was added to the legacy runtime for Analytics export permission checks. The Full System Export control blocks non-Admin users before data packaging.

## Cross-module routing
Analytics drill-downs route directly into existing operational authority surfaces for Sales Orders, Projects, Purchasing/Supplier Command, Inventory, Finance, Product Hub, CRM and Fulfilment. No duplicate operational state was introduced.

## CSS authority
Analytics styles live in `public/assets/css/system/51-analytics-command.css` and are compiled into the single generated `app.css`. No second Analytics runtime stylesheet is loaded.

## TDD and dedicated verification
Dedicated v1.17.0 tests cover:
- governed metric calculations and data-quality rules;
- management attention;
- all 20 reporting datasets;
- canonical joins;
- CSV escaping;
- Excel-compatible workbook generation;
- full-system package contents and Admin restriction;
- export audit persistence;
- workspace/navigation/reporting structure;
- action coverage;
- visual authority/readability;
- cross-module routes and permission bridge;
- release/cache wiring.

All dedicated Analytics Command tests pass on the release tree.

## Protected regression
Protected regression checks passed for Finance Command, Supplier Command, Goods Note Control, Fulfilment, Inventory, Product Hub, Project 360, Purchase Order Command, Warehouse FIFO/booking, Sales Orders, Dashboard, runtime asset validation, CSS architecture, visual consistency, contrast and readability.

A historical Finance Command release guard was updated from an exact v1.16.0 assertion to a v1.16.0-or-newer feature-retention guard. Finance functionality, asset ordering and CSS authority checks remain intact.

## Full validation limitation
`npm run validate` passes the application stack until `scripts/test-accounting-database.mjs`, where execution stops because `@electric-sql/pglite` is not installed in this extracted package runtime.

The same environment therefore prevents the database-only suites from running here:
- `scripts/test-accounting-database.mjs`
- `scripts/test-workspace-database.mjs`
- `scripts/test-project-database.mjs`

All non-database tests after that boundary were run separately and passed, including Accounting API, Project engine, Project AI, Bundle System, Dashboard Review, Dashboard Command and release asset validation.

## Build and assets
Production build passes. The release asset audit reports 44 referenced assets present and every public/server/API JavaScript file parsing successfully.

## Browser acceptance limitation
`npm run test:browser` was attempted. It cannot run because the extracted package does not include the `playwright` module. Automated browser/pixel acceptance is therefore not claimed.

## Files added
- `public/analytics-command-engine.js`
- `public/analytics-command-workspace.js`
- `public/assets/css/system/51-analytics-command.css`
- Analytics v1.17.0 test suite
- `docs/superpowers/specs/2026-09-16-analytics-command-design.md`
- `docs/superpowers/plans/2026-09-16-analytics-command.md`
- `docs/design-labs/analytics-command-approved-v2.html`

## Release conclusion
v1.17.0 is ready as the next Pool Shed master baseline, subject to the documented database-only and browser-automation environment limitations.
