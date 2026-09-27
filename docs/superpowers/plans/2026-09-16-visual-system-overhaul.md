# Visual System Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver Pool Shed v1.23.0 with a premium, restrained global colour hierarchy and the approved v1.22 login preserved.

**Architecture:** Keep `40-design-system.css` as the shared visual authority. Remove or neutralise conflicting high-specificity legacy colour fills, then update scoped module colour variables only where they still bypass semantic tokens. Generate the single `app.css` bundle through the existing build chain.

**Tech Stack:** Static HTML/CSS/JavaScript, Node validation scripts, existing build-css and production build scripts.

**Spec:** `docs/superpowers/specs/2026-09-16-visual-system-overhaul-design.md`

## Global Constraints

- Keep Supabase as the auth provider and do not add a schema/project migration.
- Preserve v1.22 login behaviour, MFA/recovery/session/access states and footer version placement.
- Keep one runtime application stylesheet: `assets/css/app.css`.
- Do not use bright aqua/cyan as table/header/row structural fill.
- Preserve dark-mode support and semantic status colours.
- Xero remains Ready to Connect and locked.

---

### Task 1: Visual-system regression contract

**Files:**
- Create: `scripts/test-visual-system-v123.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes the maintained CSS source tree and public HTML.
- Produces a release gate for palette tokens, table treatment, login retention and version wiring.

- [ ] Write tests that fail while legacy aqua table rules and v1.22 version wiring remain.
- [ ] Run the test and confirm RED.
- [ ] Keep the test in the `validate` chain before historical module regressions.

### Task 2: Shared palette and component authority

**Files:**
- Modify: `public/assets/css/system/40-design-system.css`
- Modify: `public/assets/css/system/10-legacy-compat.css`

**Interfaces:**
- Produces shared semantic tokens and neutral table/button/tab/surface behaviour consumed by every workspace.

- [ ] Update approved palette tokens.
- [ ] Replace legacy global aqua table/header/hover fills with neutral semantic surfaces.
- [ ] Tighten shared secondary/utility action hierarchy.
- [ ] Preserve accessible focus treatment and semantic status colours.
- [ ] Run visual-system and CSS/contrast/readability tests.

### Task 3: Scoped module colour convergence

**Files:**
- Modify only scoped CSS modules that still contain saturated structural fills after Task 2, especially Sales, Purchasing, Supplier, Finance, Analytics, Automation, Settings, Inventory and Fulfilment modules.

**Interfaces:**
- Consumes the global tokens from Task 2.
- Produces module visuals that no longer reintroduce saturated structural colour.

- [ ] Audit maintained modules for direct saturated teal/aqua structural backgrounds.
- [ ] Convert structural fills to shared surface/status tokens while preserving intentional primary actions.
- [ ] Run protected module visual guards.

### Task 4: Shell and login alignment

**Files:**
- Modify: `public/assets/css/system/55-login-command.css` only if required for token alignment.
- Modify: `public/index.html` only for version/cache wiring or obsolete copy.

**Interfaces:**
- Preserves approved login UX and aligns it with v1.23 tokens.

- [ ] Verify staff login contains no Platform Hardening content.
- [ ] Verify version remains footer-only on login.
- [ ] Verify topbar utility controls are neutral and consistent.
- [ ] Run v1.22 login regression tests.

### Task 5: Version, cache and release wiring

**Files:**
- Modify: `package.json`
- Modify: `public/index.html`
- Modify: `public/service-worker.js`
- Modify: version-bearing release/runtime metadata and historical guards only where they freeze the app to v1.22.0.

**Interfaces:**
- Produces coherent v1.23.0 runtime/cache identity while retaining historical feature guards.

- [ ] Update all current runtime asset versions to 1.23.0.
- [ ] Remove stale v1.22 runtime/cache references.
- [ ] Run release-asset and service-worker checks.

### Task 6: Full verification and package

**Files:**
- Create: `VISUAL-SYSTEM-AUDIT-1.23.0.md`

**Interfaces:**
- Produces the final v1.23.0 distributable and verification evidence.

- [ ] Run dedicated visual-system tests.
- [ ] Run protected feature regressions.
- [ ] Run full validator through the known database boundary and remaining non-database tests separately if required.
- [ ] Run production build and runtime validation.
- [ ] Attempt browser smoke acceptance and record environment limitation if unavailable.
- [ ] Package ZIP, run archive integrity test and calculate SHA-256.
