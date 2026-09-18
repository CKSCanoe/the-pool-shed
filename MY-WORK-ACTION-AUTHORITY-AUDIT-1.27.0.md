# Pool Shed v1.27.0 - My Work & Action Authority Release Audit

## Release purpose

v1.27.0 turns Pool Shed operational exceptions into owned, measurable work while preserving v1.26 Foundation Authority and v1.25 Notifications Command.

Notifications remain the awareness layer. Actions represent work that somebody must own and resolve. Approvals represent controlled decisions that must re-check authority at decision time before the authoritative business module performs a mutation.

## Action Authority

The canonical Action Authority supports:

- owner user and role/team queues;
- open, in-progress, waiting, completed and cancelled lifecycle states;
- priority and SLA due dates;
- overdue detection and escalation;
- snooze without false completion;
- claim and reassignment;
- completion evidence/notes;
- stable source record references;
- deduplication so recurring exceptions update one Action rather than create noise;
- permission-scoped listing;
- audit and notification integration.

Operational source adapters currently cover clear resolvable exceptions from Purchasing, Sales, Warehouse, Projects, Finance, Automation and Project Purchasing.

## Approval Authority

The controlled Approval Authority supports:

- requester and approver identity;
- owner role/authority queue;
- value and currency context;
- source record and stable route;
- approve/reject notes and decision timestamp;
- permission and approval-limit rechecks at decision time;
- stale-source protection;
- a controlled command registry rather than arbitrary code execution;
- linked Action lifecycle and canonical audit events.

### Stock Take integration

Inventory Stock Take is the first real high-risk workflow integrated through Approval Authority.

- Submitting a Stock Take creates a controlled Approval request.
- Approval Authority decides whether the operation is authorised.
- Inventory remains the owner of physical stock mutation and executes its own approved decision path.
- Rejection updates Inventory correctly and cannot leave a Stock Take falsely stuck as Submitted.
- The linked Action closes through the same governed lifecycle.

## My Work workspace

The new first-class My Work workspace provides:

- Today;
- Overdue;
- Upcoming;
- Waiting;
- Approvals;
- Completed;
- My Work personal view;
- Management/Admin Team view;
- search, priority and queue filters;
- claim, start, wait, snooze, complete and open-record controls;
- Needs my decision, Requested by me and Recently decided approval views.

Stable record navigation is handled by the retained v1.26 Record Router.

## Design and dark-mode correction

Final browser inspection found that screenshots were initially captured inside the 120 ms light-to-dark control transition, producing a temporary grey appearance. A separate cascade issue also allowed the generic button treatment to mask My Work selected states after the transition.

The final correction:

- waits for the real theme transition before browser visual capture;
- gives selected My Work mode/tab/approval controls scoped `#screen-mywork` authority;
- keeps selected controls on Executive Premium Steel Blue soft selection in light and dark mode;
- adds a browser assertion that fails if selected controls collapse to the neutral surface again;
- uses no new literal colour values and no new `!important` override for this fix.

## Retained v1.26 Foundation Authority

v1.27.0 retains and re-verifies:

- eight canonical Pool Shed staff business roles;
- legacy `User` compatibility mapping to `Office`;
- permission explanations and canonical permission delegation;
- append-only Audit Authority and secret redaction;
- high-risk Automation activation and Analytics export audit hooks;
- stable permission-aware Record Router;
- Permission Inspector and canonical Audit Settings surface;
- required browser/database quality-gate contract.

## Retained v1.25 Notifications Command

The complete Notifications Command engine, workspace, visual authority, routing bridge, integrations and release-retention guards pass on v1.27.0.

## Verification evidence

### v1.27 focused suite

PASS:

- Action Authority lifecycle, dedupe, ownership, permissions, notifications, audit and source refresh;
- Approval Authority dedupe, limits, stale-source blocking, command registry, audit and linked Actions;
- source adapters;
- My Work workspace and Team restriction hooks;
- Executive Premium semantic-token visual contract;
- My Work deep links and Notifications independence;
- Stock Take controlled approval integration;
- v1.27 release/cache/authority wiring.

### Retained Foundation and Notifications

PASS:

- complete v1.26 Foundation suite;
- complete v1.25 Notifications Command suite.

### Executive Premium visual system

PASS:

- v1.24.2 interaction/navigation authority;
- contrast cascade and shell-surface guards;
- light/dark semantic contrast gates;
- semantic structural surface usage;
- colour contrast;
- readability hardening;
- CSS architecture;
- visual consistency;
- contrast/text rhythm.

### Browser acceptance

Real headless Chromium acceptance passes with:

- 13 protected module screens exercised;
- Permission Inspector visible;
- My Work rendered with owned Actions;
- controlled Approval inbox rendered;
- Management/Admin Team view present;
- stable Sales Order deep-link routing;
- denied Finance route permission check;
- light/dark desktop/mobile visual captures;
- no My Work mobile horizontal overflow;
- selected-state dark-mode contrast assertion;
- zero uncaught browser errors.

### Build and runtime

PASS:

- production build;
- public runtime validation;
- built `dist` runtime validation;
- release asset audit: all 60 referenced assets exist and all public/server/API JavaScript parses.

### Full retained application matrix

`npm run validate` passes the application stack through Accounting logic, including the extensive Sales, CRM, Project, Product, Purchasing, Warehouse, Fulfilment, Finance, Analytics, Automation, Settings, visual and runtime suites, then stops when the database-only Accounting test attempts to import PGlite.

Non-database tests after that boundary were run separately and pass:

- Accounting API;
- Project engine;
- Project AI;
- Bundle Product System;
- Dashboard Review;
- Dashboard Command;
- release asset audit.

## Database acceptance environment boundary

The three database-backed suites require `@electric-sql/pglite`. `package.json` correctly declares `@electric-sql/pglite ^0.5.8`, but this execution sandbox cannot resolve the npm registry and does not contain that package locally.

Therefore these automated database tests are not represented as passing in this audit:

- `scripts/test-accounting-database.mjs`;
- `scripts/test-workspace-database.mjs`;
- `scripts/test-project-database.mjs`.

Run `npm ci` followed by `npm run test:database` in connected CI/deployment before treating the database acceptance gate as independently certified.

## Release conclusion

v1.27.0 contains the complete My Work, Action Authority and Approval Authority application update with the approved Foundation and Notifications systems retained. Application, runtime, visual, build, asset and real-browser acceptance are green in this environment. Database-only automated certification remains an explicit external-environment gate because the required PGlite development dependency cannot be installed in this sandbox.
