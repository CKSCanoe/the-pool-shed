# Pool Shed v1.27.0 - My Work & Action Authority Design

## Purpose

Pool Shed v1.27.0 adds a single operational work authority above the existing Sales, CRM, Projects, Purchasing, Inventory, Warehouse, Fulfilment, Finance, Automation and Notifications modules.

Notifications remain awareness: something happened.

Actions become responsibility: somebody must do something, by a defined time, against an authoritative Pool Shed record.

Approvals become controlled decisions: a user with the required authority must explicitly approve or reject a proposed high-risk command before the owning module performs it.

v1.27 must preserve the v1.26 Foundation Authority contracts for canonical identity/permissions, append-only audit events, permission-safe routing and release quality gates. It must preserve the v1.25 Notifications Command and must not turn every notification into an Action.

## Release boundary

### In scope

- Canonical Action Authority.
- Canonical Approval Authority.
- My Work workspace.
- Personal and role/team queues.
- Owner, role queue, priority, due date, SLA, lifecycle, snooze and completion evidence.
- Permission-safe links to authoritative business records.
- Automatic action generation from selected existing operational exceptions.
- Deduplication and refresh of recurring exceptions.
- Approval requests for selected high-risk operations that already have a clear authority point.
- Escalation and notification integration.
- Audit integration through v1.26 Audit Authority.
- Initial operational metrics for work ageing and resolution.
- Executive Premium Steel Blue visual treatment in light and dark modes.
- Responsive and keyboard-accessible behaviour.

### Not in scope

- Commercial Pipeline / CRM enquiry management.
- Customer Site / Equipment Register.
- Service Command / engineer diary replacement.
- Xero live connection.
- Teams or email delivery activation.
- A new project-management system.
- Replacing existing Sales Order, PO, Project, Finance, Warehouse or stock records.
- Automatically converting all historic notifications into Actions.
- Rebuilding the application persistence architecture in this release.

## Product principles

1. **One work authority.** Modules may raise or resolve work, but must not invent parallel task formats.
2. **Source records remain authoritative.** An Action references a PO, Sales Order, Project, Customer, stock issue, Finance item, Automation run or system record. It does not duplicate the source record.
3. **Awareness is not responsibility.** Notifications and Actions remain separate concepts.
4. **Approval is not mutation.** An Approval authorises a command. The owning module performs the business mutation after approval and rechecks permissions.
5. **No duplicate nagging.** A recurring exception refreshes the existing open Action through a deterministic dedupe key rather than creating repeated Actions.
6. **Every open Action has accountable ownership.** Ownership may be a named user, a role/team queue, or both.
7. **Snooze does not equal complete.** Snoozed work returns when the snooze date expires.
8. **Completed work carries evidence.** Completion records who completed it, when, and optionally the resolution note/evidence.
9. **Permission safety is end to end.** A user cannot discover, open, assign or approve work outside their v1.26 authority.
10. **Audit all high-risk decisions.** Approval request, approval/rejection, reassignment, privileged completion, and controlled source commands emit canonical audit events.

## Canonical Action data model

The current workspace gains `data.actionAuthority` with this shape:

```js
{
  actions: [],
  approvals: [],
  sourceState: {},
  metricsState: {},
  version: 1
}
```

An Action uses the following canonical contract:

```js
{
  id: "ACT-...",
  dedupeKey: "purchase-order:PO-1042:delivery-overdue",
  kind: "exception" | "task" | "follow_up" | "review" | "system",
  category: "sales" | "customer" | "project" | "purchasing" | "inventory" |
            "warehouse" | "fulfilment" | "finance" | "automation" | "system",
  title: "Supplier delivery overdue",
  summary: "4 lines remain outstanding from Certikin.",
  priority: "low" | "normal" | "high" | "critical",
  status: "open" | "in_progress" | "waiting" | "completed" | "cancelled",
  ownerUserId: "",
  ownerRole: "Purchasing",
  createdAt: "ISO timestamp",
  updatedAt: "ISO timestamp",
  dueAt: "ISO timestamp or empty",
  slaDueAt: "ISO timestamp or empty",
  snoozedUntil: "ISO timestamp or empty",
  waitingReason: "",
  source: {
    module: "purchaseorders",
    type: "purchase_order",
    id: "PO-1042",
    route: "#/purchase-orders/PO-1042"
  },
  context: {
    customerId: "",
    projectId: "",
    salesOrderId: "",
    supplierId: "",
    locationId: ""
  },
  resolution: {
    completedBy: "",
    completedAt: "",
    note: "",
    evidence: []
  },
  escalation: {
    level: 0,
    escalatedAt: "",
    notifiedUserIds: []
  },
  origin: {
    sourceType: "rule" | "manual" | "automation" | "system",
    sourceId: "",
    firstDetectedAt: "ISO timestamp",
    lastDetectedAt: "ISO timestamp"
  }
}
```

### Action lifecycle

Normal lifecycle:

`open -> in_progress -> waiting -> completed`

Permitted alternatives:

- `open -> completed`
- `open/in_progress/waiting -> cancelled`
- `waiting -> in_progress`
- `completed -> open` only through an explicit reopen command with reason and audit event.

`waiting` requires a waiting reason. `completed` requires the completing user and completion timestamp. Reopen requires a reason.

### Ownership

An Action may have:

- a named owner only;
- a role queue only;
- a named owner plus the role queue it originated from.

If an Action is created for a role queue and has no named owner, eligible users can claim it. Reassignment is permission-checked and audited.

Initial role queues use the v1.26 canonical roles:

- Management
- Accounts
- Sales
- Purchasing
- Warehouse
- Engineer
- Office

Admin has visibility across all queues but is not automatically made the owner.

## Canonical Approval data model

Approval records live in `data.actionAuthority.approvals`:

```js
{
  id: "APR-...",
  dedupeKey: "stocktake:LOC-01:ST-2026-09-18",
  type: "stock_variance" | "stock_writeoff" | "manual_reallocation" |
        "price_override" | "margin_override" | "purchase_order" |
        "project_commercial" | "credit" | "system_change",
  status: "pending" | "approved" | "rejected" | "withdrawn" | "expired",
  title: "Approve stock take variance",
  summary: "Leominster stock take contains 7 variance lines.",
  requestedBy: "user-id",
  requestedAt: "ISO timestamp",
  ownerRole: "Management",
  assignedApproverId: "",
  requiredPermission: "inventory.approve",
  requiredLimit: 0,
  value: 0,
  currency: "GBP",
  reason: "",
  decision: {
    decidedBy: "",
    decidedAt: "",
    note: ""
  },
  source: {
    module: "inventory",
    type: "stocktake",
    id: "ST-...",
    route: "#/inventory/..."
  },
  command: {
    name: "postStocktake",
    payload: {}
  },
  createdActionId: "ACT-..."
}
```

Approval `command.payload` must contain only the minimum data required to identify the proposed operation. Secrets and large source objects must never be copied into the approval record.

### Approval execution contract

1. Requesting module calls Approval Authority.
2. Approval Authority validates requester permission and creates one pending approval using a deterministic dedupe key.
3. A corresponding Action is assigned to the correct approver or role queue.
4. Approver opens the authoritative source record before deciding.
5. Approver selects Approve or Reject and supplies a note when required by the command type.
6. Approval Authority rechecks approver role, module permission and configured approval limit.
7. Approval is marked approved/rejected and audited.
8. For approval, the owning module command is invoked through a registered command handler.
9. The owning module rechecks current state and permission before mutating data.
10. Mutation produces its own canonical audit event.
11. Linked Action is completed or returned to the requester if the source command can no longer be applied.

Approvals are therefore not a generic arbitrary-code executor. Only explicitly registered commands can be approved.

## Public APIs

### Action Authority

Global authority:

```js
window.PoolShedActionAuthority
```

Required interface:

```js
create(input)
upsertFromException(input)
get(id)
list(options)
claim(id)
assign(id, { userId, role, reason })
start(id)
wait(id, { reason, snoozedUntil })
snooze(id, until, reason)
complete(id, { note, evidence })
cancel(id, reason)
reopen(id, reason)
refreshSources()
summary(options)
```

`upsertFromException()` is the preferred interface for recurring system-generated exceptions. It uses `dedupeKey`, preserves `firstDetectedAt`, updates `lastDetectedAt`, refreshes current context, and does not create another open Action for the same unresolved exception.

### Approval Authority

Global authority:

```js
window.PoolShedApprovalAuthority
```

Required interface:

```js
request(input)
get(id)
list(options)
approve(id, { note })
reject(id, { note })
withdraw(id, { note })
registerCommand(name, handler)
```

Registered command handlers receive the approved record plus a fresh source lookup, not a stale copied record.

## Initial exception sources

v1.27 will integrate only exception types with a clear owner and resolution path.

### Purchasing

- PO delivery overdue with outstanding quantity.
- PO line missing supplier ETA after chase/review threshold.
- PO received with missing lines that require supplier follow-up.

Default owner queue: Purchasing.

### Sales

- Sales Order cannot fulfil because required stock remains uncovered by stock, transfer or linked PO.
- Shipped Sales Order awaiting billing review when current Finance logic identifies the condition.

Default owner queue: Sales for commercial/customer action; Accounts for billing review.

### Inventory / Warehouse

- Stock take submitted for approval.
- Material stock variance requiring review.
- Damaged stock/write-off requiring approval.
- Receiving discrepancy / quarantine exception requiring resolution.

Default owner queue: Warehouse, with approval routed to Management/Admin according to configured permission and limit.

### Projects

- Forecast margin below configured project target.
- Project forecasting a loss.
- Ready billing stage not yet queued for billing.

Default owner queue: Management for commercial risk; Accounts for billing stage review where appropriate.

### Finance

- Existing Finance attention item that has an explicit resolution route.
- Customer credit exposure requiring review.
- Three-way-match exception that requires Accounts intervention.

Default owner queue: Accounts.

### Automation / System

- Failed Automation Command run where retry/manual review is required.
- Automation approval request.
- Selected admin/system condition that already has a specific remedial action.

Default owner queue: originating configured role, otherwise Admin/Management depending on authority.

### Project Purchasing

Existing `salesOrders` remain the business/source record. Where a request needs assignment or follow-up, Action Authority references it rather than replacing it.

Default owner queue: Engineer or Office depending on request type/configuration.

## Exception source refresh

`refreshSources()` scans supported source adapters and calls `upsertFromException()`.

Rules:

- An unresolved source exception creates one Action.
- Repeated scans update that Action's context and `lastDetectedAt`.
- If the source condition is resolved by the authoritative module, the source adapter may auto-complete the Action only when resolution is objectively provable.
- If resolution requires human confirmation, the Action remains open until a user completes it.
- Closed exceptions are not reopened unless the source becomes materially unresolved again after closure. Reopening creates an audited transition on the same Action when identity is continuous, otherwise a new dedupe generation may be used.

## SLA and escalation

v1.27 includes a small, deterministic SLA model rather than a configurable workflow builder.

Defaults:

- Critical: due within 4 working hours where a due date is not supplied.
- High: due within 1 working day.
- Normal: due within 3 working days.
- Low: due within 5 working days.

Source adapters may provide a business due date that overrides the default.

Escalation behaviour:

- Due soon: visual emphasis only.
- Overdue: Action appears in Overdue and creates/updates one notification to owner/queue.
- Materially overdue: escalation level increments once per configured threshold and may notify Management.

No repeated notification is emitted on every refresh. Notification dedupe keys are tied to Action ID plus escalation level.

## My Work workspace

### Navigation

Add a first-class primary destination: `My Work`.

The workspace is designed as the operational start surface, while Dashboard remains management/business overview.

### Personal view

Default tabs:

- Today
- Overdue
- Upcoming
- Waiting
- Approvals
- Completed

Top summary:

- Due today
- Overdue
- High/Critical
- Waiting
- Approvals requiring my decision

Action cards/rows show:

- priority
- title
- source record and customer/project/supplier context where permitted
- owner / queue
- due date / age
- current status
- one primary next action
- Open record
- lifecycle actions appropriate to permission and status

### Team view

Management/Admin can toggle `My Work` / `Team`.

Team view supports:

- role queue filter
- owner filter
- status
- priority
- overdue only
- unassigned only
- source module

It shows workload and ageing, not employee ranking or gamified scoring.

### Approval inbox

Approvals tab separates:

- Needs my decision
- Requested by me
- Recently decided

Approval cards show the authoritative source, requester, reason, monetary/value exposure where relevant, required authority and safe approve/reject actions.

## Notification integration

v1.25 Notifications Command remains the awareness channel.

Action Authority uses `PoolShedNotificationsCommand.create()` only for meaningful lifecycle events such as:

- Action assigned directly to a user.
- Action becomes overdue.
- Escalation level changes.
- Approval requested from a named user/role queue.
- Approval decided.
- Action reopened.

Opening a notification routes either to the Action/Approval inside My Work or to the authoritative source record as appropriate.

Marking a notification read never completes an Action.

Completing an Action does not delete notification history.

## Permission model

All authority comes from v1.26 Identity/Permission Authority.

Rules:

- A user can only see an Action if they can see its source module and it is assigned to them, their eligible role queue, or they have Management/Admin team visibility.
- A user cannot claim work for a module they cannot access.
- Reassignment to another role/user requires appropriate management/admin authority or a module-specific assignment permission.
- Approval decisions require both source-module access and the configured approval permission/limit.
- Audit and route checks occur again at decision/execution time.
- Removing a user's permission immediately removes visibility/actionability even if an Action was previously assigned to them.

## Audit integration

Use `PoolShedAuditAuthority.append()` for:

- manual Action creation where privileged
- assignment/reassignment
- cancellation
- reopening
- approval request
- approval approve/reject/withdraw
- command execution result
- privileged SLA/ownership changes

Routine transitions such as an ordinary user starting their own Action may be retained in Action history without flooding the canonical high-risk audit stream, unless the source command is sensitive.

Each Action maintains lightweight lifecycle history for operational context:

```js
history: [
  { at, by, event, note }
]
```

Canonical Audit Authority remains immutable security/business audit. Action `history` is operational history.

## Metrics

v1.27 exposes governed work metrics for future Analytics and Management surfaces:

- open Actions
- overdue Actions
- Actions by role queue
- Actions by source category
- median/average resolution time
- unassigned Actions
- approval turnaround time
- approval pending age
- recurring dedupe keys / repeated exception count

No individual employee score, league table or opaque productivity rating is added.

## Visual design

The workspace follows Executive Premium Steel Blue authority.

- Neutral structural surfaces.
- Steel Blue for selection, links, primary actions and ownership focus.
- Green only for genuine completed/approved state.
- Amber for waiting/attention.
- Red only for critical/overdue/rejected/destructive meaning.
- Dense but readable information hierarchy.
- Minimum established micro-copy size.
- No emoji as structural icons.
- Controlled SVG/icon assets where icons are required.
- Light and dark theme parity.
- Reduced-motion support.
- Keyboard operability and visible focus.
- Responsive mobile view with filters collapsing into a controlled filter surface.

## Persistence

v1.27 continues using the current canonical Pool Shed workspace save path because the transactional Supabase migration is scheduled for a later release.

Action/Approval records are persisted under `data.actionAuthority` and therefore participate in the same canonical save/sync flow.

No second browser-only task database is introduced.

The later transactional-data programme may migrate these collections into proper Supabase tables without changing the public Action/Approval APIs.

## Failure handling

- Missing source record: show Source unavailable, retain Action history, allow authorised cancellation/closure with reason.
- Lost permission: hide source details and block source command.
- Duplicate exception: merge/update existing open Action through dedupe key.
- Invalid owner: return to eligible role queue, do not silently assign another person.
- Approval source changed after request: block command execution and return approval/action to review with an explicit stale-source reason.
- Approval command handler missing: do not approve as applied; mark execution failure and notify Admin/Management.
- Save failure: do not report successful lifecycle change if canonical save fails.
- Notification failure: Action/Approval remains authoritative; notification delivery failure does not roll back the work record.

## Migration / upgrade behaviour

On first v1.27 load:

- create `data.actionAuthority` if absent;
- do not convert old neutral notifications into Actions;
- scan current supported exception sources;
- create Actions only for conditions that are still unresolved at upgrade time;
- dedupe against existing current actions if the build is reloaded;
- preserve existing `salesOrders`, Automation approvals, stocktake state and all business source records;
- preserve v1.25 `notificationCommand` read/archive state;
- preserve v1.26 identity, audit and route state.

## Test strategy

Dedicated v1.27 automated tests must cover:

1. Action creation and canonical defaults.
2. Deterministic exception deduplication.
3. Ownership, claim and reassignment permissions.
4. Lifecycle transition guards.
5. Snooze and waiting behaviour.
6. Completion evidence and reopen reason.
7. Source permission filtering.
8. Source record routing through v1.26 Record Router.
9. Approval request deduplication.
10. Approval permission and limit checks.
11. Approval stale-source blocking.
12. Registered approval command execution.
13. Audit events for high-risk transitions.
14. Notification creation without Notification/Action coupling.
15. Purchasing exception adapter.
16. Sales shortage/billing adapters.
17. Stocktake/warehouse exception adapters.
18. Project commercial-risk adapter.
19. Finance exception adapter.
20. Automation/engineer request adapters.
21. Upgrade behaviour from v1.26/v1.25 data.
22. My Work workspace permissions and filtering.
23. Team view Management/Admin restriction.
24. Approval inbox behaviour.
25. Executive Premium visual/contrast/readability rules.
26. Light/dark responsive Chromium acceptance.
27. Production build/runtime asset wiring.
28. Preservation of v1.26 Foundation Authority and v1.25 Notifications Command.

## Release acceptance

v1.27.0 can become a certified master only when all of the following pass on the exact packaged release:

1. Dedicated Action Authority suite.
2. Dedicated Approval Authority suite.
3. My Work workspace/integration suite.
4. Source adapter/deduplication suite.
5. v1.26 Foundation Authority suite.
6. v1.25 Notifications Command suite.
7. Retained Sales, CRM, Projects, Product Hub, Purchasing, Inventory, Warehouse, Fulfilment, Finance, Analytics, Automation and Settings regression guards.
8. Executive Premium light/dark semantic contrast and readability guards.
9. Public runtime validation.
10. Production build.
11. Built `dist` runtime validation.
12. Release asset audit with all referenced assets present and JavaScript parsing.
13. Real Chromium workflow acceptance including My Work and Approvals.
14. Database-backed release suites in the dependency-enabled release environment.
15. Fresh extraction of the final ZIP followed by the same focused v1.27, Foundation, Notifications, build/runtime and asset checks.

If database-backed acceptance is unavailable, the package may be labelled a release candidate but must not replace the last certified master.

## Future integration point for the next tool

The next tool must integrate through stable interfaces rather than write directly into module internals:

- create/refresh owned work through `PoolShedActionAuthority`;
- request controlled decisions through `PoolShedApprovalAuthority`;
- create awareness through `PoolShedNotificationsCommand`;
- navigate through `PoolShedRecordRouter`;
- evaluate access through v1.26 Permission Authority;
- record sensitive actions through `PoolShedAuditAuthority`.

This is the primary reason v1.27 keeps Actions and Approvals as standalone authorities: a future tool can create work, ask for approval, notify staff and route to records without inventing another task/notification/permission model.
