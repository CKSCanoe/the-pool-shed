# Pool Shed v1.24.0 Executive Premium Steel Blue

This is the consolidated Pool Shed system release built from the v1.23 visual baseline, with the approved Executive Premium Steel Blue light/dark design system applied across the maintained application.

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
- v1.24 Executive Premium Steel Blue visual system with neutral tables, controlled action hierarchy, restrained selection states and first-class light/dark mode
- Project detail workspace is staff-facing as **Project Details**

## Sign-in and authentication

Pool Shed uses the premium staff login introduced in v1.22. Staff see only Pool Bros branding, sign-in/recovery controls and a discreet version footer. Technical platform details are not exposed on the login screen.

Supabase remains the authentication provider. The v1.22 safety improvements remain: Supabase session validation is authoritative, inactive profiles are denied, and existing enrolled TOTP MFA/AAL2 requirements are respected. v1.24 makes no additional Supabase project/schema migration. The v1.23 auth status remains the unchanged baseline; see `SUPABASE-AUTH-STATUS-1.23.0.md`.

## Visual system

The internal application now uses a restrained navy/teal operational palette. Aqua is reserved for focus/accent rather than large table/header/row fills. Tables, secondary navigation, utility controls and back buttons use quiet neutral surfaces, while green/amber/red remain semantic state colours.

See `EXECUTIVE-PREMIUM-AUDIT-1.24.0.md` for the current visual release and `VISUAL-SYSTEM-AUDIT-1.23.0.md` for the baseline.

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

In this extracted execution environment the application suite passes until the database-only tests attempt to import `@electric-sql/pglite`. The remaining non-database tests after that point are run separately in the release audit.

Browser automation also requires Playwright, which is not installed in this extracted environment.

## Xero state

Keep:

```text
XERO_INTEGRATION_MODE=ready
```

Do not change it to `live` until real browser/device, database, role, backup/restore and Xero Demo Company acceptance are complete.

## Operational data authority

- Warehouse / Inventory own physical stock quantity truth.
- Sales Orders own customer-order truth.
- Purchase Orders and Supplier Command own procurement workflow and supplier commitments.
- Projects link operational records without creating duplicate ledgers.
- Finance Command owns Pool Shed operational finance context.
- Xero remains the future accounting ledger once live connection is explicitly approved.
- The Smart Assistant can use only authorised Pool Shed data and approved Pool Shed knowledge.

## Release evidence

Read `EXECUTIVE-PREMIUM-AUDIT-1.24.0.md` for this release, `LOGIN-COMMAND-AUDIT-1.22.0.md` for the premium login implementation, and `FULL-SYSTEM-RELEASE-AUDIT-1.21.0.md` for the consolidated system baseline.
