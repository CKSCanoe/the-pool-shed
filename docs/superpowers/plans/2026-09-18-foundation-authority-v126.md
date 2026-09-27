# Pool Shed v1.26.0 Foundation Authority Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver one canonical identity/permission authority, one append-only audit authority, one stable record router, one Permission Inspector, and executable browser/database release gates while preserving the v1.25.0 product surface.

**Architecture:** Add small focused authority modules at the public runtime boundary and convert legacy code into compatibility shims. Existing workspaces remain the authoritative record renderers. New Settings diagnostics and release gates consume these shared authorities without rebuilding business modules.

**Tech Stack:** Vanilla JavaScript browser runtime, Node.js test scripts, static HTML/CSS build, Supabase client boundary, PGlite acceptance, Playwright/Chromium browser acceptance.

**Spec:** `docs/superpowers/specs/2026-09-17-foundation-authority-v126-design.md`

## Global Constraints

- Baseline is Pool Shed v1.25.0 Notifications Command.
- Preserve Executive Premium Steel Blue, Login Command, Notifications Command, Xero Ready mode and existing business invariants.
- Canonical business roles are exactly Admin, Management, Accounts, Sales, Purchasing, Warehouse, Engineer, Office.
- `User` is compatibility-only and normalizes to Office.
- Technical Supabase service roles remain separate from staff business roles.
- Existing workspaces remain record authorities.
- Normal UI exposes no audit update/delete API.
- Static-host-safe hash routing only.
- Missing browser/database acceptance dependencies are release blockers.

---

### Task 1: Canonical Identity Authority

**Files:**
- Create: `public/identity-authority.js`
- Create: `scripts/test-identity-authority-v126.mjs`
- Modify: `public/assets/js/01-legacy-01.js`
- Modify: `public/index.html`

**Interfaces:**
- Produces `window.PoolShedIdentity` with `roles`, `normalizeRole`, `isCanonicalRole`, `normalizeUser`, `normalizeUsers`, `currentUser`, `isAdmin`.
- Legacy Supabase profile mapping consumes `PoolShedIdentity.normalizeRole`.

- [ ] Write failing identity tests for all eight roles, User alias, unknown role safety and Supabase mapping.
- [ ] Run the test and verify RED.
- [ ] Implement `identity-authority.js` and load it before the permission engine.
- [ ] Convert legacy profile mapping and Admin helpers to use the identity authority.
- [ ] Run identity tests and retained login/settings tests.

### Task 2: Permission Explanation and Legacy Delegation

**Files:**
- Modify: `public/settings-permissions-engine.js`
- Modify: `public/assets/js/01-legacy-01.js`
- Create: `scripts/test-foundation-permissions-v126.mjs`

**Interfaces:**
- Produces `PoolShedSettingsPermissions.explain(module, operation, user, context)`.
- Legacy `defaultPermissionsForRole`, `userPermissions`, `canAccessTab`, `isAdminUser` delegate to canonical authorities.

- [ ] Write failing tests for explicit deny/grant, role inheritance, finance, location and approval explanations.
- [ ] Run RED.
- [ ] Implement explanation API and compatibility delegation.
- [ ] Run new and retained Settings/Notifications permission tests.

### Task 3: Canonical Audit Authority

**Files:**
- Create: `public/audit-authority.js`
- Create: `scripts/test-audit-authority-v126.mjs`
- Modify: `public/settings-permissions-engine.js`
- Modify: `public/settings-command-workspace.js`
- Modify: `public/index.html`

**Interfaces:**
- Produces `PoolShedAudit.record`, `query`, `forRecord`, `forUser`, `export`.
- Settings security changes write canonical events first and retain legacy projection where needed.

- [ ] Write failing tests for schema, redaction, append-only API, record/user query and export self-audit.
- [ ] Run RED.
- [ ] Implement audit authority and Settings bridge.
- [ ] Run audit and Settings regression tests.

### Task 4: Stable Record Router

**Files:**
- Create: `public/record-router.js`
- Create: `scripts/test-record-router-v126.mjs`
- Modify: `public/notifications-command-workspace.js`
- Modify: `public/assets/js/01-legacy-01.js`
- Modify: `public/index.html`

**Interfaces:**
- Produces `PoolShedRouter.parse`, `to`, `open`, `current`, `replace`, `href`, `canOpen`, `register`.
- Existing record state is manipulated through exposed router adapter helpers, not duplicate pages.

- [ ] Write failing deterministic parsing/href/permission/missing-record tests.
- [ ] Run RED.
- [ ] Implement router and default adapters.
- [ ] Route Notifications through canonical router with compatibility fallback.
- [ ] Run router and Notifications regression tests.

### Task 5: Permission Inspector and Audit UX

**Files:**
- Modify: `public/settings-command-workspace.js`
- Create: `public/assets/css/system/58-foundation-authority.css`
- Create: `scripts/test-permission-inspector-v126.mjs`
- Modify: `scripts/build-css.mjs` only if discovery is not automatic.

**Interfaces:**
- Settings Roles & Permissions exposes read-only user inspector with role, matrix, finance, location, approval and explanation data.
- Audit & Security consumes canonical audit events first and labels legacy history separately.

- [ ] Write failing structural/permission tests.
- [ ] Run RED.
- [ ] Implement inspector and canonical audit presentation.
- [ ] Run visual/contrast/readability guards.

### Task 6: Release Quality Authority

**Files:**
- Modify: `package.json`
- Modify/Create: browser acceptance scripts under `scripts/browser/`
- Modify: `scripts/test-browser-smoke.cjs`
- Create: `scripts/test-foundation-quality-gate-v126.mjs`

**Interfaces:**
- `npm run test:database` runs all PGlite-backed acceptance suites.
- `npm run test:browser` runs Chromium acceptance and supports explicit administrator-navigation-block fallback without changing application runtime.
- `npm run test:foundation` runs all v1.26 authority suites.

- [ ] Write failing release-contract test for declared dependencies/scripts.
- [ ] Run RED.
- [ ] Declare dependencies and split/strengthen browser harness.
- [ ] Prove browser gate and database gate execute in a dependency-enabled environment.
- [ ] Retain semantic contrast, light/dark and responsive acceptance.

### Task 7: Release Wiring and Final Verification

**Files:**
- Modify: version/cache references across package/index/service worker/login/readiness.
- Create: `FOUNDATION-AUTHORITY-AUDIT-1.26.0.md`
- Create: `FINAL-FOUNDATION-AUTHORITY-1.26.0.txt`

**Interfaces:**
- Release is `1.26.0` and service-worker cache is `pool-shed-v1.26.0-foundation-authority`.

- [ ] Add v1.26 tests to validation order.
- [ ] Advance release/cache metadata consistently.
- [ ] Run foundation suites, retained module/visual suites, PGlite database suites and browser acceptance.
- [ ] Build production and validate `dist`.
- [ ] Run release asset audit.
- [ ] Package ZIP, extract fresh, rerun mandatory gates, then generate SHA-256.
