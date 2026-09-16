# Pool Shed v1.22.0 Full System

This is the consolidated Pool Shed system release.

## Main navigation

Dashboard → CRM → Projects → Sales Orders → Engineer Requests → Product Hub → Inventory → Purchasing → Warehouse → Fulfilment → Accounting → Analytics → Automation → Settings

## What is included

- Dashboard command centre and operational attention
- CRM customer records and connected commercial history
- Projects with procurement, stock, margin, variation, billing and close-out controls
- Sales Order Command with product finder, allocation, pricing, payment and fulfilment state
- Engineer Requests linked to projects and purchasing
- Product Hub with Product Details, bundles, supplier offers and replenishment
- Inventory Location Control, engineer vans, transfers, counts and movement audit
- Purchase Order Command and Supplier Command
- Warehouse receiving, QC, FIFO allocation, quarantine, returns and stock counts
- Fulfilment Goods Notes, pick runs, pack/dispatch, collection, shipment lock and returns
- Finance Command for AR/AP, allocations, credit control, three-way matching and reconciliation
- Analytics Command with governed metrics, reports and full-system export controls
- Automation Command and Pool Shed-only Smart Assistant
- Settings, users, roles, permissions, approval limits and Production Readiness
- Xero integration prepared in Ready mode but deliberately not connected live


## Sign-in and authentication

Pool Shed v1.22.0 uses the premium staff login as the production entry point. Staff see only Pool Bros branding, sign-in/recovery controls and a discreet version footer. Technical platform details are not exposed on the login screen.

Supabase remains the authentication provider. Existing email/password and password-recovery flows are retained, with additional safety around session authority, inactive profiles and already-enrolled authenticator MFA. See `SUPABASE-AUTH-CHANGE-NOTE-1.22.0.md`.

## Build

```bash
npm run build
```

The deployable static application is written to `dist/`.

Public Supabase runtime values used by the build:

```text
SUPABASE_URL=...
SUPABASE_PUBLISHABLE_KEY=...
SECURE_WORKSPACE_WRITES=false
```

Server-side accounting/Xero values are documented in `ACCOUNTING-SETUP.md` and `XERO-CONNECTION-READY.md`.

## Validate

```bash
npm run validate
```

In this extracted execution environment the application suite passes until the database-only tests attempt to import `@electric-sql/pglite`. The dependency is declared in `package.json`, but could not be installed in the current environment. The non-database tests after that point are run separately in the release audit.

Browser automation also requires Playwright, which is not installed in this extracted environment.

## Xero state

Keep:

```text
XERO_INTEGRATION_MODE=ready
```

Do not change it to `live` until the rest of Pool Shed has completed real browser/device, database, role, backup/restore and Xero Demo Company acceptance.

## Operational data authority

- Warehouse / Inventory own physical stock quantity truth.
- Sales Orders own customer-order truth.
- Purchase Orders and Supplier Command own procurement workflow and supplier commitments.
- Projects link operational records without creating duplicate ledgers.
- Finance Command owns Pool Shed operational finance context.
- Xero remains the future accounting ledger once live connection is explicitly approved.
- The Smart Assistant can use only authorised Pool Shed data and approved Pool Shed knowledge.

## Release evidence

Read `LOGIN-COMMAND-AUDIT-1.22.0.md` for the current release verification record and `FULL-SYSTEM-RELEASE-AUDIT-1.21.0.md` for the prior full-system baseline.
