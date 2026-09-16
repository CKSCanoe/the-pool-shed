# Analytics Command Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Analytics Command and Reports & Data Export as Pool Shed v1.17.0 using canonical operational data and governed metrics.

**Architecture:** Add a pure Analytics Command engine for metric definitions, filters, attention rules, dataset extraction and report/export preparation. Add a dedicated Analytics workspace that replaces the legacy analytics screen while routing drill-down actions back to the existing operational modules. Persist saved reports and export audit in `data.analyticsCommand`.

**Tech Stack:** Vanilla browser JavaScript, existing Pool Shed workspace snapshot, Node.js test/build scripts, generated central CSS.

**Spec:** `docs/superpowers/specs/2026-09-16-analytics-command-design.md`

## Global Constraints
- Canonical module records remain the source of truth.
- No invented metrics when source data is insufficient.
- Full-system export is Admin-only and audited.
- All visible Analytics Command actions must work.
- One authoritative generated app stylesheet.
- No em dashes in user-facing copy.

---

### Task 1: Analytics calculation and metric engine
**Files:** Create `public/analytics-command-engine.js`; Test `scripts/test-analytics-command-engine-v117.mjs`.
**Interfaces:** Produces `PoolShedAnalyticsCommand` with `snapshot`, `metric`, `metricLibrary`, `managementAttention`, `periodBounds`, `projectRows`, `supplierRows`, `inventoryRows` and `dataQuality`.
- [ ] Write failing tests for governed revenue/margin, overdue debt, stock value, supplier delivery, project risk and unavailable quote conversion.
- [ ] Verify RED because the engine does not exist.
- [ ] Implement the minimum calculations from canonical records and existing module engines.
- [ ] Verify GREEN.

### Task 2: Dataset catalogue and report/export engine
**Files:** Extend `public/analytics-command-engine.js`; Test `scripts/test-analytics-command-reporting-v117.mjs`.
**Interfaces:** Adds `datasetCatalog`, `datasetRows`, `buildReport`, `toCsv`, `toExcelXml`, `fullSystemPackage`, `recordExport`.
- [ ] Write failing tests for all 20 required datasets, stable-key joins, field selection, filters, CSV escaping, Excel-compatible output, full-system package and export audit.
- [ ] Verify RED.
- [ ] Implement canonical extractors without screen scraping.
- [ ] Verify GREEN.

### Task 3: Analytics Command workspace
**Files:** Create `public/analytics-command-workspace.js`, `public/assets/css/system/51-analytics-command.css`; Test `scripts/test-analytics-command-workspace-v117.mjs`, `scripts/test-analytics-command-actions-v117.mjs`, `scripts/test-analytics-command-visual-v117.mjs`.
**Interfaces:** Owns `#screen-analytics`; uses `activeSubPage.analytics`; consumes engine API.
- [ ] Write failing tests for all Analytics pages, management attention, metric library and reporting tabs.
- [ ] Verify RED.
- [ ] Implement approved design with working filters, modal/report controls and exports.
- [ ] Verify GREEN.

### Task 4: Cross-module routing and permission bridge
**Files:** Modify `public/assets/js/01-legacy-01.js`, `public/analytics-command-workspace.js`; Test `scripts/test-analytics-command-routing-v117.mjs`.
**Interfaces:** Expose safe current-user/admin bridge; drill-downs set existing module state and call render; exports enforce permissions.
- [ ] Write failing tests for drill-down routes and Admin-only full export.
- [ ] Verify RED.
- [ ] Implement minimal bridge and direct routes without duplicate state.
- [ ] Verify GREEN.

### Task 5: Release wiring
**Files:** Modify `public/index.html`, `public/service-worker.js`, `scripts/build-css.mjs`, `package.json`; Test `scripts/test-analytics-command-release-v117.mjs`.
- [ ] Write failing v1.17.0 release test.
- [ ] Verify RED.
- [ ] Load engine before workspace, compile CSS, roll cache/version and update validate chain.
- [ ] Verify GREEN and runtime parsing.

### Task 6: Protected regression, build and packaging
**Files:** Create `ANALYTICS-COMMAND-AUDIT-1.17.0.md`.
- [ ] Run Analytics tests and protected module regressions.
- [ ] Run full validate to any known database-only dependency boundary and run remaining non-database tests separately if required.
- [ ] Run production build, runtime asset audit and browser smoke attempt.
- [ ] Package `Pool-Shed-1.17.0-Analytics-Command.zip`, verify archive integrity and calculate SHA-256.
