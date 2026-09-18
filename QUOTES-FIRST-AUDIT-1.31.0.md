# Pool Shed v1.31.0 Quotes First Audit

Release date: 18 September 2026

## Result

The quotation entry point is now **Quotes** in the primary left navigation, directly after **Sales Orders**. Staff can also create a quote from **CRM → customer → New quote**, with the customer preselected.

## Quote routes

### Quick Quote
Accept → Sales Order → stock allocation → draft supplier POs → configured Xero payment request. Project creation is optional.

### Project Proposal
Accept → Project → Sales Order → stock/procurement → project commercial and staged finance workflow.

## Project material authority

Project material/procurement control is derived from linked Sales Orders, Purchase Orders, allocations, Job Bin stock, receipts and stock movements. No parallel project material-request ledger is used.

## Verification

- Production and deployable runtime contain no retired request-layer route, collection, link ID or UI label.
- Quotes primary navigation: PASS.
- New quote workflow chooser: PASS.
- CRM New quote with customer preselection: PASS.
- Quote/customer portal release tests: PASS.
- Azzy contrast/panel regression: PASS.
- Responsive workspace regression: PASS.
- Build/runtime validation: PASS.
- Chromium runtime errors in quote QA: 0.
- Customer proposal isolation: PASS.

`npm run validate` progressed through the application, UI, quote, warehouse, Product Hub, Sales, Project, Finance and visual regression suites until the database-only tests required the development dependency `@electric-sql/pglite`, which is not installed in this sandbox. Those database tests remain in the package for normal CI/development execution.
