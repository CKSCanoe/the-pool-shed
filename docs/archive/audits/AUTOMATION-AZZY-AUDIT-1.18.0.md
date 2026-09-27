# Pool Shed v1.18.0 Automation Command + Smart Assistant Release Audit

## Release
- Version: 1.18.0
- Baseline: v1.17.0 Analytics Command
- Authority: approved Automation Command + floating assistant + Flow Builder design and subsequent approved assistant identity / Pool Shed-only intelligence refinements.

## Implemented

### Automation Command
First-class navigation module with:
- Overview
- Active Automations
- Suggested Automations
- Automation Builder
- Templates
- Alerts & Escalations
- Approvals
- Scheduled Jobs
- Azzy / configured assistant
- Activity Log

### Visual workflow builder
Supported node types:
- Trigger
- Schedule
- Condition
- Get Data
- Branch
- Wait
- Action
- Approval
- Notify

Safety authority:
- Automatic for low-risk internal work.
- Approval Required for controlled operational actions.
- Suggest Only for sensitive financial/commercial decisions.
- Sensitive policy actions cannot validate as Automatic.
- Test Workflow simulation makes zero live changes and activation requires a successful simulation flag.
- Activation creates an audit record.

Templates include overdue-customer chasing, late supplier PO, outstanding supplier credit, credit warning, invoice-ready, project margin, engineer van top-up, slow stock and Xero reconciliation exception workflows.

### Floating Smart Assistant
Available globally with:
- Ask
- Find Anything
- Guide Me
- Training

The assistant is deliberately restricted to Pool Shed data. It does not browse the web or use outside factual sources for operational answers.

Answer contract:
- Permission-filter records before retrieval.
- Prefer exact ID / SKU / barcode / supplier SKU matches over descriptive/fuzzy candidates.
- Every factual answer returns Pool Shed provenance/source metadata.
- How-to answers use approved Pool Shed Knowledge.
- Missing evidence produces an actionable knowledge gap instead of a guessed answer.
- Management questions can aggregate existing Pool Shed alerts, overdue POs and authorised finance/analytics information.

### Find Anything coverage
The retrieval layer indexes authorised records across core and operational data including:
- Products, SKUs, barcodes and supplier SKUs
- Customers
- Suppliers
- Sales Orders
- Purchase Orders
- Projects
- Goods Notes
- Locations and stock movements
- Project Purchasing
- Finance records
- Approved Pool Shed Knowledge
- Purchase returns
- Supplier products
- Receipt events / Goods-In
- Warehouse QC
- Putaway transfers
- Stock takes
- Allocation events
- Replenishment/restock rules
- Tool assets, assignments and history
- Sales credits
- Product import batches
- Audit log / admin notifications
- Automation logs
- Supplier bills

Approved aliases can teach Find Anything local staff terminology without silently changing product master data.

### Assistant Settings
`Settings → Assistant & Automation` supports:
- Editable assistant name, default `Azzy`
- PNG avatar upload only
- PNG data URL retained so alpha transparency is preserved
- Remove image
- Live floating-assistant identity propagation
- Approved Knowledge Library
- Approved Aliases & Search Terms
- Locked Pool Shed-only operational answer policy

## Data architecture
- `__POOL_SHED_GET_DATA__` remains the canonical operational data bridge.
- `__POOL_SHED_CAN_ACCESS__` exposes current-user module access for assistant filtering.
- The assistant does not maintain shadow copies of products, customers, orders or financial records.
- Automation state stores rules, simulations/runs, approvals and suggestions only.
- Existing operational actions route back into the authoritative Pool Shed modules.

## Visual authority
- Added `system/52-automation-command.css`.
- The runtime still loads one authoritative `assets/css/app.css` bundle.
- Readability test initially detected 9px micro-copy; it was raised to the approved minimum and the readability suite then passed.

## Verification evidence
Fresh final v1.18.0 suite:
- Smart Assistant retrieval/provenance/item finding/training/knowledge-gap test: PASS
- Automation flow validation/simulation/authority/audit test: PASS
- Automation workspace/Flow Builder/floating assistant test: PASS
- Assistant profile/PNG/knowledge/settings contract test: PASS
- v1.18 release/navigation/version wiring test: PASS
- Analytics release regression: PASS
- Finance release regression: PASS
- Supplier Command release regression: PASS
- Goods Note release regression: PASS
- CSS architecture: PASS
- Readability hardening: PASS
- Production build: PASS
- Public runtime validation: PASS
- Dist runtime validation: PASS
- Release assets: 47 referenced assets present; all public/server/API JavaScript parses.

Protected regression before final packaging also passed Analytics, Finance, Supplier Command, Goods Notes, Inventory, Product Hub, Projects, Purchase Orders, Warehouse FIFO and Sales Order checks.

## Full validator limitation
`npm run validate` passes the application stack through accounting core, then stops when `scripts/test-accounting-database.mjs` imports `@electric-sql/pglite`, which is not installed in this extracted runtime. This is the same environment-only database-test boundary seen in earlier releases.

The remaining non-database tests after that boundary were run separately and passed:
- accounting API
- project engine
- project AI
- bundle system v2
- dashboard review
- dashboard command
- release assets

Database-only tests not executed because of the missing PGlite package:
- `scripts/test-accounting-database.mjs`
- `scripts/test-workspace-database.mjs`
- `scripts/test-project-database.mjs`

## Browser limitation
- `npm run test:browser` was attempted and cannot run because the package does not contain Playwright.
- A direct Chromium headless smoke attempt was also made against a local HTTP server. Chromium stalled in this container with D-Bus/browser-process errors and produced no DOM before timeout.
- Automated browser/pixel acceptance is therefore not claimed.

## Operational boundary
This release provides a deterministic, permission-aware Pool Shed retrieval and guidance engine. It can answer broad questions from indexed Pool Shed data and approved knowledge, but it must not manufacture facts when the required data is absent. Its correct behaviour in that situation is an explicit knowledge gap with the missing evidence and next in-system action.
