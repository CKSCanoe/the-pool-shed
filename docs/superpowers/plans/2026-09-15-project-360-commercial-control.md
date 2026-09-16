# Project 360 Commercial Control Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Project 360 as a live project stock, margin-risk and invoice-exposure command system on top of the existing Pool Shed stock, purchasing and accounting engines.

**Architecture:** Extend `project-engine.js` with project planning and derived commercial/stock summaries, while keeping Warehouse, Purchasing, Sales and Accounting as source-of-truth systems. Rebuild `project-workspace.js` into Precision Desk + Project 360 and add a late scoped CSS authority module so legacy project styling cannot override it.

**Tech Stack:** Vanilla JavaScript, existing Pool Shed local/offline data model, generated modular CSS, Node regression scripts, service-worker/PWA release pipeline.

**Spec:** `docs/superpowers/specs/2026-09-15-project-360-commercial-control-design.md`

## Global Constraints
- Base release: Pool Shed v1.9.0 Purchase Order Command.
- Target release: v1.10.0 Project 360 Commercial Control.
- Warehouse remains physical stock truth and FIFO allocation must not change.
- Purchasing remains supplier commitment truth.
- Accounting/Xero remains invoice/payment truth.
- Project planning must not create a parallel stock ledger.
- Existing approved Dashboard, Customer, Sales Order, Purchase Order and Warehouse visual authority must remain unchanged.
- All new physical Project stock mutations must use shared stock and movement functions.
- No invoice is created automatically from a project alert.

---

### Task 1: Project commercial and stock summary engine

**Files:**
- Modify: `public/project-engine.js`
- Create: `scripts/test-project-360-engine-v110.mjs`

**Interfaces:**
- Consumes: existing `data.jobs`, `data.stock`, `data.allocations`, `data.purchaseOrders`, `data.engineerRequests`, `data.salesOrders`, `data.movements`, `data.toolAssignments`.
- Produces: extended `psProjectModel(job)`, `psProjectSummary(job, source, now)`, `psProjectStockSummary(job, source)`, `psProjectHealth(job, summary)`, and new `psProjectTransaction` actions `material-plan`, `remove-material-plan`, `stock-use`, `stock-damage`.

- [ ] Write failing regression assertions for minimum-margin risk, material-plan variance, live Job Bin stock, inbound PO quantity, Project Use movements and invoice-exposure recommendations.
- [ ] Run `node scripts/test-project-360-engine-v110.mjs` and confirm failure because the new model/summary APIs are absent.
- [ ] Extend project defaults with `minimumMargin`, `invoiceExposureThresholdPct`, `invoiceExposureThresholdNet`, `materialPlan`, and `stockEvents` compatibility fields.
- [ ] Implement stock/project derivation from shared records and commercial risk outputs without changing Warehouse FIFO logic.
- [ ] Implement project stock-use/damage actions through existing `removeStock`/`addMovement` functions with free-stock validation.
- [ ] Run `node scripts/test-project-360-engine-v110.mjs` and existing `node scripts/test-project-engine.mjs`; both must pass.

### Task 2: Precision Desk and Project 360 workspace

**Files:**
- Modify: `public/project-workspace.js`
- Create: `scripts/test-project-360-workspace-v110.mjs`

**Interfaces:**
- Consumes: Task 1 summary/health/stock APIs and existing project billing/document/tool functions.
- Produces: Projects Precision Desk, Stage Board, Project 360 detail tabs and commercial bar.

- [ ] Write a failing structural test asserting the Project home views, full 12-tab Project 360 navigation, permanent commercial metrics, margin-risk explanations, stock tables and invoice-threshold controls.
- [ ] Run the test and verify it fails against the v1.9.0 workspace.
- [ ] Rebuild the workspace markup while preserving existing form actions, billing review, document sync, report download and linked-record navigation.
- [ ] Add project material-plan controls and Project stock use/damage forms tied to Task 1 transactions.
- [ ] Add explicit PO/Sales Order/Warehouse navigation without duplicating those workspaces.
- [ ] Run the new workspace test and existing project billing/AI/engine tests.

### Task 3: Project 360 scoped visual authority

**Files:**
- Create: `public/assets/css/system/45-project-360-command.css`
- Modify: `scripts/build-css.mjs`
- Modify: `scripts/test-css-architecture.mjs`
- Modify: `scripts/test-visual-consistency.mjs`
- Create: `scripts/test-project-360-visual-guard-v110.mjs`

**Interfaces:**
- Consumes: Project 360 class names from Task 2.
- Produces: responsive Precision Desk, stage rail, commercial bar, Project 360 work grid and scoped warning states.

- [ ] Write failing visual guard assertions for scoped `.project-360-*` authority, responsive breakpoints, internal table scrolling and minimum readable typography.
- [ ] Run the guard and confirm failure because module 45 does not exist.
- [ ] Add the scoped stylesheet after Purchase Order module 44 in generated CSS order.
- [ ] Build CSS and run CSS architecture, contrast/readability and Project 360 visual guard tests.

### Task 4: Project closure and invoice-exposure controls

**Files:**
- Modify: `public/project-workspace.js`
- Modify: `public/project-engine.js`
- Create: `scripts/test-project-closeout-v110.mjs`

**Interfaces:**
- Consumes: Task 1 Project health/stock summary plus existing project save wrapper and finance snapshot.
- Produces: `psProjectCloseoutBlockers(job, source, finance)` and enforced close-out messages.

- [ ] Write failing tests for stock remaining in Job Bin, open PO quantity, open Engineer Request, outstanding tool, proposed variation and incomplete billing stage blockers.
- [ ] Run the closeout test and verify failure.
- [ ] Implement closeout blocker derivation and use it in the existing `saveJobFromForm` wrapper before Completed/Invoiced status changes.
- [ ] Run closeout and existing project/tool/accounting-core tests.

### Task 5: Release hardening and v1.10.0 packaging

**Files:**
- Modify: `package.json`
- Modify: `public/index.html`
- Modify: `public/service-worker.js`
- Modify: `package.json` validation command
- Modify: `README.md`
- Create: `PROJECT-360-RELEASE-AUDIT-1.10.0.md`

**Interfaces:**
- Consumes: Tasks 1-4.
- Produces: coherent v1.10.0 PWA release ZIP.

- [ ] Add Project 360 regressions before existing application regressions in `npm run validate`.
- [ ] Advance all local runtime query strings and service-worker cache namespace to `1.10.0` without changing approved feature code.
- [ ] Run `npm run build`.
- [ ] Run Project 360 focused tests, Warehouse FIFO/booking tests, Purchase Order tests, Sales Order parity tests, Customer and Dashboard tests.
- [ ] Run `npm run validate`; if the known PGlite development dependency remains unavailable, record the exact database-only tests that cannot execute and run every remaining non-database regression separately.
- [ ] Write the release audit with evidence and known environment limitations.
- [ ] Package as `Pool-Shed-1.10.0-Project-360-Commercial-Control.zip`.
