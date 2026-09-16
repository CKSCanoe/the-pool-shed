# Pool Shed v1.10.0 Project 360 Commercial Control - Release Audit

## Release

- Version: 1.10.0
- Release name: Project 360 Commercial Control
- Baseline: Pool Shed v1.9.0 Purchase Order Command
- Implementation strategy: isolated release copy; no Git repository was present in the supplied release package

## Project authority model

Projects are now the authoritative operational and commercial job record, while preserving the existing authority boundaries:

- Warehouse remains the physical stock truth.
- Purchasing remains the supplier commitment and Purchase Order truth.
- Sales Orders remain the customer-order truth.
- Accounting/Xero remains the invoice and payment truth.
- Project 360 reconciles those records into one live job view instead of duplicating their ledgers.

## Project home

The Projects module now provides:

- Precision Desk as the primary exception-led project list.
- Stage Board as a secondary lifecycle planning view.
- Derived Project Health rather than a manually selected traffic-light status.
- Search and operational context for customer, site, project, stock, PO and commercial state.

## Project lifecycle

The active lifecycle is:

Planning -> Approved -> Procurement -> Ready for Site -> In Progress -> Commercial Review -> Ready to Invoice -> Completed

Controlled exception states:

- On Hold
- Cancelled

Legacy records are mapped safely, including Pending Parts -> Procurement, Ready To Invoice -> Ready to Invoice and Invoiced -> Completed.

## Project 360 workspace

Every Project has the following authority tabs:

1. Overview
2. Scope & Tasks
3. Materials
4. Procurement
5. Stock & Job Bin
6. Engineer Requests
7. Tools
8. Costing & Margin
9. Billing & Variations
10. Site Notes & Files
11. Activity
12. Settings

A permanent commercial bar remains visible across the workspace.

## Commercial control

Project 360 now continuously reconciles:

- quoted / contract value
- approved variations
- forecast final cost
- projected profit
- projected margin
- invoiced / queued value
- remaining value to invoice

Core formulas:

- Forecast Revenue = accepted quote + approved variations
- Forecast Final Cost = actual cost + received PO estimate not replaced by bills + remaining commitments + remaining forecast + tools/hire
- Projected Profit = Forecast Revenue - Forecast Final Cost
- Projected Margin = Projected Profit / Forecast Revenue

Project settings support:

- target margin
- minimum margin
- loss-warning margin
- invoice exposure percentage threshold
- invoice exposure net threshold

Alerts explain the commercial cause rather than only changing a colour. Examples include projected margin below minimum, material forecast above budget and invoice review recommended because cost exposure has moved ahead of billing.

## Material planning and stock control

The Project material plan is a planning/budget layer only. It is deliberately not added to the financial forecast as another committed cost, preventing double counting when the same material is represented by real Purchase Orders or actual costs.

Project material visibility includes:

- Planned
- Allocated
- Inbound
- Ordered
- Received
- Job Bin
- Used
- Return Pending
- Damaged / Lost
- Budget cost
- Forecast material cost
- Variance

Stock state is derived from the existing stock, allocation, Purchase Order and movement records.

Project stock controls use the shared stock engine:

- Project Use removes only free physical stock from the Project Job Bin and creates a Project Use movement.
- Damage / Loss removes only free physical stock and creates a Project Damage / Loss movement.
- Existing allocated stock cannot be silently consumed by these actions.
- Transfers and returns remain Warehouse-owned workflows.

## Procurement integration

Project Procurement shows live linked Purchase Orders and supplier quantities. Purchase Order costs and inbound quantities remain owned by Purchasing, with direct navigation into the approved Purchase Order Command.

This avoids a second Project-specific purchasing ledger.

## Engineer Requests and tools

Project 360 retains and surfaces linked Engineer Requests and tool/hire records. Open requests and outstanding tools contribute to Project Health and close-out blocking.

## Billing, variations and invoice exposure

Existing billing stages and accounting workflows are retained.

Project 360 adds advisory invoice-exposure monitoring based on actual/committed cost versus invoiced/queued value. Alerts recommend invoice review but do not create invoices automatically.

Variations remain explicit commercial records. Proposed or unresolved variations are visible in Project 360 and can block Project close-out until reviewed.

## Close-out gate

A Project cannot move cleanly to completion while material or commercial obligations remain unresolved. Close-out checks include:

- stock remaining in the Project Job Bin
- open supplier PO quantities
- open Engineer Requests
- outstanding tools/hire
- unresolved proposed variations
- open Project tasks where applicable
- incomplete billing
- critical projected-margin position without a recent commercial review

## Visual authority

A dedicated late Project authority stylesheet, `45-project-360-command.css`, owns the Project 360 visual layer after the existing Purchase Order authority stylesheet.

Visual safeguards include:

- no decorative gradients
- readable text sizes
- contained wide tables
- commercial bar responsive compression
- Project stage rail responsive behaviour
- desktop, compressed desktop and tablet layout guards
- no reliance on generic legacy Project presentation rules for the new workspace

## Release/cache integrity

- package version: 1.10.0
- local runtime assets: `?v=1.10.0`
- service-worker cache: `pool-shed-v1.10.0-project-360-commercial-control`
- service-worker registration retains `updateViaCache: "none"`
- production CSS bundle contains 18 maintained modules

## Verification evidence

A fresh `npm run build` completed successfully on the final release state:

- app.css built from 18 maintained CSS modules
- runtime validation passed
- deployable `dist/` generated successfully

A fresh `npm run validate` passed all tests up to the database-only stage, including:

- Project 360 engine
- Project 360 workspace
- Project 360 visual guard
- Project close-out gate
- Purchase Order Command
- easy Warehouse booking-in
- supplier returns
- Purchase Order visual guard
- Warehouse FIFO allocation and controlled reallocation
- Warehouse Precision Desk and visual guard
- UI ownership / release coherence
- Sales Order compact authority and finder
- runtime validation
- CSS architecture
- visual consistency
- contrast and readability
- catalogue and bundle workflows
- fulfilment lifecycle
- PO catalogue/picker performance
- production overhaul checks
- Sales Order list/detail/assets/customer picker
- receiving ledger
- professional workspace and sync
- ledger performance
- accounting core

The command then stopped at `scripts/test-accounting-database.mjs` because the extracted project does not include the development-only dependency `@electric-sql/pglite`.

The remaining non-database tests after that breakpoint were then run separately on the same final code state and all passed:

- `scripts/test-accounting-api.mjs`
- `scripts/test-project-engine.mjs`
- `scripts/test-project-ai.mjs`
- `scripts/test-bundle-system-v2.mjs`
- `scripts/test-dashboard-review.mjs`
- `scripts/test-dashboard-command.mjs`
- `scripts/test-release-assets.mjs`

`test-release-assets.mjs` confirmed all 32 referenced assets exist and all public/server/API JavaScript parses.

## Verification limitation

The following database-only regression scripts could not be executed because `@electric-sql/pglite` is not present in the extracted release environment:

- `scripts/test-accounting-database.mjs`
- `scripts/test-workspace-database.mjs`
- `scripts/test-project-database.mjs`

This release must therefore not be described as having a completely green full validation suite in this environment.

A normal browser acceptance pass has also not been claimed. Previous attempts in this environment were blocked for local/file URLs by administrator Chromium policy and Playwright was unavailable. Deployment acceptance should therefore include one real browser pass of Projects, especially Precision Desk, Stage Board, Project 360 tabs, commercial bar, Materials, Job Bin stock actions, Procurement links, Costing, Billing and responsive widths.

## Result

Pool Shed v1.10.0 makes Projects a live job-control and commercial early-warning system while preserving the stock, purchasing, sales and accounting authority models already implemented in previous releases.
