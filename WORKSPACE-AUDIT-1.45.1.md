# Pool Shed v1.45.1 workspace audit

Baseline: v1.45.0. No database migration or data reset. This package has not been deployed.

## Confirmed issues fixed

- Inventory location management and stock counting now open the authoritative forms, with compatibility for older route aliases.
- Repeated page-level module navigation removed from Inventory, Products, Fulfilment and Warehouse. Sidebar destinations remain available; individual record tabs remain on their records.
- Project editing uses the current workspace form layout and preserves existing permissions and save handlers.
- Failed project edits retain the editor and restore the previous data. Failed Tool Register saves roll back instead of appearing successful.
- Remaining specialist product, inventory and tool forms receive scoped workspace styling while retaining their operational handlers.
- Project surfaces and controls follow shared theme tokens. Small Quote Studio labels have a 10px minimum; the approved Quote Studio palette is retained.

## Verification

- `npm run build`: passed, exit 0; deployable assets regenerated.

- `npm run validate`: passed, exit 0. Covers current deployment, actions, permissions, workflow, API and asset checks.
- `npm run test:database`: passed. Covers accounting, workspace and project migrations, access isolation, duplicate submission protection, reservations and immutable history in a local PostgreSQL-compatible test runtime.
- Focused workspace audit regression tests cover actual inventory route handlers, navigation ownership, project editing and save rollback. The build runs these tests.
- Project engine checks passed for margin calculation, accepted quote locking, revenue deduplication, PO/bill cost replacement, extras approval, duplicate expenses, billing caps and cross-project cost ownership.
- Hire/date/DST, quote signing and existing workflow regression checks are retained.

## Remaining verification limits

The deployed sign-in page was confirmed as v1.45.0 after the reported push. Signed-in desktop/mobile appearance has not been inspected live because the application requires authentication. Source and automated checks do not establish pixel-perfect parity across every screen.

Email, accounting-provider and AI integration checks use test fixtures or mocked providers. No live email, invoice or external transaction was sent. Local database tests do not verify the production database configuration.

A broad historical test sweep also found 16 retained scripts whose expectations reference superseded colours, markup or release versions. These are not claimed as passing and were not deleted. The current validation suite passes. A separate obsolete warehouse navigation assertion was updated to check sidebar reachability and absence of duplicate page navigation.

Historical scripts still requiring reconciliation:

- test-customer-design-parity.mjs
- test-customer-essentials-readable.mjs
- test-customer-health-layout.mjs
- test-customer-light-header.mjs
- test-quote-portal-v129.mjs
- test-quote-studio-v129.mjs
- test-release-v1272.mjs
- test-sales-order-command-compact-v175.mjs
- test-sales-order-command.mjs
- test-sales-order-design-parity-v163.mjs
- test-sales-order-finder-parity-v172.mjs
- test-sales-order-finder-polish-v173.mjs
- test-sales-order-parity-v171.mjs
- test-sales-order-smart-product-finder-v170.mjs
- test-ui-ownership-v174.mjs
- test-ui-ownership-v175.mjs

## Deployment

Use the existing Vercel project and environment variables. Do not initialise or reset the production database. After deployment, verify signed-in Projects, Sales Orders, Purchase Orders, Inventory, Products, Warehouse and Fulfilment at desktop and mobile widths, including multiline table controls and each configured theme.
