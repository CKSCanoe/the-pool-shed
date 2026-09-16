# Settings, Users & Permissions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the approved Settings Option C as Pool Shed's single security and configuration authority.

**Architecture:** Add a focused settings-permissions engine for effective roles, overrides, approval limits, location scopes, financial visibility and audit events. Add a settings command workspace that replaces the legacy Settings surface while reusing existing company/profile/integration records. Install a global access adapter consumed by the assistant and future modules so permission checks are consistent.

**Tech Stack:** Existing browser JavaScript application, local workspace state, Supabase-auth-linked user IDs, generated single app.css build, Node test scripts.

**Spec:** `docs/superpowers/specs/2026-09-16-settings-users-permissions-design.md`

## Global Constraints
- Release version is 1.19.0.
- Keep one authoritative application stylesheet.
- Preserve existing Supabase authentication and user IDs.
- Do not expose secrets or credentials in UI, exports, search, or assistant data.
- Assistant and automation must inherit the effective permissions of the signed-in user.
- Sensitive changes are audited.
- Full system export remains Admin-controlled unless explicitly granted by effective permission.

---

### Task 1: Permission engine and migration
**Files:** Create `public/settings-permissions-engine.js`; create engine tests.
- [ ] Write failing tests for role defaults, user overrides, deny precedence, location access, financial visibility, approval limits, assistant scope and audit logging.
- [ ] Run tests and confirm RED.
- [ ] Implement normalised security settings and effective-permission evaluation.
- [ ] Expose `__POOL_SHED_CAN_ACCESS__` and richer settings permission APIs without breaking existing callers.
- [ ] Run tests and confirm GREEN.

### Task 2: Settings Command workspace
**Files:** Create `public/settings-command-workspace.js`; create `public/assets/css/system/53-settings-command.css`; update CSS build.
- [ ] Write failing structure/action/visual tests from approved Option C.
- [ ] Implement Overview, Users, Roles & Permissions, Approval Limits, Locations & Access, Financial Visibility, Automation & Assistant, Integrations, Notifications, Company Settings, Audit & Security.
- [ ] Implement View as User preview using effective permissions.
- [ ] Keep legacy company/profile/status/tag functions reachable where appropriate without making them a second permission authority.
- [ ] Run tests and confirm GREEN.

### Task 3: Assistant, automation, export and finance enforcement
**Files:** Modify `assistant-engine.js`, Automation workspace/engine where needed, Analytics export guards, finance/supplier sensitive routes where central hooks exist.
- [ ] Write failing integration tests proving restricted data is unavailable through assistant/search/export/automation when UI permission is denied.
- [ ] Apply central permission checks before retrieval/action construction.
- [ ] Verify Admin/full-access behavior remains available.
- [ ] Run tests and confirm GREEN.

### Task 4: Release wiring and regressions
**Files:** update `public/index.html`, service worker, package version/scripts, release guards; build dist.
- [ ] Add Settings engine/workspace scripts at version 1.19.0.
- [ ] Update cache/runtime asset version coherently.
- [ ] Update historical release tests to require feature retention on current version rather than an obsolete fixed application version.
- [ ] Run protected module suites and full validation.
- [ ] Run remaining non-database tests if PGlite boundary is encountered.
- [ ] Run production build and browser smoke attempt.
- [ ] Write release audit, package ZIP, verify ZIP integrity and SHA-256.
