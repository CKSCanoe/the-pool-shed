# Settings, Users & Permissions Design

## Goal
Make Settings the single authority for identity, access, approvals, sensitive data visibility, locations, automation/assistant permissions, integrations, notifications, company defaults, and security audit across Pool Shed.

## Selected design
Option C: Role + Permission + Approval Control.

## Navigation
Overview; Users; Roles & Permissions; Approval Limits; Locations & Access; Financial Visibility; Automation & Assistant; Integrations; Notifications; Company Settings; Audit & Security.

## Security model
- Base roles: Admin, Management, Accounts, Sales, Purchasing, Warehouse, Engineer, Office.
- Granular permissions: View, Create, Edit, Delete, Export, Approve, Override, Configure.
- Individual user overrides may grant or deny a permission relative to the base role.
- Deny wins over grant when evaluating conflicting overrides.
- Assistant retrieval and actions use the exact signed-in user's effective permissions.
- Automation creation, activation, approval, and sensitive actions are permission controlled.
- Full-system export, margins, supplier costs, customer credit data, payment data, and sensitive financial exports are separately permissioned.
- Location access may restrict warehouse, van, project-stock, and branch records.
- Approval limits are separate from create/edit rights and may be configured by action type.
- Sensitive permission/configuration changes create audit entries and require explicit confirmation in the UI.

## Approval areas
Purchase Order approval; Supplier payment approval; Customer credit-limit change; Stock write-off; Price override; Margin exception; Full-system export approval where configured; Automation activation for controlled workflows.

## Settings Overview
Show users, roles, pending invitations, security health, integrations, recent permission changes, users with Admin access, users missing approval limits, inactive users with access, export access count, and critical configuration warnings.

## Users
List user identity, role, status, locations, approval summary, last activity, MFA/authentication status when available, and individual overrides. Support user detail, role assignment, disable/access review, and View System As This User preview for Admins.

## Role Builder
Matrix grouped by module/area with View/Create/Edit/Delete/Export/Approve/Override/Configure. Use plain operational language. Changes are staged and saved as one auditable role change.

## View as user
Admin preview calculates the selected user's effective permissions and indicates visible navigation, hidden finance/margin/cost fields, allowed locations, export rights, assistant scope, and automation authority. Preview does not impersonate authentication or create business records.

## Financial visibility
Separate controls for customer balances, customer credit limits, supplier costs, product margins, supplier balances/bills, payment runs, project commercial margins, accounting reports, and full-system financial exports.

## Automation & Assistant
Own assistant name/avatar/knowledge/aliases/training, allowed modules, Find Anything access, action preparation, automation creation/activation, approval authority, and Pool Shed-only answer policy. The Pool Shed-only policy cannot be disabled for operational answers.

## Integrations
Connection health and configuration for Xero, Outlook, Teams, APIs/webhooks and future connectors. Credentials/secrets are never rendered back in clear text or included in assistant/search/export payloads.

## Notifications
Manage operational alert subscriptions, delivery channels, escalation recipients, and automation-failure notifications by user/role.

## Company Settings
Company identity, VAT/currency, numbering, payment terms, locations, stock/commercial thresholds, and existing company/email branding settings.

## Audit & Security
Record permission changes, role changes, user status changes, approvals, overrides, exports, integration changes, assistant/automation authority changes, and security-sensitive configuration changes. Keep actor, timestamp, target, before/after summary, and reason when required.

## Compatibility
Preserve existing Supabase authentication profiles and existing section permissions by migrating/normalising them into the new effective-permission model. Do not duplicate authentication or expose secrets.
