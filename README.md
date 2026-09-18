# Pool Shed v1.31.0

Pool Shed is the Pool Bros operational system for CRM, quotes, Sales Orders, Projects, Product Hub, Inventory, Purchasing, Warehouse, Fulfilment, Accounting, Analytics, Automation and controlled administration.

## Current operating flow

**Dashboard → CRM → Quotes → Sales Orders → Projects where required → Product Hub → Inventory → Purchasing → Warehouse → Fulfilment → Accounting**

Quotes are created in the left navigation under **Quotes**, directly after **Sales Orders**. You can also open any CRM customer and press **New quote** to start a quote with that customer already selected.

### Quote workflows

- **Quick Quote**: Accept → Sales Order → stock allocation → draft supplier POs → optional Xero payment request. A Project is optional.
- **Project Proposal**: Accept → Project → Sales Order → stock/procurement → staged finance and project control.

The accepted quote/version retains exact Product Hub SKU and bundle traceability. Projects do not create a parallel material-demand layer. Materials are controlled through linked Sales Orders, Purchase Orders, allocations, Job Bin stock, receipts and stock movements.

## Customer proposal boundary

The customer proposal is a separate secure surface. Customers receive presentation-safe quote content only. Internal margin, supplier costs, stock, Sales Orders, Purchase Orders, project control, approvals and internal engagement data are not sent to the customer browser.

## Build

```bash
npm run build
```

The deployable app is written to `dist/`.

## Validation

```bash
npm run validate
```

In this sandbox, the application and browser/release tests pass until the database-only suite reaches the development-only `@electric-sql/pglite` dependency. Run the database tests in the normal development/CI environment before production database promotion.

## Xero

Xero remains gated by the existing integration settings. Keep `XERO_INTEGRATION_MODE=ready` until the live connection is explicitly approved and tested.

## Release files

See `RELEASE-NOTES-1.31.0.md` and `DEPLOYMENT-GUIDE-1.31.0.md` for the current release.
