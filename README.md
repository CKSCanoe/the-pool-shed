# Pool Shed v1.45.1 · Focused Completion Candidate

Full deployable project based on the v1.45.1 Workspace Audit baseline. Focused completion pass 1 adds multiple project-linked Quote Studio extras/credits, customer-acceptance handover, the required project financial dashboard metrics and project-summary performance indexing. See FOCUSED-COMPLETION-PASS-1.md for the completed scope and verification limits, and WORKSPACE-AUDIT-1.45.1.md for the baseline audit.

 Shared table controls now wrap multiline text inside padded, automatically sized borders. Module navigation stays in the left menu, while individual Sales Order, Project and Purchase Order tabs stay on the record page. Legacy Projects entry points route to the current workspace. Project Settings is only rendered when its record tab is selected.

Project creation captures customer, owner, quote/estimate reference, acceptance evidence, value excluding VAT, initial remaining budget, margin thresholds, risk buffer and goals. The form previews starting profit and margin. Accepted values are locked; subsequent agreed changes use extras. Planning projects remain labelled provisional. Existing quotes already converted to projects should be opened instead of creating another project.

Project Tools supports daily external hire, one-off equipment purchases and allocation of available owned tools. New daily allocations count UK calendar days inclusively, including weekends and bank holidays. A final charge date caps the cost automatically; physical return remains a separate audited action. Open-ended hire accrues through the current date, warns that future hire is not forecast, and can be stopped with a final charge date and reference. Totals are derived whenever viewed, so no daily background write or scheduled job is required. Existing tool allocations retain their original elapsed-day charging basis.

The project forecast includes the full known hire period or purchase cost. Equipment cards also show accrued cost separately. Match actual equipment bills using Costs & margin and the estimate-replaced amount, preventing duplicate costing. New tool or order allocations can explicitly replace a remaining budget allowance. Approved-extra equipment uses its existing extra allowance. Tool assets, assignments and return history use existing shared records.

Database migration `database/011-project-extra-quotes.sql` is required after the existing migrations through 010; no data reset is required. Existing IDs, accepted original quotes, orders, POs, costs and stock remain intact. Existing email configuration is unchanged: RESEND_API_KEY, QUOTE_FROM_EMAIL, APP_ORIGIN and Supabase settings. No email is sent by the tests. This archive has not been deployed.

Verification: `npm run build` includes project hire/date/DST tests, matching-bill and extra-allowance tests, project creation rollback/permission checks, workspace navigation/form checks and existing project/quote/signature/API-mock regressions. Live authenticated browser visual verification remains outstanding. The database integration suite passed using @electric-sql/pglite. The full current validation suite also passed. Historical test limitations are documented in the audit report.


## Repository layout

- `public/` — maintained application source/assets.
- `dist/` — deployable build output retained for this release archive.
- `api/`, `server/`, `database/`, `supabase-setup/` — backend and database resources.
- `scripts/` — build, validation and QA tooling.
- `docs/` — current documentation and design references. Historical release/audit output is under `docs/archive/`.

Generated browser-QA folders (`qa-v*/`) are intentionally excluded from this cleaned archive; the QA scripts recreate them when needed.

## Acceptance introduced in v1.40.0

Quote acceptance now has a separate signing page, with typed and drawn signatures. See [release notes](docs/archive/releases/RELEASE-NOTES-1.40.0.md) for deployment and verification details.

## Retained visual editor features

### Editor capabilities

Implements the approved V10 refinement of the V9.2 Design Lab in the existing application.

- Visual builder opens when selecting a quote, with the existing product, media, section and content engines.
- Refined header and stage navigation, real Back and Pool Shed actions, and staff-only Mineral, Forest and Graphite themes.
- Design, Content and Layers inspector tabs, collapsible editor panels and canvas focus mode (Escape exits).
- Live commercial preview uses the existing quote totals and payment-plan engines. Unsaved scenarios never alter published prices, approvals or customer data. The additional planning allowance is not saved as an actual cost.
- Existing per-quote commercial terms are saved through the existing strategy form. Accepted and Won terms remain locked.

Earlier editor verification: `npm run test:quotes`, `npm run build` and `node scripts/test-css-architecture.mjs` passed. The focused test also executes actual workspace handlers for quote opening, inspector, focus mode, Back, strategy saving and accepted-quote locking. Browser visual QA could not be run because the available browser blocks local preview URLs. No live deployment or database execution was performed.

No new Supabase migration or environment variable is required. Existing production data, backend endpoints and customer-portal permissions are unchanged. Deploy through the existing Vercel project using the existing environment variables; do not run a fresh database installation for this UI release.

The sections below document the inherited 1.38.0 baseline.

Pool Shed is the Pool Bros operational system for CRM, Quotes, Sales Orders, Projects, Product Hub, Inventory, Purchasing, Warehouse, Fulfilment, Finance, Analytics, Automation and controlled administration.

## Current quote experience

Quote Studio now runs as a dedicated premium workspace inside Pool Shed rather than inheriting the normal application page layout.

Every Quote Studio screen has an explicit route back to Pool Shed. The visual builder has its own command deck, workflow rail, library, live customer canvas and contextual inspector.

### Quick Quote

Customer acceptance enriches CRM, creates the Sales Order, allocates available stock and identifies purchasing shortages. A Project is optional.

### Project Proposal

Customer acceptance enriches CRM, creates the linked Project and Sales Order, allocates available stock, creates controlled supplier shortage demand and carries the accepted specification into the Project.

## Bespoke commercial strategy

Every quote owns its own:

- target margin
- minimum approval margin
- percentage, fixed, full or no-deposit structure
- deposit percentage or fixed amount
- installation milestone
- VAT rate
- customer payment note
- customer-facing brand and descriptor
- proposal style and colour palette

Company Settings provide defaults only. Published versions remain frozen.

## Customer proposals

The customer portal remains isolated from internal Pool Shed data. It receives presentation-safe pricing, selected options, permitted interaction controls, payment milestones and acceptance fields. Supplier costs, margins, stock, Sales Orders, POs and internal handover settings never enter the public proposal payload.

## Preview

Staff Preview now uses a short-lived customer-safe local preview ID rather than tab-scoped session storage, preventing a newly opened preview tab from incorrectly showing "Proposal unavailable".

## Build and test

```bash
npm run test:quotes
npm run test:actions
npm run test:deployment
npm run build
python3 scripts/qa-browser-v138.py
python3 scripts/qa-browser-v138-portal.py
```

`dist/` contains the deployable application.

## Supabase

The inherited v1.38.0 quote redesign introduced no migration, but this completion candidate adds `database/011-project-extra-quotes.sql`. Existing environments through migration 010 should apply 011 before deploying this matching build.
