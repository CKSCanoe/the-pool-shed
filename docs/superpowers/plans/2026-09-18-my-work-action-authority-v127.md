# Pool Shed v1.27.0 My Work & Action Authority Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add one canonical Action Authority, Approval Authority and My Work workspace above the existing Pool Shed modules while preserving v1.26 Foundation Authority and v1.25 Notifications Command.

**Architecture:** Persist actions/approvals under `data.actionAuthority`, expose stable globals (`PoolShedActionAuthority`, `PoolShedApprovalAuthority`), and keep source records authoritative. Source adapters create/refresh deduplicated actions from real unresolved exceptions. My Work renders the permission-scoped operational inbox and uses v1.26 Router, Permissions and Audit for all controlled actions.

**Tech Stack:** Browser JavaScript IIFEs, existing Pool Shed workspace JSON persistence, CSS semantic tokens, Node test scripts, Chromium browser smoke, existing build/runtime validation.

**Spec:** `docs/superpowers/specs/2026-09-18-my-work-action-authority-v127-design.md`

## Global Constraints

- Preserve v1.26 canonical identity, permissions, audit, routing and quality-gate contracts.
- Preserve v1.25 Notifications Command and never equate notification read-state with Action completion.
- Source records remain authoritative; Actions store references/context only.
- Approval commands are allow-listed through registered handlers and recheck authority at execution time.
- No legacy data recovery, Commercial Pipeline, Service Command, Xero live sync, Teams/email activation or persistence rewrite in v1.27.
- Use Executive Premium semantic tokens only for new structural UI.
- Release cannot replace the certified master unless database-backed acceptance passes.

---

### Task 1: Canonical Action Authority

**Files:**
- Create: `public/action-authority.js`
- Create: `scripts/test-action-authority-v127.mjs`

**Interfaces:**
- Consumes: `PoolShedIdentity`, `PoolShedSettingsPermissions`, `PoolShedAudit`, `PoolShedNotificationsCommand`, `PoolShedRouter`, `saveAppData()`.
- Produces: `window.PoolShedActionAuthority` with `create`, `upsertFromException`, `get`, `list`, `claim`, `assign`, `start`, `wait`, `snooze`, `complete`, `cancel`, `reopen`, `refreshSources`, `summary`, `registerSourceAdapter`.

- [ ] Write failing tests for canonical defaults, lifecycle guards, dedupe, ownership, permission filtering, snooze, completion evidence, reopen reason and source routing.
- [ ] Run `node scripts/test-action-authority-v127.mjs` and confirm RED.
- [ ] Implement the minimal canonical Action Authority.
- [ ] Re-run and confirm GREEN.

### Task 2: Canonical Approval Authority

**Files:**
- Create: `public/approval-authority.js`
- Create: `scripts/test-approval-authority-v127.mjs`

**Interfaces:**
- Consumes: Action Authority, v1.26 permissions/audit/router, canonical workspace.
- Produces: `window.PoolShedApprovalAuthority` with `request`, `get`, `list`, `approve`, `reject`, `withdraw`, `registerCommand`.

- [ ] Write failing tests for request dedupe, approver permission/limit enforcement, stale-source blocking, registered command execution, linked Action lifecycle and audit records.
- [ ] Run the test and confirm RED.
- [ ] Implement approval records and safe command registry.
- [ ] Re-run and confirm GREEN.

### Task 3: Operational Source Adapters

**Files:**
- Create: `public/action-source-adapters.js`
- Create: `scripts/test-action-source-adapters-v127.mjs`

**Interfaces:**
- Consumes: Action Authority and current Pool Shed collections.
- Produces: adapters for Purchasing, Sales, Warehouse/Inventory, Projects, Finance, Automation and Engineer Requests.

- [ ] Write failing fixtures proving deterministic dedupe and clear owner/route for supported unresolved conditions.
- [ ] Run and confirm RED.
- [ ] Implement conservative adapters that only create work when a resolution path is explicit.
- [ ] Re-run and confirm GREEN.

### Task 4: My Work Workspace

**Files:**
- Create: `public/my-work-workspace.js`
- Create: `public/assets/css/system/59-my-work-action-authority.css`
- Modify: `public/index.html`
- Modify: `public/assets/js/01-legacy-01.js`
- Modify: `public/settings-permissions-engine.js`
- Create: `scripts/test-my-work-workspace-v127.mjs`
- Create: `scripts/test-my-work-visual-v127.mjs`

**Interfaces:**
- Consumes: Action/Approval Authority and v1.26 router/permissions.
- Produces: first-class `My Work` navigation, personal/team filters, approval inbox and accessible lifecycle controls.

- [ ] Write failing tests for navigation, screen wiring, permission scoping, team restriction, tabs/filters, approval surfaces and semantic-token-only CSS.
- [ ] Run and confirm RED.
- [ ] Implement workspace and event delegation.
- [ ] Rebuild CSS and confirm tests GREEN.

### Task 5: Notifications, Audit and Routing Integration

**Files:**
- Modify: `public/record-router.js`
- Modify: `public/notifications-command-engine.js` only where route/category support is required.
- Create: `scripts/test-my-work-integration-v127.mjs`

**Interfaces:**
- Produces stable `#/my-work`, `#/my-work/actions/<id>`, `#/my-work/approvals/<id>` routes; lifecycle notifications remain awareness only.

- [ ] Write failing integration tests for Action assignment/overdue/approval notifications, route opening, canonical audit events and read-state independence.
- [ ] Run RED.
- [ ] Implement integration.
- [ ] Run GREEN.

### Task 6: Release Wiring and Regression Authority

**Files:**
- Modify: `package.json`
- Modify: `public/index.html`
- Modify: `public/service-worker.js`
- Modify: release/version surfaces that currently show `1.26.0`.
- Create: `scripts/test-action-authority-release-v127.mjs`
- Create: `MY-WORK-ACTION-AUTHORITY-AUDIT-1.27.0.md`
- Create: `FINAL-MY-WORK-ACTION-AUTHORITY-1.27.0.txt`

**Interfaces:**
- Produces v1.27 release/cache/version contract and validation command.

- [ ] Write failing release test for version/assets/order/service-worker/test scripts.
- [ ] Advance runtime wiring to `1.27.0` and service-worker cache `pool-shed-v1.27.0-my-work-action-authority`.
- [ ] Add `test:actions` and prepend it to `validate`.
- [ ] Run focused v1.27 + v1.26 + v1.25 suites.

### Task 7: Acceptance, Build and Exact Package Certification

**Files:**
- Modify: `scripts/test-browser-smoke.cjs` only to add My Work/Approvals coverage while retaining v1.26 harness behaviour.
- Generate: `/mnt/data/Pool-Shed-1.27.0-My-Work-Action-Authority.zip`
- Generate: `/mnt/data/Pool-Shed-1.27.0-My-Work-Action-Authority.sha256.txt`

- [ ] Run focused v1.27 tests.
- [ ] Run v1.26 Foundation suite and v1.25 Notifications suite.
- [ ] Run retained non-database regression/visual/runtime suites.
- [ ] Run database-backed suites. If unavailable, label RC and do not replace certified master.
- [ ] Run real Chromium acceptance including My Work and Approvals.
- [ ] Build production `dist`, validate runtime, run asset audit.
- [ ] Package exact release, extract fresh, repeat focused/build/runtime/asset checks.
- [ ] Publish audit, summary, ZIP and checksum with exact acceptance status.
