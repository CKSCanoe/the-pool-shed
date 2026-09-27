# Pool Shed v1.26.0 Foundation Authority Design

## Status
Approved architecture for implementation planning.

## Baseline
Pool Shed v1.25.0 Notifications Command is the protected master. v1.26.0 must retain the Executive Premium Steel Blue design, Login Command, Notifications Command, all operational business invariants, Xero Ready mode, and existing module behaviour unless a change is explicitly required by this specification.

## Goal
Create one authoritative identity and permission model, one immutable audit-event authority, one stable record-routing authority, and one enforceable browser/database release-quality gate so later My Work, Actions, Approvals, Commercial Pipeline and Service Command releases can rely on a coherent platform foundation.

## Non-goals
v1.26.0 does not build My Work, Actions, Approval Inbox, Commercial Pipeline, Customer Equipment Register, Service Command, live Xero sync, Teams delivery, email delivery, or a domain-by-domain Supabase transactional migration. It does not redesign the approved visual language.

## Current-state findings

### Business-role conflict
`public/settings-permissions-engine.js` already owns the intended business roles:

- Admin
- Management
- Accounts
- Sales
- Purchasing
- Warehouse
- Engineer
- Office

It also already maps legacy `User` to `Office`.

However, `public/assets/js/01-legacy-01.js` still constrains Supabase profile read/write and authenticated-user hydration to `Admin`, `Engineer`, and `User`. This can collapse Management, Accounts, Sales, Purchasing, Warehouse and Office profiles back to `User`/Office semantics.

### Permission duplication
The legacy runtime still contains `defaultPermissionsForRole`, `userPermissions`, `canAccessTab`, and Admin helpers separate from `PoolShedSettingsPermissions`. This creates two possible interpretations of access.

### Audit fragmentation
Settings security changes write to `data.auditLog` and `securityControl.securityEvents`, while other modules maintain their own history or event arrays. The application lacks one common immutable event contract for high-risk actions.

### Routing fragmentation
Major workspaces are opened through mutable globals such as `active`, `activeSubPage`, `selectedSalesOrderId`, `selectedCrmCustomerId`, and other selected-record variables. Multiple modules implement local routing helpers. The browser URL does not represent the current business record.

### Release-quality gap
`scripts/test-browser-smoke.cjs` already contains valuable real-browser operational coverage but requires Playwright, which is not declared in the current package. PGlite is declared in `devDependencies` but is not present in extracted release environments, preventing database-backed acceptance from running there.

## Architecture principles

1. **Single authority, compatibility at the edge.** New code consumes canonical APIs. Legacy representations are translated only at explicit compatibility boundaries.
2. **Deny safely.** Unknown business roles resolve to Office for migration compatibility, but sensitive operations remain denied unless positively granted.
3. **Business roles and technical service roles remain separate.** Pool Shed staff roles must never be substituted into `ps_workspace_members` (`viewer/operator/admin`) or `ps_finance_members` (`viewer/accountant/admin`).
4. **Existing modules remain record authorities.** Routing opens current Customer, Sales Order, Project, PO and other screens instead of creating duplicate record viewers.
5. **Audit is append-only from normal application code.** Staff UI has no update/delete path for canonical audit events.
6. **Release quality is executable.** Required browser and database gates must be installable and runnable from the declared project dependencies/CI definition.
7. **No visual reset.** Foundation work must not regress v1.25 interaction, contrast, navigation or notification design.

---

# 1. Canonical Identity and Permission Authority

## 1.1 Canonical business roles
The canonical role IDs are exactly:

```text
Admin
Management
Accounts
Sales
Purchasing
Warehouse
Engineer
Office
```

`User` is a read-time migration alias for `Office`. It must never be offered when creating/editing a staff profile and must never be written back to Supabase by v1.26 code.

Unknown or blank legacy role values normalize to `Office` and generate a diagnostic/audit event when encountered during an authenticated profile load or Admin profile review.

## 1.2 New identity authority
Create `public/identity-authority.js` as the narrow owner of business identity normalization.

Required public API:

```js
PoolShedIdentity.roles()                         // canonical role definitions
PoolShedIdentity.normalizeRole(role)             // -> canonical role ID
PoolShedIdentity.isCanonicalRole(role)            // boolean
PoolShedIdentity.normalizeUser(user, options?)    // normalized non-mutating user object
PoolShedIdentity.normalizeUsers(users, options?)  // normalized array
PoolShedIdentity.currentUser()                    // current authenticated Pool Shed profile
PoolShedIdentity.isAdmin(user?)                   // boolean
```

The identity authority must not own module permissions. It owns only identity and role normalization so permission logic remains isolated in `settings-permissions-engine.js`.

## 1.3 Supabase profile boundary
Update the legacy authentication/profile bridge so:

- `loadSupabaseProfiles()` preserves all eight canonical business roles.
- `saveSupabaseProfile()` writes all eight canonical business roles.
- authenticated user hydration preserves all eight canonical business roles.
- a stored legacy `User` role is normalized to `Office` in memory and, only when an authorised profile save occurs, persisted as `Office`.
- unknown roles do not silently gain extra access.
- profile `permissions` remains a compatibility input, but effective permission calculation is delegated to the canonical permission engine.

No service-role secret is introduced into browser code.

## 1.4 Permission engine authority
`PoolShedSettingsPermissions` remains the permission-policy engine and is upgraded to consume `PoolShedIdentity.normalizeRole()` instead of maintaining an independent role normalizer.

Required authoritative APIs remain or become:

```js
can(module, operation, user?)
canFinancial(field, user?)
canLocation(locationId, user?)
approvalRoute(key, amount, user?)
effective(user?)
explain(module, operation, user?, context?)
```

`explain()` is new and must return a machine-readable reason chain, for example:

```js
{
  allowed: false,
  userId: '...',
  role: 'Engineer',
  module: 'accounting',
  operation: 'view',
  source: 'role',
  reason: 'Engineer role does not include Finance view access',
  override: null,
  locationScope: null,
  approval: null
}
```

When an explicit deny exists, `source` must identify the user override. When location scope or approval limit is the blocking rule, the explanation must state that rule rather than generically saying permission denied.

## 1.5 Legacy permission bridge
The legacy runtime functions remain as compatibility shims temporarily but must delegate to the canonical engine:

- `adminRoles()` derives from canonical roles rather than hard-coded legacy values.
- `isAdminUser()` delegates to `PoolShedIdentity.isAdmin()`.
- `defaultPermissionsForRole()` derives from `PoolShedSettingsPermissions.roleMatrix()`.
- `userPermissions()` becomes a compatibility projection of effective module `view` permissions.
- `canAccessTab()` delegates to `PoolShedSettingsPermissions.can(tabId, 'view', user)`.

No maintained module may introduce another independent role matrix after v1.26.

## 1.6 Permission Inspector
Settings > Roles & Permissions gains an Admin/Management-visible Permission Inspector.

An authorised reviewer can select a staff member and inspect:

- canonical role
- account status
- visible/blocked modules
- create/edit/delete/export/approve/override/configure permissions
- individual grants/denies
- financial visibility
- location scope
- approval limits
- representative approval-route examples
- explanation of why a selected operation is allowed or denied

The Inspector is read-only. Editing remains in the existing controlled Settings surfaces.

## 1.7 Security invariants
- Admin retains full application authority and cannot be configured into an unusable state through role-matrix edits.
- Disabled/inactive profiles cannot enter the workspace.
- Permission UI hiding is never the sole security decision. Action handlers continue to check authority before performing high-risk operations.
- Azzy retrieval, Automation, Analytics export, Notifications routing and Settings all consume the same permission authority.
- The full-system Analytics export remains Admin-only unless a future explicitly approved policy changes it.

---

# 2. Immutable Audit Authority

## 2.1 Canonical event engine
Create `public/audit-authority.js`.

Required API:

```js
PoolShedAudit.record(event)
PoolShedAudit.query(filters?)
PoolShedAudit.forRecord(recordType, recordId)
PoolShedAudit.forUser(userId)
PoolShedAudit.export(filters?)
```

Normal UI code receives no update/delete API.

## 2.2 Event contract
Every canonical audit event contains:

```js
{
  id,
  occurredAt,
  actor: { userId, name, role },
  action,
  category,
  severity,
  module,
  record: { type, id, label },
  before,
  after,
  reason,
  metadata,
  correlationId,
  source: 'ui' | 'automation' | 'system' | 'api' | 'migration'
}
```

`before` and `after` may be structured JSON. Secrets, passwords, session tokens, OAuth tokens and other credentials must never be serialized into audit data.

## 2.3 Storage compatibility
During v1.26, canonical events may continue to persist inside the current workspace as `data.auditEvents` because transactional database migration is a later programme. This is an application-level append-only authority, not a claim of cryptographic immutability.

Existing `data.auditLog` and module histories remain readable for backward compatibility. New high-risk actions write the canonical event first. Where an older screen requires its legacy history format, a compatibility projection may also be created, but canonical audit data must never be reconstructed from that projection.

## 2.4 Required v1.26 event coverage
At minimum, canonical events must cover:

- user profile create/change/disable
- role permission changes
- individual permission overrides
- location-scope changes
- financial-visibility changes
- approval-limit changes
- notification-governance changes
- company/security configuration changes
- integration security/readiness reviews
- full-system export and security-audit export
- manual stock override/reallocation/write-off when those existing operations expose a hook
- PO approval/override when existing Purchasing exposes a hook
- financial approval/credit override when existing Finance exposes a hook
- irreversible shipment action when existing Fulfilment exposes a hook
- project commercial/variation approval when existing Project flows expose a hook
- automation activation/deactivation and privileged automation execution

If an existing module lacks a safe hook for one of the operational events above, v1.26 documents it as a follow-up integration gap instead of patching unrelated business logic unsafely.

## 2.5 Audit UI
Settings > Audit & Security reads canonical events first and can include legacy history as a separately labelled historical source.

Filters:

- date range
- actor
- role
- module
- category
- action
- record type/reference
- severity

Record-opening actions use the canonical router and therefore re-check access.

---

# 3. Stable Record Routing Authority

## 3.1 Router engine
Create `public/record-router.js`.

Required API:

```js
PoolShedRouter.parse(urlOrLocation?)
PoolShedRouter.to(recordType, recordId, options?)
PoolShedRouter.open(route, options?)
PoolShedRouter.current()
PoolShedRouter.replace(route)
PoolShedRouter.href(recordType, recordId, options?)
PoolShedRouter.canOpen(route, user?)
PoolShedRouter.register(recordType, adapter)
```

## 3.2 URL format
Use application-local path/hash routing that works with the existing static-host deployment without requiring server rewrite rules.

Canonical v1.26 form:

```text
#/dashboard
#/customers/CUST-0001
#/sales-orders/SO-1001
#/projects/JOB-1001
#/purchase-orders/PO-1001
#/suppliers/SUP-1001
#/products/P-1001
#/inventory/location/L-WH-A1
#/warehouse/goods-in/PO-1001
#/fulfilment/goods-note/GN-1001
#/finance
#/analytics
#/automation
#/settings/roles-permissions
```

The router may support additional registered routes where existing modules can resolve them safely.

## 3.3 Adapter contract
Each record type is registered through an adapter that knows how to map a stable route into existing runtime state. Example shape:

```js
{
  permission: { module: 'salesorders', operation: 'view' },
  exists(data, id) { ... },
  activate(context, id, options) {
    context.active = 'salesorders';
    context.activeSubPage.salesorders = 'Sales Orders';
    context.selectedSalesOrderId = id;
    context.salesOrderView = 'detail';
  }
}
```

Adapters do not render duplicate detail pages. They activate the existing authoritative module and record selection.

## 3.4 Browser behaviour
- Opening a record updates the hash after successful permission/existence checks.
- Browser Back/Forward restores the previous Pool Shed route.
- Reloading a deep link after successful authentication reopens the requested record.
- Login preserves a safe pending route and applies it only after authentication and permission checks.
- If the record no longer exists, the user is routed to the parent module with a clear non-destructive message.
- If access is denied, Pool Shed does not leak record content and routes to a safe permitted destination.
- Router updates must not create loops with modules that call `render()` repeatedly.

## 3.5 Existing route integrations
Notifications Command must delegate direct record opening to `PoolShedRouter`.

Analytics, Automation, Production Readiness, Settings audit results and other maintained local routing helpers should use the router where they point to a supported business record. Existing local helpers may remain only for non-record page switching until later cleanup.

---

# 4. Release Quality Authority

## 4.1 Declared test dependencies
The project must declare and lock the dependencies required to run mandatory acceptance checks in a clean install.

Required development dependencies include:

- `@electric-sql/pglite` for database-backed acceptance
- `playwright` for browser acceptance, or `playwright-core` plus a documented guaranteed browser executable in CI

The chosen CI/release path must install the declared dependency and browser before claiming the mandatory gate passed.

## 4.2 Browser acceptance suite
Refactor/extend `scripts/test-browser-smoke.cjs` into a maintainable browser suite rather than one monolithic script. At minimum, tests cover:

- authenticated shell/navigation bootstrap using a controlled test harness
- Login Command rendering and keyboard basics
- Dashboard
- Customers
- Sales Orders list/detail
- Projects / Project Details
- Product Hub
- Purchasing / PO detail
- Inventory
- Warehouse / Goods In
- Fulfilment / Goods Notes
- Finance shell with mocked integration boundaries
- Analytics
- Automation/Azzy shell
- Settings and Permission Inspector
- Notifications Command
- stable deep-link route open, reload, Back and Forward
- denied-route handling
- light mode
- dark mode
- desktop viewport
- mobile viewport
- no unexpected horizontal overflow on protected screens
- no uncaught page errors or failed local runtime assets

## 4.3 Accessibility acceptance
Mandatory checks include:

- keyboard reachability of primary actions
- visible focus
- modal/drawer focus containment where applicable
- Escape-close behaviour where applicable
- sensible accessible names for icon-only controls
- contrast guards retained from the existing suite
- no critical automated accessibility violations in the protected surfaces if an accessibility runner is added

v1.26 may use a lightweight internal accessibility assertion layer without introducing a large new UI framework.

## 4.4 Visual regression
Create deterministic screenshots for protected surfaces at agreed desktop/mobile sizes in light and dark mode. Screenshot comparison must use explicit tolerances and approved baselines stored with the test assets or CI artifacts.

The objective is to detect accidental legacy-CSS overrides, low-contrast regressions, broken layout and hidden controls. Visual diffs supplement, not replace, semantic tests.

## 4.5 Database acceptance
PGlite-backed Accounting, Workspace and Project database suites become mandatory in dependency-enabled CI/release verification.

The release package may still be deployable without development dependencies, but the release process must retain evidence that those suites ran before packaging.

## 4.6 Release evidence
The v1.26 audit records:

- source-tree unit/integration results
- canonical identity/permission tests
- audit-authority tests
- router tests
- browser acceptance results
- visual-regression results
- database-backed results
- production build
- dist runtime validation
- release asset audit
- exact ZIP fresh-extraction verification
- SHA-256 checksum

A missing mandatory gate is reported as a release blocker, not silently downgraded to a known limitation.

---

# 5. Design and Settings Experience

## 5.1 Visual direction
Use the existing Executive Premium Steel Blue token system. Foundation Authority adds no new decorative colour family.

Permission Inspector and Audit surfaces should be dense, calm and diagnostic:

- neutral cards and tables
- Steel Blue selection/focus
- green only for positively allowed/successful state
- amber for conditional/approval/escalation state
- red for denied/critical/security-risk state
- clear text explanations beside icons and pills

## 5.2 Permission Inspector layout
Recommended hierarchy:

1. user selector and identity summary
2. effective-access summary
3. module/operation matrix
4. financial visibility
5. location scope
6. approval authority
7. explanation panel for selected rule

The inspector must clearly distinguish:

- inherited from role
- explicit user grant
- explicit user deny
- blocked by location scope
- blocked by approval threshold
- Admin authority

---

# 6. Migration and Compatibility

## 6.1 User migration
On load/review:

- `User` becomes `Office` in effective memory.
- canonical role values are preserved.
- unknown values become `Office` with a diagnostic event.
- no staff account is deleted.
- no Supabase Auth identity is recreated.

## 6.2 Permission migration
Existing `securityControl.rolePermissions`, `userOverrides`, `locationScopes`, `financialVisibility` and `approvalLimits` remain authoritative configuration and are not reset.

Legacy per-user `permissions` maps remain readable as a compatibility input only where the existing permission engine currently supports them. New edits should use the canonical Settings security model.

## 6.3 Audit migration
Do not bulk-convert all historic module history into canonical audit events because that risks inventing missing actor/context information. Historical arrays remain searchable as legacy history. Canonical `auditEvents` starts with v1.26 events plus only explicitly reliable carry-forward mappings.

## 6.4 Route migration
Existing internal state remains supported. Stable routes are an additional authoritative navigation interface, not a requirement to rewrite every workspace in one release.

---

# 7. Failure Handling

- Identity authority unavailable during boot: fail closed for protected operations and show a recoverable system error rather than falling back to broad legacy access.
- Permission engine unavailable: protected modules/actions remain denied except the minimal authenticated shell required to show the error.
- Audit write failure for a high-risk action: the action must not be represented as audited. For security/configuration mutations owned by v1.26, abort the mutation and notify the user. Existing business modules integrated opportunistically may retain their current transaction semantics but must surface the audit failure.
- Invalid route: open Dashboard or nearest safe parent and show a non-destructive message.
- Record missing: do not create a placeholder record.
- Permission denied: do not reveal record metadata beyond what the user already supplied in the URL.
- Browser history route parse error: normalize to a safe route with `replaceState`/hash replacement, not an infinite redirect.
- Test dependency missing in CI/release: fail the quality gate.

---

# 8. Testing Contract

Automated tests must prove at least:

## Identity and permission
- all eight canonical roles round-trip through Supabase profile mapping code
- `User` normalizes to `Office`
- unknown role normalizes safely and produces a diagnostic path
- legacy `canAccessTab` delegates to canonical authority
- explicit deny wins
- explicit grant works where allowed
- financial visibility works
- location scoping works
- approval limits and escalation work
- Azzy/Automation/Analytics/Notifications consume canonical authority
- disabled account remains blocked
- Permission Inspector explanations identify the actual blocking/granting rule

## Audit
- canonical event schema is complete
- sensitive fields are redacted/rejected
- normal API exposes no mutation/delete operation
- Settings security changes create canonical events
- export event is itself audited
- record/user query works
- legacy history is not falsely converted into canonical history

## Router
- each supported route maps to the correct existing module/selected record
- href generation is deterministic
- invalid/missing record fails safely
- permission denial fails safely
- Notifications route through the router
- reload restores a pending authenticated deep link
- Back/Forward works without render loops

## Quality gate
- clean dependency install can run PGlite tests
- clean dependency install can run browser tests
- protected light/dark desktop/mobile screenshots exist
- browser suite contains no uncaught page errors
- production build and dist runtime validate
- old v1.25 Notifications and v1.24 visual/interaction contracts continue to pass

---

# 9. Release and Versioning

Release name:

**Pool Shed v1.26.0 Foundation Authority**

Service-worker cache namespace:

```text
pool-shed-v1.26.0-foundation-authority
```

The release must update package version, index asset cache-busters, login footer, production readiness version, service-worker namespace and release metadata consistently.

The v1.25 Notifications Command remains part of the product and must be regression-tested as a protected retained subsystem.

---

# 10. Acceptance Criteria

v1.26.0 is acceptable only when all of the following are true:

1. Supabase staff profiles preserve every canonical Pool Shed business role.
2. No maintained access decision depends on the legacy three-role matrix as independent authority.
3. Settings can explain why a selected user can or cannot perform a selected operation.
4. New security/configuration changes produce canonical append-only audit events.
5. High-risk integrated business actions produce canonical events where safe hooks exist.
6. Stable deep links open existing authoritative records with permission checks.
7. Notifications use the canonical router.
8. Browser Back/Forward and authenticated reload are supported for stable routes.
9. Playwright/browser acceptance is installable and actually runs in the release environment.
10. PGlite database acceptance is installable and actually runs in the release environment.
11. Protected light/dark/mobile/desktop visual checks run without unreviewed regressions.
12. v1.25 Notifications Command and the Executive Premium interaction/contrast contracts remain intact.
13. Production build, dist validation and release asset audit pass.
14. The exact packaged ZIP is re-extracted and re-verified before being declared the new master.

