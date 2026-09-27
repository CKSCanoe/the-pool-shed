# Pool Shed v1.19.0 Settings, Users & Permissions Release Audit

## Release
- Version: 1.19.0
- Baseline: v1.18.0 Automation Command + Smart Assistant
- Selected design: Option C, Role + Permission + Approval Control
- Date: 2026-09-16

## Delivered authority surface
Settings is now the single control surface for:
- Overview / Security Health
- Users
- Roles & Permissions
- Approval Limits
- Locations & Access
- Financial Visibility
- Automation & Assistant
- Integrations
- Notifications
- Company Settings
- Audit & Security

## Permission model
Base roles:
- Admin
- Management
- Accounts
- Sales
- Purchasing
- Warehouse
- Engineer
- Office

Granular operations:
- View
- Create
- Edit
- Delete
- Export
- Approve
- Override
- Configure

Effective access is evaluated from base-role permissions plus deliberate user overrides. Explicit user deny overrides take precedence over a base-role grant. Legacy `User` profiles normalise to Office while existing Supabase-linked user IDs remain intact.

## Approval controls
Independent approval authority is provided for:
- Purchase Orders
- Supplier payments
- Customer credit-limit changes
- Stock write-offs
- Price overrides
- Margin exceptions
- Automation activation

Creating or editing a record does not automatically grant authority to approve it.

## Location scope
Per-user location scope controls access to warehouses, vans and other stock locations. This scope is also used by the Smart Assistant when calculating or describing stock, so restricted users cannot retrieve stock from unauthorised locations through Find Anything or Ask.

## Financial visibility
Sensitive financial fields are separately governed:
- Customer balances
- Customer credit limits
- Supplier costs
- Product margins
- Supplier balances / bills
- Payment runs
- Project commercial margin
- Full-system financial exports

## Assistant, Automation and Analytics enforcement
The central permission authority is consumed by:
- Legacy navigation/sidebar access
- Smart Assistant module retrieval
- Smart Assistant stock/location retrieval
- Automation creation/edit/activation authority
- Analytics Full System Export

The assistant remains Pool Shed-only for operational answers and does not gain broader access than the signed-in user.

## Settings interactions
Implemented production interactions include:
- Role Builder permission toggles
- User role/status editing
- Add user profile linked to a Supabase User UID
- View System As User permission preview
- Approval limit editing and route test
- Location-scope matrix
- Financial-visibility matrix
- Assistant profile / PNG avatar / Knowledge / Alias settings retained from v1.18
- Integration health/review actions with masked-secret policy
- Notification-channel controls
- Company details editing
- Security audit table and CSV export

## Security audit
Permission, role, location, financial-visibility, approval, company, integration and security-review changes create audit events with actor, timestamp, target and reason where applicable.

## Cross-system enforcement test
A dedicated v1.19 test verifies that an Engineer-restricted user:
- cannot retrieve Accounting records through the assistant;
- sees only stock inside authorised location scope;
- cannot generate Analytics Full System Export;
- cannot create/edit Automation workflows when the role does not grant that authority.

## Verification
### v1.19 Settings suite
PASS:
- Settings permission roles, overrides, approval limits, location scope, finance visibility and audit
- Settings Command approved Option C structure and action coverage
- Settings permission integration hooks for UI, assistant, automation and analytics
- Settings security enforcement across assistant locations/finance, Analytics export and Automation authority
- Settings Command v1.19.0 runtime, permission ordering, CSS and cache wiring

### Protected regression
PASS across retained Automation/Assistant, Analytics, Finance, Supplier Command, Goods Note Control, Fulfilment, Inventory, Product Hub, Projects, Purchase Orders, Warehouse FIFO/booking and Sales Order authority tests.

### CSS/runtime
- Single authoritative `app.css` build retained.
- `system/53-settings-command.css` added to the stable CSS build chain.
- Runtime release audit reports 49 referenced assets present.
- All public/server/API JavaScript parses.
- Production build passes.

## Known environment limitations
### Database-only tests
The complete validator stops when `scripts/test-accounting-database.mjs` imports `@electric-sql/pglite`, because the extracted runtime does not contain that dependency. This is the same environment boundary recorded on previous releases.

Database-only tests not runnable in this environment include:
- `scripts/test-accounting-database.mjs`
- `scripts/test-workspace-database.mjs`
- `scripts/test-project-database.mjs`

All remaining non-database tests after the boundary were run separately and passed.

### Browser automation
`npm run test:browser` was attempted. The package does not contain Playwright, so automated browser/pixel acceptance is not claimed.

## Release files
- `public/settings-permissions-engine.js`
- `public/settings-command-workspace.js`
- `public/assets/css/system/53-settings-command.css`
- v1.19 Settings test suite under `scripts/`
- design spec and implementation plan under `docs/superpowers/`

## Release status
Code-level, runtime, build and non-database regression gates passed. Database-only and Playwright browser acceptance remain environment-limited as documented above.
