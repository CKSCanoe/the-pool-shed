# Pool Shed v1.30.0 - Quick Quote + Project Proposal Workflow

Release date: 18 September 2026

## Release purpose

This release completes the native Pool Shed Quote Studio and gives staff two controlled quote workflows without creating a second sales system.

### Quick Quote

Designed for light refurbishments, repairs, equipment replacements and smaller jobs where full project administration is not required.

Default acceptance flow:

Quote -> customer acceptance -> Sales Order -> stock allocation -> supplier shortages -> draft Purchase Orders -> Xero payment request

Quick Quote defaults:

- No Project record is created unless staff deliberately select `Create Project on acceptance`.
- A Sales Order is created automatically from the frozen accepted quote version.
- Available stock is allocated without exceeding on-hand stock.
- Shortages can be grouped into draft supplier Purchase Orders.
- Xero request defaults to full payment but can be changed to deposit or no automatic request.
- Purchase Orders can remain payment-gated until the required payment is confirmed.

### Project Proposal

Designed for pool builds, major refurbishments and higher-value work requiring project controls.

Default acceptance flow:

Proposal -> customer acceptance -> Project -> Sales Order -> stock allocation -> draft Purchase Orders -> Xero deposit request -> project procurement and payment milestones

## One quote authority

Both workflows use the same Quote Studio engine and Product Hub records. Quote lines retain Product Hub IDs, Pool Bros SKUs, supplier SKUs, supplier snapshots, quantities, sell prices, cost snapshots and originating quote/option references.

Customer-facing bundles remain elegant in the proposal while operational bundle component SKUs can be exploded internally for Sales Orders, stock allocation and purchasing.

The workflow and handover policy are frozen inside the published commercial snapshot. Changing a draft after publication does not alter the workflow of an already published or accepted version.

## Customer presentation isolation

The customer receives only the private proposal route at `/proposal`.

The public proposal payload does not contain:

- supplier costs
- internal margins
- stock balances
- Sales Order details
- Purchase Order details
- Project Handover controls
- internal approvals
- internal notes
- internal workflow policy

The proposal route has private no-store caching, no-referrer behaviour, frame denial, content-type protection and a restrictive Content Security Policy.

Customer activity can record meaningful events such as first open, revisits, section views, option changes, document views, questions and acceptance. It does not claim that a customer has literally read text just because a page loaded.

## Acceptance and operational handover

Accepted proposal evidence is linked to the exact version and selected configuration.

Conversion is idempotent. Repeating an acceptance or conversion cannot intentionally create duplicate Projects, Sales Orders or Purchase Orders for the same accepted version.

For a Quick Quote, `projectId` can remain empty while the Sales Order retains the accepted quote reference and SKU traceability.

For a Project Proposal, the created Project and Sales Order retain the quote/version source and accepted commercial snapshot.

## Xero behaviour

Quote Studio uses the existing Pool Shed finance/Xero integration authority.

Payment modes:

- `full` - full accepted quote payment request
- `deposit` - accepted quote deposit request
- `none` - no automatic Xero request

If live Xero requirements are not ready, Quote Studio leaves the payment request in a safe `Ready for Xero` state instead of failing the operational conversion.

Supplier Purchase Orders remain payment-gated when that policy is enabled.

## Existing Pool Shed systems preserved

v1.30.0 was built on the v1.28.0 responsive/Azzy baseline and the v1.29 Quote Studio integration. It does not replace the existing Product Hub, Inventory, Warehouse, Sales Order, Purchasing, Project, Finance, Azzy, permissions or notification engines.

The existing responsive layout authority remains last in the internal CSS build. Quote Studio uses the same Executive Premium semantic design tokens and does not introduce a second internal visual authority.

## Database

Apply `database/007-quote-studio.sql` after the existing migrations 001-006.

The migration adds secure service-role quote publication, engagement, question and acceptance tables, immutable published/accepted history safeguards, and the CAS workspace writer used by public acceptance.

Public clients receive no direct table permissions.

## Required runtime environment

The project references the following environment variables where their respective features are enabled:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `APP_ORIGIN`
- `XERO_CLIENT_ID`
- `XERO_CLIENT_SECRET`
- `XERO_TOKEN_KEY`
- `XERO_WEBHOOK_KEY`
- `FINANCE_WORKSPACE_ID`
- `OPENAI_API_KEY`
- `PROJECT_AI_MODEL`
- `CRON_SECRET`
- `BACKUP_ENCRYPTION_KEY`

Do not add secrets to the source package. Configure them through the deployment environment.

## Verification completed in this build environment

Passing release checks include:

- v1.30 native Quote Studio wiring
- safe customer/public snapshot
- Product Hub SKU and bundle operational mapping
- customer portal isolation
- immutable acceptance and non-duplicated engagement events
- Quick Quote direct-to-Sales-Order conversion
- optional Project creation from Quick Quote
- Project Proposal workflow
- frozen workflow authority
- full/deposit/no-payment modes
- stock and draft-PO handover
- idempotent conversion
- semantic theme contrast
- visual consistency
- readability hardening
- v1.28 responsive layout authority
- v1.27.3 Azzy panel/cache authority on v1.30.0
- all referenced release assets present and JavaScript parsing
- full `npm run build`

Chromium QA also passed with:

- Quote Studio: PASS
- Quick Quote creation: PASS
- Customer portal isolation: PASS
- Runtime JavaScript errors: 0

The database execution tests that use `@electric-sql/pglite` remain included in the project. This sandbox could not install that development-only package, so those specific in-memory PostgreSQL test files were not executed here. They should be run in the normal development/CI environment after a standard dev dependency install and before production database deployment.

## Rollback safety

The v1.28.0 responsive/Azzy baseline and v1.29.0 Quote Studio release were not overwritten during this work. Keep the previous deployment available until v1.30.0 has completed production smoke testing.
