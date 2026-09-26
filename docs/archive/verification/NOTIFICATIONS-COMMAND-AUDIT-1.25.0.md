# Pool Shed v1.25.0 Notifications Command Audit

## Release purpose

Pool Shed v1.25.0 replaces the legacy top-bar notification shortcut with a first-class Notifications Command while retaining v1.24.2 Interaction & Navigation Authority as the protected visual and operational baseline.

Legacy business-data reconstruction is not part of this release.

## Staff experience

- The top-bar bell opens a right-side operational inbox without leaving the current screen.
- The bell uses a controlled vector icon rather than platform emoji rendering.
- The unread badge uses the Executive Premium Steel Blue action accent, not success or danger colour.
- The drawer provides All, Unread, Critical, Orders, Customers, Projects, Purchasing, Stock/Warehouse, Finance and Automation/System filters.
- Search covers notification text, record identifiers, categories and source modules.
- Notifications are grouped chronologically and show restrained severity markers, source metadata and direct record actions.
- Individual notifications can be marked read/unread or archived/restored.
- Mark all as read affects the currently visible permission-scoped inbox.
- Notification History exposes archived and older records without cluttering the live inbox.
- The drawer closes with Escape/backdrop/close, restores trigger focus and traps keyboard focus while open.

## Data authority

Notifications Command does not duplicate Sales Orders, Customers, Projects, Purchase Orders, stock, Finance or Automation records.

The engine normalizes existing sources including:

- `data.notifications`
- `data.adminNotifications`
- Automation Command alerts
- failed Automation Command runs
- failed legacy automation logs

Per-user lifecycle state is stored only in `data.notificationCommand`:

- read/unread state
- archive state
- first v1.25 notification baseline

Historic neutral records do not become a large unread backlog on first upgrade. Existing unresolved warning/critical records still surface as unread, and new records after the user's v1.25 baseline become unread normally.

## Permissions

Visibility is filtered through existing Pool Shed module permissions. Admin notifications remain Admin-only. Direct record actions re-check module access before navigation and return a safe unavailable/permission response when the user cannot open the target or the referenced record no longer exists.

Supported routing includes:

- Sales Orders
- Customers
- Project Details
- Purchase Orders and Suppliers
- Inventory
- Warehouse
- Fulfilment / Goods Notes
- Finance / Accounting
- Automation
- Settings

## Shared notification API

`PoolShedNotificationsCommand.create()` provides a future-facing in-app notification API with category, title, message, severity, source module/type/ID, route, audience and dedupe key.

Automation Command exposes `emitNotification()` through that shared API. v1.25 does not enable Email or Teams delivery. Settings -> Notifications remains the governance surface for those channels.

## Visual authority

Notifications Command is implemented in `system/57-notifications-command.css` and compiled into the single production `app.css` bundle.

The module:

- uses Executive Premium semantic tokens only;
- owns no literal hex/rgb colours;
- keeps Steel Blue for primary actions/selection/unread emphasis;
- keeps green/amber/red for genuine semantic state;
- passes the shared structural-surface colour guard;
- meets the shared 4.5:1 direct semantic contrast gate in light and dark mode;
- uses the established micro-copy size floor;
- supports reduced motion and responsive mobile layout.

## Release wiring

- Release: `1.25.0`
- Service worker: `pool-shed-v1.25.0-notifications-command`
- Engine: `public/notifications-command-engine.js`
- Workspace: `public/notifications-command-workspace.js`
- CSS: `public/assets/css/system/57-notifications-command.css`
- Design spec: `docs/superpowers/specs/2026-09-17-notifications-command-design.md`
- Implementation plan: `docs/superpowers/plans/2026-09-17-notifications-command.md`

## Verification evidence

Fresh source-tree verification includes:

- Notifications Command engine, workspace, visual, routing, integration and release tests.
- v1.24.2 interaction contrast/navigation contract.
- v1.24.1 contrast-cascade and shell-surface guards.
- v1.24 Executive Premium visual, theme contrast and semantic-surface guards.
- Login, Sales Orders, Project Details, Purchasing, Inventory, Warehouse, Fulfilment, Finance, Automation and Settings retained guards.
- CSS architecture, visual consistency, colour contrast and readability hardening.
- Public runtime validation.
- Production build and `dist` runtime validation.
- Release asset audit.

## Environment-only acceptance boundaries

The broad validator reaches `scripts/test-accounting-database.mjs` and then cannot start that database-only test because the extracted package does not contain the development dependency `@electric-sql/pglite`. Non-database suites after that boundary are run separately.

Automated browser smoke cannot start because the extracted package does not contain `playwright`. Browser/pixel automation is therefore not claimed as passed.
