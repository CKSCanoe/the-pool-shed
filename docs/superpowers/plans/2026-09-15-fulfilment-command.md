# Fulfilment Command Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the approved Option A Fulfilment Command with fully wired actions and strict Hold/Ship/stock safeguards.

**Architecture:** Add a focused fulfilment control engine for derived state, ship-gate validation and atomic stock deduction, plus a scoped Fulfilment Command workspace that overrides the legacy Fulfilment home while reusing proven Goods Note lifecycle functions. Preserve Sales, Warehouse and Inventory ownership boundaries.

**Tech Stack:** Browser JavaScript, static HTML/CSS, Node regression scripts, existing Pool Shed runtime.

**Spec:** `docs/superpowers/specs/2026-09-15-fulfilment-command-design.md`

## Global Constraints
- Source baseline is v1.12.1 Transfer Guard.
- Release target is v1.13.0.
- No dead buttons.
- Ship is the only outbound physical stock deduction event.
- No partial stock deduction when the full Goods Note cannot ship.
- Preserve existing Sales Order, Warehouse, Inventory, Project and Product Hub authority layers.

---

### Task 1: Fulfilment control engine
**Files:** Create `public/fulfilment-control-engine.js`; Test `scripts/test-fulfilment-command-engine-v113.mjs`.
**Interfaces:** Produces `PoolShedFulfilmentControl` with `status`, `queueStage`, `dispatchType`, `shipGate`, `atomicShip`, `metrics`, `exceptions`, `nextAction`.
- [ ] Write failing engine tests for hold, courier tracking, insufficient stock and atomic multi-row deduction.
- [ ] Run the test and confirm RED because the engine does not exist.
- [ ] Implement the engine and bridge it to existing Goods Note helpers.
- [ ] Run the test and confirm GREEN.

### Task 2: Fulfilment Command workspace
**Files:** Create `public/fulfilment-workspace.js`; Test `scripts/test-fulfilment-command-workspace-v113.mjs`.
**Interfaces:** Overrides `renderFulfilment`, sidebar subgroups and Fulfilment actions while retaining legacy detail/modal helpers.
- [ ] Write failing structural/action coverage tests.
- [ ] Confirm RED.
- [ ] Implement Overview, queues, filters, attention panel and delegated action handlers.
- [ ] Confirm GREEN and ensure every rendered button has a handler or disabled reason.

### Task 3: Operational state guards
**Files:** Modify `public/assets/js/01-legacy-01.js`; Test `scripts/test-fulfilment-command-guards-v113.mjs`.
**Interfaces:** Existing `markGoodsNotePrinted`, `markGoodsNotePicked`, `markGoodsNotePacked`, `shipGoodsNote` honour hold and the new ship gate.
- [ ] Write failing regression tests against the legacy path.
- [ ] Confirm RED.
- [ ] Add minimal bridge checks without duplicating stock logic.
- [ ] Confirm GREEN plus existing fulfilment lifecycle regression.

### Task 4: Visual authority
**Files:** Create `public/assets/css/system/48-fulfilment-command.css`; Modify `scripts/build-css.mjs`; Test `scripts/test-fulfilment-command-visual-v113.mjs`.
- [ ] Write failing CSS ownership/readability test.
- [ ] Confirm RED.
- [ ] Add scoped responsive Command styling.
- [ ] Confirm GREEN plus global CSS architecture tests.

### Task 5: Release wiring and regression
**Files:** Modify `package.json`, `public/index.html`, `public/service-worker.js`, validation/release tests; create release audit.
- [ ] Write failing release-wiring test for v1.13.0 assets/cache.
- [ ] Confirm RED.
- [ ] Wire/version new JS/CSS and update validation chain.
- [ ] Run focused cross-module regressions, production build, full validation to any known PGlite boundary, remaining non-database tests, browser smoke if available, and ZIP integrity.
