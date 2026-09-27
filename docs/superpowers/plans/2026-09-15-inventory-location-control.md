# Inventory Location Control Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Option C Inventory Location Control with connected engineer van stock intelligence, transfers, counts, alerts and cross-module navigation on the v1.11.0 Product Hub master.

**Architecture:** Add a focused Inventory engine that derives summaries/alerts from the existing `data.stock`, `data.locations`, `data.restockRules`, `data.movements`, Projects, Project Purchasing and open POs. Add an Inventory workspace that overrides the legacy Inventory renderer but delegates physical mutations to existing stock transfer/count functions. Preserve Warehouse/Purchasing/Product Hub authority boundaries.

**Tech Stack:** Vanilla JavaScript, generated modular CSS, existing Pool Shed local/offline data model and test scripts.

**Spec:** `docs/superpowers/specs/2026-09-15-inventory-location-control-design.md`

## Global Constraints
- Release version is 1.12.0.
- No duplicate stock ledger.
- Inventory internal top-ups never create supplier POs.
- Product Hub remains supplier replenishment authority.
- Warehouse remains Receive/QC/Putaway authority.
- Use Product Details in user-facing Product Hub copy.
- Every transfer/adjustment remains auditable.

---

### Task 1: Inventory intelligence engine
**Files:** Create `public/inventory-control-engine.js`; Test `scripts/test-inventory-control-engine-v112.mjs`.
**Interfaces:** Produce `PoolShedInventoryControl.locationSummary(id)`, `locationRows(id)`, `vanReadiness(id)`, `alerts()`, `smartThresholdSuggestions(id)`, `projectDemandForLocation(id)` and `createTopUpTransfer(locationId, productId, qty)`.
- [ ] Write failing engine tests for location balances, min/target/max, warehouse-coverable top-up, project demand and advisory smart Min.
- [ ] Run the test and verify missing engine failure.
- [ ] Implement derivation functions using existing data records and delegate transfers to `moveStockBetweenLocations` when available.
- [ ] Run the test and verify pass.

### Task 2: Location Control workspace
**Files:** Create `public/inventory-workspace.js`; Test `scripts/test-inventory-location-control-v112.mjs`.
**Interfaces:** Override `renderInventory()`/Inventory sidebar sections, render Overview, Stock, Locations, Engineer Vans, Project Stock, Transfers & Top-Ups, Cycle Counts, Missing / Damaged, Stock Movements, Exceptions & Alerts.
- [ ] Write failing structure/interaction test for Option C location table, van KPIs, actionable alerts and cross-module links.
- [ ] Verify RED.
- [ ] Implement workspace using `PoolShedInventoryControl` plus existing stock/count/transfer functions.
- [ ] Verify GREEN.

### Task 3: Engineer stock profiles and reminders
**Files:** Modify `public/inventory-control-engine.js`, `public/inventory-workspace.js`; Test `scripts/test-inventory-engineer-stock-v112.mjs`.
**Interfaces:** Store profile metadata on locations, keep location thresholds in `data.restockRules`, create reminder notifications in existing `data.notifications` without mutating thresholds automatically.
- [ ] Write failing tests for below-Min alert, over-Max return suggestion, count due reminder, repeated variance insight and profile preview.
- [ ] Verify RED.
- [ ] Implement minimal profile/reminder logic and threshold review action.
- [ ] Verify GREEN.

### Task 4: Product Details terminology and cross-module navigation
**Files:** Modify `public/product-hub-workspace.js`, `public/inventory-workspace.js`; Test `scripts/test-inventory-connections-v112.mjs`.
**Interfaces:** Product links set Product Hub to profile/Product Details; Project links set Jobs/Projects selection; Warehouse/Purchasing/Replenishment navigation use existing sidebar state/actions.
- [ ] Write failing test asserting no user-visible Product 360 in Product Hub and required Inventory destination links.
- [ ] Verify RED.
- [ ] Implement copy/navigation updates.
- [ ] Verify GREEN.

### Task 5: Visual authority
**Files:** Create `public/assets/css/system/47-inventory-location-control.css`; Modify `scripts/build-css.mjs`; Test `scripts/test-inventory-visual-guard-v112.mjs` and `scripts/test-css-architecture.mjs`.
**Interfaces:** `.inventory-control-v112` is the scoped authority root.
- [ ] Write failing CSS tests for module inclusion, scoped selectors, readable table sizing, responsive guards and prohibited legacy hover leakage.
- [ ] Verify RED.
- [ ] Implement scoped CSS and add module to build order.
- [ ] Verify GREEN and rebuild CSS.

### Task 6: Release wiring and regression
**Files:** Modify `public/index.html`, `public/service-worker.js`, `package.json`, `scripts/test-release-assets.mjs`; create `INVENTORY-LOCATION-CONTROL-AUDIT-1.12.0.md`.
**Interfaces:** Load engine before workspace, version all local assets `?v=1.12.0`, cache namespace `pool-shed-v1.12.0-inventory-location-control`.
- [ ] Write/update release wiring tests first and verify they fail against 1.11.0 references.
- [ ] Wire new assets/version/cache and update validate ordering.
- [ ] Run new Inventory tests plus protected Product Hub/Project/Warehouse/PO/Sales/Dashboard/CSS tests.
- [ ] Run `npm run build`.
- [ ] Run full `npm run validate`; if PGlite is unavailable, record exact database-only boundary and run remaining non-database tests separately.
- [ ] Package exact verified tree as `Pool-Shed-1.12.0-Inventory-Location-Control.zip` and test ZIP integrity.
