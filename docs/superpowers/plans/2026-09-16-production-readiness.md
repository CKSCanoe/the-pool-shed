# Pool Shed v1.20.0 Production Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Verify and harden the complete Pool Shed business lifecycle and package a production-readiness release without introducing another major operational subsystem.

**Architecture:** Add a read-only production-readiness engine and Settings workspace backed by canonical Pool Shed records, then protect the release with end-to-end journey tests and release/route/status consistency tests. Existing module engines remain authoritative and are not duplicated.

**Tech Stack:** Existing vanilla JavaScript application, Node.js validation scripts, existing Pool Shed data/workspace engines and build pipeline.

**Spec:** `docs/superpowers/specs/2026-09-16-production-readiness-design.md`

## Global Constraints
- Current release target is 1.20.0.
- Preserve single authoritative `public/app.css` runtime stylesheet.
- Do not relax existing Warehouse, Fulfilment, Finance, Analytics, Automation or Settings guards.
- Do not invent production connection success where external credentials or browser/database dependencies are absent.
- Diagnostics are read-only unless the user explicitly enters an existing authority surface to resolve an issue.

---

### Task 1: End-to-end acceptance engine and tests
- [ ] Write failing tests for order-to-cash, procure-to-pay, project lifecycle, returns/credits, engineer stock, assistant permission safety and export integrity.
- [ ] Run them and confirm they fail because the acceptance engine is absent.
- [ ] Implement `public/production-readiness-engine.js` as read-only derived diagnostics over canonical workspace data.
- [ ] Re-run and keep the engine tests green.

### Task 2: Production Readiness Settings surface
- [ ] Write failing workspace/action tests for a `Production Readiness` Settings page.
- [ ] Implement a compact command surface showing critical journey status, environment checks, unresolved blockers and direct links to authority modules.
- [ ] Add styles to the single `app.css` authority.
- [ ] Re-run workspace/action/readability tests.

### Task 3: Route and terminology hardening
- [ ] Write failing tests covering critical cross-module routes and shared lifecycle terminology.
- [ ] Correct dead routes, stale version guards and inconsistent status labels without changing module ownership.
- [ ] Re-run protected module tests.

### Task 4: Release wiring and versioning
- [ ] Add v1.20.0 assets to runtime/build/service-worker wiring using the current application version.
- [ ] Add `test:production-readiness` to package scripts and prepend its release guards to full validation.
- [ ] Validate runtime asset existence and JavaScript parsing.

### Task 5: Full verification and package
- [ ] Run dedicated production-readiness tests.
- [ ] Run all protected module suites.
- [ ] Run `npm run validate`; if PGlite is the only environmental stop, run every remaining non-database test separately.
- [ ] Run production build and runtime validation.
- [ ] Attempt browser smoke testing and record dependency/environment limitations exactly.
- [ ] Write `PRODUCTION-READINESS-AUDIT-1.20.0.md`.
- [ ] Package ZIP, test archive integrity and calculate SHA-256.
