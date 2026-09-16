# Pool Shed Legacy Data Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Add a safe dry-run-first legacy data migration bridge to Pool Shed and package it as v1.21.0.

**Architecture:** A standalone browser migration engine discovers old Pool Shed snapshots and produces deterministic non-destructive merge plans against `__POOL_SHED_GET_DATA__`. Settings provides the admin control surface; apply creates a full backup, mutates the canonical workspace in place and saves through the existing persistence/sync path.

**Tech Stack:** Vanilla JavaScript, Node test scripts, browser localStorage/IndexedDB, existing Supabase JS client, Bash build pipeline.

**Spec:** `docs/superpowers/specs/2026-09-16-legacy-data-migration-design.md`

## Global Constraints
- Current Pool Shed data remains authoritative.
- Never import legacy UI/runtime code.
- Never overwrite populated current values with legacy values automatically.
- Never add legacy quantity to an existing current stock balance.
- Dry run and pre-migration backup are mandatory before apply.
- Xero connection state and auth/permissions are not changed.

---

### Task 1: Migration engine and merge safety
**Files:**
- Create: `public/legacy-migration-engine.js`
- Create: `scripts/test-legacy-migration-engine-v121.mjs`

**Interfaces:**
- Produces `window.PoolShedLegacyMigration` with `summarise`, `plan`, `apply`, `detectLocalStorage`, `readIndexedDb`, `discover`.

- [x] Write failing engine tests for product/customer matching, no-overwrite enrichment, supplier derivation, stock no-double-count, order/history dedupe and conflict reporting.
- [x] Run the test and verify RED because the engine does not exist.
- [x] Implement the minimum deterministic merge engine.
- [x] Run the engine test and verify GREEN.

### Task 2: Legacy source discovery and remote read bridge
**Files:**
- Modify: `public/assets/js/01-legacy-01.js`
- Extend: `scripts/test-legacy-migration-engine-v121.mjs`

**Interfaces:**
- Produces `window.__POOL_SHED_READ_LEGACY_REMOTE__()` returning readable legacy snapshot candidates from `offline_sync_snapshots`.

- [x] Add failing tests for old localStorage key detection and required remote bridge token.
- [x] Verify RED.
- [x] Implement localStorage/IndexedDB discovery and the read-only Supabase bridge.
- [x] Verify GREEN.

### Task 3: Settings migration control surface
**Files:**
- Modify: `public/settings-command-workspace.js`
- Create: `public/assets/css/system/55-legacy-migration.css`
- Modify: `scripts/build-css.mjs`
- Create: `scripts/test-legacy-migration-workspace-v121.mjs`

**Interfaces:**
- Adds Settings page `Legacy Data Migration` with scan, JSON import, dry-run, backup and apply controls.

- [x] Write failing structural/action/visual tests.
- [x] Verify RED.
- [x] Implement the page and actions using `PoolShedLegacyMigration`.
- [x] Verify GREEN and rebuild CSS.

### Task 4: Release wiring, package and regression verification
**Files:**
- Modify: `public/index.html`, `public/service-worker.js`, `package.json`, `scripts/build.sh`
- Create: `scripts/test-legacy-migration-release-v121.mjs`
- Create: `LEGACY-MIGRATION-AUDIT-1.21.0.md`

**Interfaces:**
- Release identity `1.21.0`; migration engine loads before Settings workspace.

- [x] Write failing release wiring test.
- [x] Verify RED.
- [x] Wire engine, version/cache/build guard and validate script chain.
- [x] Run dedicated migration tests, protected v1.20 suites, production build and runtime validation.
- [x] Package `Pool-Shed-1.21.0-Legacy-Data-Migration.zip` and generate SHA256.
