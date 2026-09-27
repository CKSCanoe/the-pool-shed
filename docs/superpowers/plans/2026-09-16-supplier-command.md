# Supplier Command Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the approved Option C Supplier Command with smart credit/payment/delivery flags, Supplier Details tabs, supplier-only products and governed price-list import/export.

**Architecture:** Add a focused supplier-command engine for calculations and guarded mutations, plus a supplier-command workspace that overrides the existing supplier directory/profile UI inside Purchasing. Existing PO, Warehouse, Product Hub and finance records remain authoritative. A dedicated CSS module owns the Supplier Command visual layer.

**Tech Stack:** Vanilla JavaScript, HTML, CSS, existing Pool Shed browser data model, Node regression scripts.

**Spec:** `docs/superpowers/specs/2026-09-16-supplier-command-design.md`

## Global Constraints
- Preserve v1.14.0 Goods Note Control and all protected modules.
- Use **Supplier Details**, never "Supplier 360".
- Annual spend does not appear on Supplier Overview.
- Finance status never mutates stock/fulfilment.
- Price-list imports require preview and explicit commit.
- All Supplier Command buttons need functional handlers or intentional disabled states with reasons.
- Release version becomes 1.15.0.

---

### Task 1: Supplier intelligence engine

**Files:**
- Create: `public/supplier-command-engine.js`
- Test: `scripts/test-supplier-command-engine-v115.mjs`

**Interfaces:**
- Consumes: `window.__POOL_SHED_GET_DATA__`, existing PO/product/supplier/return data and optional `window.psFinanceSnapshot()`.
- Produces: `window.PoolShedSupplierCommand` with supplier metrics, credit position, PO timing, smart flags, product rows and governed price-list preview/commit helpers.

- [ ] Write failing engine tests for projected credit exposure, credit severity, PO early/late timers, short receipt flags, invoice/match/payment flags, supplier-credit flags and supplier-only product filtering.
- [ ] Run the test and verify RED because the engine file/API does not exist.
- [ ] Implement the engine with pure derived calculations and guarded price-list commit.
- [ ] Run the engine test and verify GREEN.

### Task 2: Supplier Command workspace

**Files:**
- Create: `public/supplier-command-workspace.js`
- Test: `scripts/test-supplier-command-workspace-v115.mjs`

**Interfaces:**
- Consumes: `PoolShedSupplierCommand`, legacy `supplierManagementPage`, `supplierProfilePage`, `bindPurchase`, and existing navigation globals.
- Produces: approved Option C directory/detail authority and nine Supplier Details tabs.

- [ ] Write failing structure tests for Option C layout, Overview metrics, nine tabs, smart attention rail and supplier-only product/price-list actions.
- [ ] Verify RED.
- [ ] Implement the command list and Supplier Details views.
- [ ] Verify GREEN.

### Task 3: Interactions and cross-module navigation

**Files:**
- Modify: `public/supplier-command-workspace.js`
- Test: `scripts/test-supplier-command-actions-v115.mjs`

**Interfaces:**
- Produces handlers for supplier selection, tabs, Edit Credit Limit, Open PO, Book In, Record Chase, Update ETA, New PO, Product Details, price-list import/export/template/history, Returns, Invoice Matching and Accounting.

- [ ] Write failing action-coverage tests for every required `data-sc-*` control.
- [ ] Verify RED.
- [ ] Implement handlers and explicit guarded/no-op messaging only where integration is intentionally unavailable.
- [ ] Verify GREEN and confirm no required Supplier Command control is decorative.

### Task 4: Visual authority

**Files:**
- Create: `public/assets/css/system/49-supplier-command.css`
- Modify: `scripts/build-css.mjs`
- Test: `scripts/test-supplier-command-visual-v115.mjs`

**Interfaces:**
- Produces the approved Option C two-column command layout, compact metrics, embedded Supplier Details and attention rail without altering other module selectors.

- [ ] Write RED visual authority test for required selectors and design tokens.
- [ ] Implement CSS module and add it last in the governed CSS source order.
- [ ] Build CSS and verify visual test GREEN.

### Task 5: Release/version wiring

**Files:**
- Modify: `package.json`
- Modify: `public/index.html`
- Modify: `public/service-worker.js`
- Modify: `public/assets/js/01-legacy-01.js` only for service-worker version if required
- Modify: `package.json` validate chain
- Create: `scripts/test-supplier-command-release-v115.mjs`

**Interfaces:**
- Loads `supplier-command-engine.js` before `supplier-command-workspace.js`, after Purchase Workspace and before later unrelated modules.

- [ ] Write RED release test for v1.15.0 asset/cache/version coherence.
- [ ] Wire new assets and service-worker cache.
- [ ] Add supplier tests to validation chain.
- [ ] Verify release test GREEN.

### Task 6: Regression and release evidence

**Files:**
- Create: `SUPPLIER-COMMAND-AUDIT-1.15.0.md`
- Create final release ZIP outside project directory.

**Interfaces:**
- Verifies Supplier Command plus protected Purchasing, Product Hub, Warehouse, Inventory, Fulfilment, Projects, Sales Orders, Accounting core and runtime assets.

- [ ] Run Supplier Command tests and production build.
- [ ] Run protected module regressions.
- [ ] Run complete `npm run validate`; record the exact PGlite boundary if unchanged.
- [ ] Run remaining non-database tests separately if validation stops only at the known missing `@electric-sql/pglite` dependency.
- [ ] Attempt browser smoke test and record its exact result.
- [ ] Create release audit, ZIP, ZIP integrity test and SHA-256.
