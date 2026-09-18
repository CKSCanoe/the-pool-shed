# Pool Shed Notifications Command Design

## Purpose

Replace the current legacy bell action with a real Notifications Command that gives staff a reliable in-app centre for operational alerts and system updates, while preserving the current Pool Shed data authority and permission model.

## Existing problem

The top-bar notification bell currently routes to Inventory -> Missing Stock rather than opening a notification centre. Pool Shed already creates notification records from Sales Orders, Warehouse/Inventory, Project Purchasing, customer activity and other workflows, but those records do not have one consistent staff-facing command surface.

## Authority and data model

Notifications Command consumes the existing canonical operational data and normalizes it for presentation. It does not create a second editable copy of business records.

Primary sources include:

- `data.notifications`;
- `data.adminNotifications`;
- relevant Automation failure/run records;
- inventory/warehouse alerts that already create notifications;
- recovery/reconstruction events;
- selected system/admin/release events where a staff action is genuinely useful.

A normalized notification view has:

- stable notification ID;
- type/category;
- title;
- short body/message;
- severity: neutral, info, success, warning, critical;
- source module;
- source record type and ID;
- created timestamp;
- target user/role when scoped;
- unread/read state;
- archived/dismissed state where allowed;
- actionable route metadata;
- provenance/source key so duplicate alerts can be collapsed.

Read/archive metadata may be stored separately from immutable operational source records when mutating the source record would be inappropriate.

## Bell behaviour

The top-bar bell opens a right-side Notifications Command drawer without leaving the current screen.

The badge shows the signed-in user's unread actionable count, capped visually at `99+`. The badge hides when the count is zero.

Opening the drawer does not automatically mark every item as read. Reading/opening an item can mark that individual notification read. A `Mark all as read` action is available for the user's currently visible notifications.

## Notification Centre UI

The drawer uses the approved Executive Premium Steel Blue system and supports light and dark modes.

The default view contains:

- header with unread count and `Mark all as read`;
- filters: All, Unread, Critical, Orders, Projects, Purchasing, Stock/Warehouse, Finance, Automation/System;
- grouped chronology, newest first;
- clear severity icon/status without painting entire rows saturated colours;
- title, short message, timestamp and source label;
- primary action such as `Open Sales Order`, `Open Customer`, `Open Project`, `Open PO`, `Review Stock`, `Open Automation`, `Review Recovery`;
- secondary `Mark read/unread` and, where allowed, `Archive` actions.

A full-page Notification History view can be opened from the drawer for older or archived items without cluttering the bell interaction.

## Routing

Notification actions route into existing authority screens, not duplicate detail views.

Supported destinations include:

- Sales Order detail;
- Customer profile;
- Project Details;
- Purchase Order/Supplier Command;
- Inventory/Warehouse exception;
- Fulfilment/Goods Note;
- Finance customer/supplier document;
- Project Purchase Demand;
- Automation/Azzy run or failure;
- Settings/Production Readiness;
- Legacy Data Reconstruction review.

If the referenced record no longer exists or the current user lacks access, Notifications Command shows a safe unavailable/permission message instead of navigating incorrectly.

## Permissions

Notifications are filtered through the existing module and location/financial visibility permissions. The bell must never expose a Finance, Customer, Stock location or Admin record that the signed-in user cannot otherwise access.

Admin-only system/security/recovery notices remain Admin-only.

## Notification generation

Existing notifications continue to work. New modules should use a small shared notification API rather than pushing ad hoc display-only objects.

The shared API accepts category, title, message, severity, source module, source ID, route, audience and dedupe key. It writes into the canonical notification stream or appropriate system-notification stream and then uses normal Pool Shed persistence.

Recovery/reconstruction generates notifications for scan completion, conflicts requiring review, backup creation, successful apply and failed apply.

## Deduplication and lifecycle

Repeated checks must not generate the same alert every render. Notifications use stable source/dedupe keys for conditions such as low stock, late PO, automation failure or recovery conflict.

Condition-based alerts may be resolved or archived when the underlying condition clears, while historical audit-worthy events remain available in Notification History.

## Settings integration

Settings -> Notifications remains the governance surface for channel/routing rules. The existing In App/Email/Teams concepts are retained, but v1.25 focuses on making `In App` fully functional. Email and Teams are not activated merely by this UI upgrade unless an existing connected implementation already supports them.

## Accessibility and interaction

- Bell has accessible name and expanded state.
- Drawer traps focus while open and closes with Escape or close button.
- Keyboard navigation works for filter tabs and notification actions.
- Text/background contrast meets WCAG AA for normal text.
- Severity is communicated with text/icon, not colour alone.
- Hover/focus states follow the v1.24.2 interaction authority.

## Failure handling

- Corrupt notification entry is skipped and logged, not allowed to break the drawer.
- Invalid route leaves the item visible and marks its action unavailable.
- Save/read-state failure shows a non-destructive error and does not lose source notifications.
- Permission changes immediately affect visibility on the next render.

## Testing and acceptance

Automated tests must prove:

- bell opens Notifications Command and no longer routes to Missing Stock;
- unread count is user/permission scoped;
- zero count hides the badge;
- individual read/unread and Mark All work;
- filters return correct categories;
- direct routes open the correct existing module/record;
- inaccessible records are not exposed;
- notification dedupe works;
- recovery events appear for Admin users;
- Settings notification rules remain intact;
- light/dark visual and contrast contracts pass;
- no regression to v1.24.2 navigation/button authority.

The feature is accepted when the bell is a useful daily operational centre rather than a shortcut to one Inventory report.
