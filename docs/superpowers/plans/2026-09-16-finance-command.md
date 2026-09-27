# Finance Command Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement approved Option C Finance Command as Pool Shed's operational accounting control centre while retaining Xero as the ledger.

**Architecture:** Add a pure Finance Command engine for derived AR/AP, allocations, credit exposure and exceptions, plus a dedicated Finance Command workspace that owns the Accounting screen. Extend the existing server-backed Xero integration only where the UI needs richer linked document state and safe reconciliation actions. Operational finance metadata stays in the existing workspace snapshot so it remains connected to Sales, Purchasing, Supplier Command and Projects.

**Tech Stack:** Vanilla JavaScript browser application, Node.js ESM API/server modules, Supabase/Postgres, Xero Accounting API, existing build/test scripts.

**Spec:** `docs/superpowers/specs/2026-09-16-finance-command-design.md`

## Global Constraints
- Pool Shed owns operational finance context; Xero remains the accounting ledger.
- Stable Xero IDs are the primary external identity.
- Financial changes never create stock movements.
- Reconciliation conflicts are explicit and never silently overwritten.
- All visible Finance Command actions must have handlers.
- Preserve approved Option C visual language and existing protected module behaviour.
- No em dashes in user-facing copy.

---

### Task 1: Finance Command calculation engine
**Files:** Create `public/finance-command-engine.js`; Test `scripts/test-finance-command-engine-v116.mjs`.
**Interfaces:** Produces `window.PoolShedFinanceCommand` with `snapshot()`, `customerAccount()`, `supplierAccount()`, `suggestAllocation()`, `threeWayRows()`, `invoiceReadyRows()`, `reconciliationRows()`, `monthEndRows()`.
- [ ] Write failing tests for AR/AP derivation, payment/credit allocation, customer projected exposure thresholds, Sales Order payment state, supplier three-way match and reconciliation exceptions.
- [ ] Run the test and verify RED because the engine does not exist.
- [ ] Implement the minimal pure engine with Xero-linked documents preferred over legacy fallback values.
- [ ] Run the engine test and verify GREEN.

### Task 2: Option C Finance Command workspace
**Files:** Create `public/finance-command-workspace.js`, `public/finance-command.css`; Test `scripts/test-finance-command-workspace-v116.mjs`, `scripts/test-finance-command-actions-v116.mjs`, `scripts/test-finance-command-visual-v116.mjs`.
**Interfaces:** Consumes `PoolShedFinanceCommand`; owns `#screen-accounting`; uses `activeSubPage.accounting` for the approved navigation.
- [ ] Write failing workspace tests for all 15 pages, Overview metrics, customer account drill-down, allocation modal, chase/credit hold, supplier bills/payment run, three-way match, Xero Sync, Reconciliation and Month End.
- [ ] Verify RED.
- [ ] Implement Option C presentation and event delegation with no dead actions.
- [ ] Verify workspace/action/visual tests GREEN.

### Task 3: Finance operational persistence and cross-module routes
**Files:** Modify `public/finance-command-engine.js`, `public/finance-command-workspace.js`; Test `scripts/test-finance-command-routing-v116.mjs`.
**Interfaces:** `data.financeCommand` stores policy/chase/allocation/payment-run metadata; routes to Sales Orders, Purchasing, Supplier Command, Projects and Product Hub without duplicate financial documents.
- [ ] Write failing tests for persistent credit policies/chases/allocations and deep links to linked SO/PO/supplier account.
- [ ] Verify RED.
- [ ] Implement guarded persistence through `saveAppData()` and existing route state.
- [ ] Verify GREEN.

### Task 4: Xero status and reconciliation API enrichment
**Files:** Modify `api/finance.js`, `server/accounting.js`; Create `database/007-finance-command.sql` only if schema extension is required; Test `scripts/test-finance-command-api-v116.mjs` plus existing accounting tests.
**Interfaces:** Status returns linked remote/payload/check timestamps needed by Finance Command. Reconciliation actions remain ID-based and role-gated. No browser access to encrypted connection tokens.
- [ ] Write failing API tests for richer status, safe linked refresh/reconciliation and no stock side effects.
- [ ] Verify RED.
- [ ] Implement minimal API/server changes without turning Pool Shed into a ledger.
- [ ] Verify new and existing accounting API tests GREEN.

### Task 5: Release wiring and versioning
**Files:** Modify `public/index.html`, `public/service-worker.js`, `package.json`; update release-specific test configuration.
**Interfaces:** Load engine before workspace and cache all v1.16.0 assets.
- [ ] Write failing release wiring test `scripts/test-finance-command-release-v116.mjs`.
- [ ] Verify RED.
- [ ] Wire v1.16.0 assets and version metadata.
- [ ] Verify release test GREEN and all referenced JavaScript parses.

### Task 6: Protected regression and packaging
**Files:** Create `FINANCE-COMMAND-AUDIT-1.16.0.md`; update setup documentation if API/deployment behaviour changes.
- [ ] Run Finance Command tests, protected module tests, `npm run validate`, remaining post-database non-DB tests if the known PGlite boundary occurs, `npm run build`, runtime/release-asset validation and browser smoke attempt.
- [ ] Record exact results and limitations in the release audit.
- [ ] Create `Pool-Shed-1.16.0-Finance-Command.zip`, verify archive integrity and calculate SHA-256.
