# Warehouse Precision Desk Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the approved Warehouse Precision Desk and deterministic FIFO goods-in allocation/reallocation engine without disturbing approved Dashboard, Customer or Sales Order workspaces.

**Architecture:** Keep the v1.7.5 data model and receipt/stock movement engines. Add a focused `warehouse-workspace.js` authority layer that overrides Warehouse rendering and the goods-in allocation behavior, plus a scoped Warehouse CSS module. The legacy functions remain as compatibility fallbacks, but the new warehouse authority owns all selected Warehouse views and allocation decisions.

**Tech Stack:** Vanilla JavaScript, HTML/CSS, existing localStorage/IndexedDB/Supabase sync hooks, Node validation scripts.

**Spec:** `docs/superpowers/specs/2026-09-15-warehouse-precision-desk-design.md`

## Global Constraints

- Preserve v1.7.5 Dashboard, Customer and Sales Order authority.
- Exact SKU only for hard allocation.
- FIFO order is created date, then due date, then Sales Order ID.
- PO sales-order link is traceability/demand source, never allocation priority.
- Receiving and Quarantine are never allocatable.
- Manual reallocation is post-FIFO only, reason-required and fully audited.
- New Warehouse UI must be scoped and must not reintroduce global legacy hover/cascade behavior.
- Release assets and service-worker cache keys must advance together.

---

### Task 1: FIFO allocation regression

**Files:**
- Create: `scripts/test-warehouse-fifo-allocation-v180.mjs`
- Modify: none during RED

**Interfaces:**
- Consumes: existing `data`, `available`, `addMovement`, `addSalesOrderNotification`, `updateSalesOrderStatusAfterAllocation`.
- Produces: required behavior for `warehouseAllocateAcceptedStock(po, line, qty, targetLocation)` and `warehouseReallocateSalesStock(...)`.

- [ ] Write tests for older-order-first allocation, linked-PO non-priority, exact SKU, exclusion states, Receiving/Quarantine exclusion, partial quantity and leftover free stock.
- [ ] Write tests for controlled manual reallocation, required reason, source/destination quantity guards, status recalculation and audit movement.
- [ ] Run the test and verify RED because the new Warehouse allocation APIs do not exist.

### Task 2: Allocation engine

**Files:**
- Create: `public/warehouse-workspace.js`
- Modify: `public/index.html`

**Interfaces:**
- Produces: `warehouseEligibleShortages(productId)`, `warehouseAllocateAcceptedStock(po,line,qty,targetLocation)`, `warehouseReallocateSalesStock(productId,fromOrderId,toOrderId,qty,reason)`, and override `autoAllocateReceivedStock`.

- [ ] Implement deterministic shortage sorting.
- [ ] Implement FIFO allocation across multiple orders, preserving PO-demand-source metadata.
- [ ] Override legacy `autoAllocateReceivedStock` so existing `recordPurchaseReceipt` and putaway flow call the new engine.
- [ ] Implement reason-required controlled reallocation.
- [ ] Re-run FIFO regression and verify GREEN.

### Task 3: Warehouse Precision Desk UI

**Files:**
- Modify: `public/warehouse-workspace.js`
- Create: `public/assets/css/system/35-warehouse-workspace.css`
- Modify: `scripts/build-css.mjs`
- Modify: `scripts/test-css-architecture.mjs`

**Interfaces:**
- Produces: authoritative `renderWarehouse()` for Work Queue, Inbound, Transfers, Returns & Quarantine, Counts and Audit.

- [ ] Write `scripts/test-warehouse-precision-desk-v180.mjs` first and verify RED.
- [ ] Implement the shared Warehouse shell, queue, inspector, tabs and real route/action wiring.
- [ ] Reuse existing receipt, transfer, stock-count and audit actions instead of duplicating stock mutations.
- [ ] Scope styles to `.warehouse-precision-page` and responsive table/inspector layouts.
- [ ] Rebuild CSS and verify Warehouse UI test GREEN.

### Task 4: Release coherence and regression

**Files:**
- Modify: `package.json`
- Modify: `public/index.html`
- Modify: `public/service-worker.js`
- Modify: active release-aware tests where the version is intentionally asserted.
- Regenerate: `CHANGED-FILES.json`, `RELEASE-SHA256.json`

**Interfaces:**
- Produces: Pool Shed v1.8.0 Warehouse Precision Desk release.

- [ ] Advance package/runtime/cache version to 1.8.0.
- [ ] Version `warehouse-workspace.js` and all local runtime assets coherently.
- [ ] Run Warehouse allocation/UI tests, receiving ledger, fulfilment lifecycle, Dashboard/Customer/Sales parity, CSS architecture and runtime validation.
- [ ] Run `npm run build` and release asset validation.
- [ ] Package a clean v1.8.0 ZIP without node_modules/temp files.
