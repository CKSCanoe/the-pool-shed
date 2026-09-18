# Notifications Command Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the legacy notification bell shortcut with a premium, permission-aware Notifications Command drawer and history surface on the v1.24.2 Executive Premium baseline.

**Architecture:** Add a standalone notification normalization/lifecycle engine and a standalone workspace controller. Existing operational records remain authoritative; read/archive metadata lives in `data.notificationCommand`. The legacy monolith exposes only a small route bridge and delegates the bell click/badge to the new workspace. Visual authority lives in a new semantic CSS module compiled into the single `app.css` bundle.

**Tech Stack:** Vanilla JavaScript, HTML, CSS custom properties, existing Pool Shed global bridges, Node.js regression scripts, static service worker/runtime build.

**Spec:** `docs/superpowers/specs/2026-09-17-notifications-command-design.md`

## Global Constraints

- Baseline is Pool Shed v1.24.2 Interaction & Navigation Authority.
- Legacy business data reconstruction is explicitly out of scope.
- Existing operational records remain canonical; no shadow copy of Sales Orders, Customers, Projects, POs, stock or finance records.
- Green remains status-only; primary actions use Executive Premium Steel Blue.
- Light and dark mode must use the shared semantic token system and meet WCAG AA for normal text.
- The bell opens Notifications Command in-place and must not route to Inventory -> Missing Stock.
- Notification visibility must respect existing module permissions.
- Email/Teams notification delivery is not activated by this release.
- Existing Settings -> Notifications governance remains intact.

---

### Task 1: Notification normalization and lifecycle engine

**Files:**
- Create: `public/notifications-command-engine.js`
- Create: `scripts/test-notifications-command-engine-v125.mjs`

**Interfaces:**
- Consumes: `window.__POOL_SHED_GET_DATA__`, `window.__POOL_SHED_CURRENT_USER__`, `window.__POOL_SHED_CAN_ACCESS__`, `window.saveAppData` when available.
- Produces: `window.PoolShedNotificationsCommand` with `list`, `unreadCount`, `markRead`, `markAllRead`, `archive`, `create`, `get`, `filters`, `summary`.

- [ ] **Step 1: Write the failing engine test**

Create fixture data with `notifications`, `adminNotifications`, automation alerts, two users and mixed module permissions. Assert normalization, severity/category inference, dedupe, permission filtering, unread count, read/unread persistence, archive persistence, and shared `create()` behaviour.

- [ ] **Step 2: Run the engine test and verify RED**

Run: `node scripts/test-notifications-command-engine-v125.mjs`
Expected: FAIL because `public/notifications-command-engine.js` does not exist.

- [ ] **Step 3: Implement the engine**

Implement canonical normalization into view models shaped as:

```js
{
  id,
  sourceKey,
  category,
  title,
  message,
  severity,
  sourceModule,
  sourceType,
  sourceId,
  route,
  createdAt,
  audience,
  unread,
  archived,
  actionable
}
```

Persist lifecycle only in `data.notificationCommand = { readByUser: {}, archivedByUser: {} }`. Do not mutate immutable source events merely to mark them read.

- [ ] **Step 4: Run the engine test and verify GREEN**

Run: `node scripts/test-notifications-command-engine-v125.mjs`
Expected: PASS.

- [ ] **Step 5: Record checkpoint**

Because the supplied release archive is not a Git checkout, save the passing test output in `NOTIFICATIONS-COMMAND-ENGINE-1.25.0.txt` rather than creating a Git commit.

---

### Task 2: Bell, drawer and premium interaction surface

**Files:**
- Create: `public/notifications-command-workspace.js`
- Create: `public/assets/css/system/57-notifications-command.css`
- Modify: `public/index.html`
- Modify: `scripts/build-css.mjs`
- Create: `scripts/test-notifications-command-workspace-v125.mjs`
- Create: `scripts/test-notifications-command-visual-v125.mjs`

**Interfaces:**
- Consumes: `PoolShedNotificationsCommand` and legacy route bridge created in Task 3.
- Produces: `window.PoolShedNotificationsWorkspace` with `open`, `close`, `toggle`, `refresh`, `isOpen`.

- [ ] **Step 1: Write failing workspace and visual tests**

Assert the bell is labelled `Notifications`, has `aria-expanded`, the index loads engine before workspace, the drawer root exists, filters/actions exist in workspace source, Escape/focus handling exists, and CSS uses semantic tokens without literal hex/rgb colours.

- [ ] **Step 2: Run tests and verify RED**

Run:
`node scripts/test-notifications-command-workspace-v125.mjs && node scripts/test-notifications-command-visual-v125.mjs`
Expected: FAIL because workspace/CSS/runtime wiring is absent.

- [ ] **Step 3: Implement premium drawer**

Build a right-side drawer with backdrop, command header, unread summary, filter chips, grouped chronological list, compact severity marker, source metadata, primary direct-record action, mark read/unread, archive, empty states, and a history mode. Opening the drawer must preserve the current app screen.

- [ ] **Step 4: Implement accessibility**

Set `aria-modal`, `aria-labelledby`, `aria-expanded`; save/restore trigger focus; close on Escape/backdrop; keep Tab/Shift+Tab inside the drawer while open; never mark all notifications read merely by opening.

- [ ] **Step 5: Verify workspace and visual tests GREEN**

Run:
`node scripts/test-notifications-command-workspace-v125.mjs && node scripts/test-notifications-command-visual-v125.mjs`
Expected: PASS.

- [ ] **Step 6: Record checkpoint**

Save outputs to `NOTIFICATIONS-COMMAND-WORKSPACE-1.25.0.txt` and `NOTIFICATIONS-COMMAND-VISUAL-1.25.0.txt`.

---

### Task 3: Permission-aware routing and legacy bell replacement

**Files:**
- Modify: `public/assets/js/01-legacy-01.js`
- Create: `scripts/test-notifications-command-routing-v125.mjs`

**Interfaces:**
- Consumes: normalized notification route objects.
- Produces: `window.__POOL_SHED_OPEN_NOTIFICATION_TARGET__(route)` and a legacy badge delegator.

- [ ] **Step 1: Write the failing routing test**

Assert the old `activeSubPage.locations = "Missing Stock"` bell handler is gone; a route bridge supports Sales Order, Customer, Project Details, Purchase Order/Supplier, Inventory/Warehouse, Fulfilment, Accounting/Finance, Automation and Settings targets; inaccessible targets return a permission-safe result.

- [ ] **Step 2: Run routing test and verify RED**

Run: `node scripts/test-notifications-command-routing-v125.mjs`
Expected: FAIL while the old Missing Stock handler remains.

- [ ] **Step 3: Implement route bridge and delegation**

Add `__POOL_SHED_OPEN_NOTIFICATION_TARGET__` inside the legacy lexical scope so it can safely update existing selected IDs/views. Replace the bell handler with `PoolShedNotificationsWorkspace.toggle()`. Change `renderAccountMenu()` badge ownership to call the Notifications Command unread counter when available and hide the badge at zero.

- [ ] **Step 4: Run routing test and verify GREEN**

Run: `node scripts/test-notifications-command-routing-v125.mjs`
Expected: PASS.

- [ ] **Step 5: Record checkpoint**

Save output to `NOTIFICATIONS-COMMAND-ROUTING-1.25.0.txt`.

---

### Task 4: Shared notification API and source integration

**Files:**
- Modify: `public/notifications-command-engine.js`
- Modify: `public/automation-command-engine.js`
- Modify: `public/settings-command-workspace.js` only where needed to preserve governance copy/behaviour
- Create: `scripts/test-notifications-command-integration-v125.mjs`

**Interfaces:**
- Consumes: existing operational notification arrays and Automation Command state.
- Produces: `PoolShedNotificationsCommand.create(input)` for future modules; existing sources continue to render without mandatory migration.

- [ ] **Step 1: Write failing integration test**

Assert existing `data.notifications` and `adminNotifications` are surfaced; automation failed/alert records are surfaced; `create()` dedupes by `sourceKey`; Settings notification rules remain present and unchanged; no Email/Teams sender is introduced.

- [ ] **Step 2: Run integration test and verify RED**

Run: `node scripts/test-notifications-command-integration-v125.mjs`
Expected: FAIL until source adapters/shared API are complete.

- [ ] **Step 3: Implement source adapters**

Normalize existing arrays without rewriting historical records. Add shared API for new in-app events. Add Automation helper use where it materially improves future notification creation, without changing Automation workflow behaviour.

- [ ] **Step 4: Run integration test and verify GREEN**

Run: `node scripts/test-notifications-command-integration-v125.mjs`
Expected: PASS.

- [ ] **Step 5: Record checkpoint**

Save output to `NOTIFICATIONS-COMMAND-INTEGRATION-1.25.0.txt`.

---

### Task 5: Release wiring, cache and regression authority

**Files:**
- Modify: `package.json`
- Modify: `public/index.html`
- Modify: `public/service-worker.js`
- Modify: `CURRENT-RELEASE.txt`
- Modify: `README.md` where current release is stated
- Modify: `scripts/build-css.mjs`
- Modify: `package.json` validate script to prepend v1.25 Notifications Command tests
- Create: `scripts/test-notifications-command-release-v125.mjs`
- Create: `NOTIFICATIONS-COMMAND-AUDIT-1.25.0.md`

**Interfaces:**
- Produces release `1.25.0` with versioned engine/workspace/app.css assets and service-worker cache `pool-shed-v1.25.0-*`.

- [ ] **Step 1: Write failing release test**

Assert package/index/service-worker/current-release all agree on `1.25.0`, engine loads before workspace, CSS build contains `system/57-notifications-command.css`, service worker caches both new JS modules, and old Missing Stock bell routing is absent.

- [ ] **Step 2: Run release test and verify RED**

Run: `node scripts/test-notifications-command-release-v125.mjs`
Expected: FAIL while release remains 1.24.2.

- [ ] **Step 3: Advance release wiring**

Update version/cache/runtime query strings consistently and add tests to the start of `npm run validate`.

- [ ] **Step 4: Run release test and verify GREEN**

Run: `node scripts/test-notifications-command-release-v125.mjs`
Expected: PASS.

- [ ] **Step 5: Record checkpoint**

Save output to `NOTIFICATIONS-COMMAND-RELEASE-1.25.0.txt`.

---

### Task 6: Full verification and distributable package

**Files:**
- Generated: `public/assets/css/app.css`
- Generated: `dist/**`
- Generated: `FINAL-NOTIFICATIONS-COMMAND-1.25.0.txt`
- Generated: release ZIP and SHA-256 checksum outside project root.

**Interfaces:**
- Consumes all prior tasks.
- Produces the deployable v1.25.0 archive.

- [ ] **Step 1: Rebuild CSS**

Run: `node scripts/build-css.mjs`
Expected: generated `app.css` includes `MODULE: system/57-notifications-command.css`.

- [ ] **Step 2: Run Notifications Command suite**

Run all five v1.25 notification tests. Expected: PASS, zero failures.

- [ ] **Step 3: Run protected visual/navigation regression matrix**

Run v1.24.2 interaction, v1.24.1 contrast, v1.24 visual system, login, Sales, Projects, Inventory, Purchasing, Warehouse, Fulfilment, Finance, Automation, Settings and runtime tests. Expected: zero application regressions.

- [ ] **Step 4: Run broad validator**

Run: `npm run validate`
Expected: all application tests pass until any already-documented environment-only database dependency boundary; report that boundary separately if it remains.

- [ ] **Step 5: Build production runtime**

Run: `npm run build`
Expected: exit 0 and `dist` runtime validation passes.

- [ ] **Step 6: Attempt browser automation**

Run the existing browser test command. If Playwright remains absent, record that exact environment limitation and do not claim pixel/browser automation passed.

- [ ] **Step 7: Package and fresh-extract verify**

Create `Pool-Shed-1.25.0-Notifications-Command.zip`, calculate SHA-256, extract to a new directory and rerun notification release/workspace/visual/routing tests plus runtime validation against the fresh copy.

- [ ] **Step 8: Publish verification summary**

Write `FINAL-NOTIFICATIONS-COMMAND-1.25.0.txt` with exact commands/results and documented environment limitations.
