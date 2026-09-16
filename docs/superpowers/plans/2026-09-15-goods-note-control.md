# Goods Note Control Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add consolidated pick runs, parcel Goods Note printing, detailed dispatch capture, irreversible Ship locking and return/credit handoff to Fulfilment Command.

**Architecture:** Extend `fulfilment-control-engine.js` with pure/control functions and keep stock mutation in its existing atomic Ship path. Extend `fulfilment-workspace.js` for print/modal/actions. Preserve legacy Goods Note/Sales Credit engines and use their data records rather than creating parallel stock or return ledgers.

**Tech Stack:** Vanilla JavaScript, existing Pool Shed data store, generated CSS modules, Node regression scripts.

**Spec:** `docs/superpowers/specs/2026-09-15-goods-note-control-design.md`

## Global Constraints
- No Unship action.
- Shipped Goods Notes are immutable except read-only/reprint metadata.
- Returns never restock automatically at credit creation.
- Pick Runs only include fully allocated Goods Notes.
- Ship remains atomic and stock cannot go negative.
- User-facing terminology uses Goods Note and Product Details.

---

### Task 1: Goods Note engine controls
**Files:** Modify `public/fulfilment-control-engine.js`; create `scripts/test-goods-note-control-engine-v114.mjs`.
- [ ] Write failing tests for full-allocation eligibility, consolidated Pick Run, dispatch modes, shipment immutability and Sales Credit creation with no stock receipt.
- [ ] Run test and verify RED.
- [ ] Implement engine APIs: `isFullyAllocated`, `pickRun`, `savePackDetails`, `isShipmentLocked`, `createReturnCredit`.
- [ ] Run test and verify GREEN.

### Task 2: Fulfilment workspace and print actions
**Files:** Modify `public/fulfilment-workspace.js`; create `scripts/test-goods-note-control-workspace-v114.mjs`.
- [ ] Write failing structure/action test for Print Pick Run, Print Parcel Goods Note(s), Pack & Dispatch and Return / Credit.
- [ ] Verify RED.
- [ ] Implement print documents, pack modal and actions.
- [ ] Verify GREEN.

### Task 3: Irreversible legacy guards
**Files:** Modify `public/assets/js/01-legacy-01.js`; create `scripts/test-goods-note-ship-lock-v114.mjs`.
- [ ] Write failing regression proving shipped note mutation paths remain blocked and no Unship UI is present.
- [ ] Verify RED.
- [ ] Harden print/pick/pack handlers and legacy copy around shipped lock while preserving reprint.
- [ ] Verify GREEN.

### Task 4: Visual and release wiring
**Files:** Modify `public/assets/css/system/48-fulfilment-command.css`, `package.json`, `public/index.html`, `public/service-worker.js`, release tests.
- [ ] Write release/visual tests for v1.14.0 assets and controls.
- [ ] Verify RED.
- [ ] Add scoped UI styles and advance coherent runtime/service-worker version.
- [ ] Build CSS and verify tests.

### Task 5: Regression and package
- [ ] Run Fulfilment and protected cross-module regressions.
- [ ] Run `npm run build`.
- [ ] Run full `npm run validate`; record PGlite-only boundary if present.
- [ ] Run remaining non-database checks if full validation stops at PGlite.
- [ ] Attempt browser smoke and report actual availability.
- [ ] Write release audit, package ZIP, run `unzip -t` and SHA-256.
