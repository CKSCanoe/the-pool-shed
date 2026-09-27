# Purchase Order Supplier Command Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a supplier-side Purchase Order Command matching the approved Sales Order interaction model, with one-confirmation warehouse booking-in, supplier returns/credits, and strict FIFO stock allocation after QC acceptance.

**Architecture:** Add a late Purchase Order authority layer that reuses existing products, suppliers, POs, receipt ledger, Warehouse Precision Desk and offline save/sync data rather than replacing legacy engines. Purchasing owns supplier/commercial intent and Warehouse owns physical stock receipt/QC/putaway. Batch booking-in orchestrates the existing receipt and putaway primitives so accepted stock reaches FIFO automatically without manual Sales Order selection.

**Tech Stack:** Vanilla HTML/CSS/JavaScript, existing Pool Shed legacy runtime, Supabase-ready workspace, localStorage/IndexedDB/offline sync, Node regression scripts.

**Spec:** `POOL-SHED-OVERHAUL-PROCESS-SPEC-v1.md` plus approved `po-supplier-order-command-final.html` reference.

## Global Constraints

- Preserve approved Dashboard, Customer, Sales Order and Warehouse C visual authority.
- Exact-SKU allocation only; oldest eligible Sales Order first.
- PO/Sales Order links record demand origin and must not override FIFO physical allocation.
- Physical receipt, QC and putaway remain Warehouse-owned.
- Receiving and Quarantine stock are not allocatable.
- Manual reallocation remains post-FIFO, reason-required and audited.
- Supplier returns must preserve stock and accounting traceability.

---

### Task 1: Purchase Order Supplier Command authority

**Files:**
- Create: `public/purchase-workspace.js`
- Create: `scripts/test-purchase-order-command-v190.mjs`
- Modify: `public/index.html`

**Interfaces:**
- Consumes: existing `data.purchaseOrders`, `purchaseOrderById`, `product`, `supplierProfile`, `poSummary`, `saveAppData`, `render`, `bindPurchase`.
- Produces: `purchaseOrderDetailPage`, `purchaseOrderListPage`, `purchaseOrderHealth`, `purchaseDemandSources`, and PO tab/action bindings.

- [ ] Write failing regression for Supplier Order Command structure and tab contract.
- [ ] Run regression and confirm failure because authority layer is missing.
- [ ] Implement command header, supplier/details/inbound cards, seven PO tabs and supplier-led product lines.
- [ ] Run regression and legacy PO picker/performance tests.

### Task 2: One-confirmation booking-in

**Files:**
- Modify: `public/warehouse-workspace.js`
- Create: `scripts/test-warehouse-booking-v190.mjs`

**Interfaces:**
- Consumes: `warehouseReceiveLineToStaging`, `warehousePutawayReceipt`, `warehouseRecordPoException`, `warehouseEligibleShortages`.
- Produces: `warehouseBookDelivery(poId, receiptRows, supplierReference, note)` and guided book-in UI.

- [ ] Write failing behavior test for accepted, damaged and shortage lines.
- [ ] Run regression and confirm failure because batch book-in is missing.
- [ ] Implement single-confirmation receipt orchestration with accepted → recommended putaway/FIFO, damaged → quarantine, shortage → outstanding exception.
- [ ] Add guided delivery table with quantity and QC decision per PO line plus one `Confirm booking-in` action.
- [ ] Run FIFO, booking, receiving and fulfilment regressions.

### Task 3: Supplier Returns & Credits

**Files:**
- Modify: `public/purchase-workspace.js`
- Create: `scripts/test-purchase-returns-v190.mjs`

**Interfaces:**
- Consumes: PO/receipt/product/location data, `addStock`, `removeStock`, `addMovement`, `saveAppData`.
- Produces: `purchaseCreateSupplierReturn`, `purchaseReturnStatusSummary`, Returns & Credits tab.

- [ ] Write failing behavior test for mis-order return moving free stock to Returns Hold without reducing On Hand total.
- [ ] Implement returns-hold location, return record lifecycle and source PO/receipt/cost linkage.
- [ ] Implement Returns & Credits tab and creation drawer/form.
- [ ] Run return regression and stock movement checks.

### Task 4: Purchase Order styling and visual guard

**Files:**
- Create: `public/assets/css/system/44-purchase-order-command.css`
- Modify: `scripts/build-css.mjs`
- Modify: `scripts/test-css-architecture.mjs`
- Create: `scripts/test-purchase-order-visual-guard-v190.mjs`

**Interfaces:**
- Consumes: global Precision Operations tokens/components.
- Produces: scoped `.purchase-command-page` authority styles and responsive table/card guards.

- [ ] Write failing visual ownership regression.
- [ ] Add scoped command/detail/line/return/booking styles.
- [ ] Add responsive and overflow guards.
- [ ] Rebuild CSS and run visual architecture tests.

### Task 5: Release coherence and regression verification

**Files:**
- Modify: `package.json`
- Modify: `public/index.html`
- Modify: `public/service-worker.js`
- Modify: active release-aware regression scripts only where hardcoded 1.8.0 prevents a valid 1.9.0 release.
- Create: `PURCHASE-ORDER-COMMAND-AUDIT-1.9.0.md`

**Interfaces:**
- Produces: coherent v1.9.0 runtime/cache/build package.

- [ ] Advance version/cache/query strings to 1.9.0.
- [ ] Run focused PO/Warehouse/Sales/Customer/Dashboard regressions.
- [ ] Run `npm run build`.
- [ ] Run `npm run validate` and record any environment-only database blocker exactly.
- [ ] Package `Pool-Shed-1.9.0-Purchase-Order-Command.zip`.
