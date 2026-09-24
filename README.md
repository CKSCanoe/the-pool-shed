# Current release: v1.41.0

Quote Studio responsive layout and readability update. See [release notes](RELEASE-NOTES-1.41.0.md).

## Acceptance introduced in v1.40.0

Quote acceptance now has a separate signing page, with typed and drawn signatures. See [release notes](RELEASE-NOTES-1.40.0.md) for deployment and verification details.

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

v1.38.0 introduces no new Supabase migration. Continue using the backend through migration `010` from the v1.34 Product & CRM Media release.
