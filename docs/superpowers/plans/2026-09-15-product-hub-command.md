# Product Hub Command Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver Product Hub Command, user-friendly catalogue/Product 360, existing-SKU groups/bundles, and supplier-aware replenishment with reviewed Draft PO creation.

**Architecture:** Add a focused `product-hub-engine.js` for product search, bundle and replenishment calculations, plus `product-hub-workspace.js` as the late Product Hub UI authority. Preserve legacy data and use Inventory, Purchasing, Sales and Project records as read-only inputs. Add one scoped CSS authority module after Project 360.

**Tech Stack:** Static HTML/CSS/JavaScript, current Pool Shed data store/offline save queue, Node regression scripts.

**Spec:** `docs/superpowers/specs/2026-09-15-product-hub-command-design.md`

## Global Constraints
- Start from Pool Shed v1.10.0 Project 360 master copy.
- No nested bundles.
- No fake bundle stock.
- No automatic supplier order transmission.
- Replenishment uses real Inventory availability and real open PO inbound.
- Existing approved Dashboard, Customer, Sales Order, Warehouse, Purchase Order and Project 360 presentation layers must not be restyled.
- New runtime assets use v1.11.0 query strings and one matching service-worker cache namespace.

---

### Task 1: Product Hub engine
**Files:** Create `public/product-hub-engine.js`; Test `scripts/test-product-hub-engine-v111.mjs`.
- [ ] Write failing tests for universal product search, supplier commercial normalisation, bundle buildability/cost, nested-bundle rejection, projected availability and MOQ/order-multiple rounding.
- [ ] Run test and verify RED because engine does not exist.
- [ ] Implement the minimal engine APIs under `globalThis.PoolShedProductHub`.
- [ ] Run test and verify GREEN.

### Task 2: Replenishment and Draft PO creation
**Files:** Modify `public/product-hub-engine.js`; Test `scripts/test-product-hub-replenishment-v111.mjs`.
- [ ] Write failing tests for open-PO inbound, uncovered SO demand, reorder trigger, target-stock suggestion, MOQ/multiple rounding and supplier-grouped Draft PO creation/merge.
- [ ] Verify RED.
- [ ] Implement replenishment rows, supplier grouping and `createDraftPurchaseOrders` with Draft - Review only.
- [ ] Verify GREEN.

### Task 3: Product Hub command/catalogue/Product 360 UI
**Files:** Create `public/product-hub-workspace.js`; Test `scripts/test-product-hub-command-v111.mjs`.
- [ ] Write failing structural test for Product Command, Catalogue, Replenishment, Product Groups, Bundle Studio, Imports, Catalogue Health, quick-view presets, stacked stock/supplier/commercial columns, Stock Rules and Product 360 tabs.
- [ ] Verify RED.
- [ ] Implement late Product Hub render authority and event binding, reusing existing edit/import/bundle functions where safe.
- [ ] Verify GREEN.

### Task 4: Bundle Studio existing-SKU guardrails
**Files:** Modify `public/product-hub-workspace.js` and/or `public/product-hub-engine.js`; Test `scripts/test-product-hub-bundles-v111.mjs`.
- [ ] Write failing test requiring bundles to reference existing product IDs, reject bundle components that are themselves bundles, calculate buildable quantity from live Available stock and preserve component supplier SKUs.
- [ ] Verify RED.
- [ ] Implement/bridge Bundle Studio actions to the new Product Hub engine.
- [ ] Verify GREEN plus existing bundle tests.

### Task 5: Scoped visual authority
**Files:** Create `public/assets/css/system/46-product-hub-command.css`; Modify `scripts/build-css.mjs`, `scripts/test-css-architecture.mjs`; Test `scripts/test-product-hub-visual-guard-v111.mjs`.
- [ ] Write failing visual ownership/readability/overflow test.
- [ ] Verify RED.
- [ ] Add scoped Product Hub CSS after Project 360 and update CSS build/test module lists.
- [ ] Verify GREEN plus global CSS/readability/contrast regressions.

### Task 6: Runtime/version integration
**Files:** Modify `public/index.html`, `public/service-worker.js`, `package.json`, `scripts/validate-runtime.mjs`, release-aware tests as required.
- [ ] Write/update release coherence assertions for v1.11.0 and both new Product Hub runtime assets.
- [ ] Version local assets and cache coherently.
- [ ] Add Product Hub tests at the beginning of `npm run validate`.
- [ ] Run focused cross-module regression suite.

### Task 7: Verification and release
**Files:** Create `PRODUCT-HUB-RELEASE-AUDIT-1.11.0.md` and final ZIP.
- [ ] Run `npm run build`.
- [ ] Run `npm run validate`; record the known PGlite-only environment boundary if unchanged.
- [ ] Run remaining non-database tests after any PGlite stop.
- [ ] ZIP-test the exact final package and record version/cache/assets/test evidence.
