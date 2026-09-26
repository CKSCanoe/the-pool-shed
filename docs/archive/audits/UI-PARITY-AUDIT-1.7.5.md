# Pool Shed v1.7.5 UI Parity Audit

## Scope

This release continues the Dashboard, Customer and Sales Order rebuild and isolates the final Sales Order parity mismatch discovered after v1.7.4.

## Root cause confirmed

The Dashboard and Customer workspaces already pass their approved Design Lab structural regressions. The remaining Sales Order mismatch was not the product finder itself. The top Sales Order command row was still carrying customer-account content that belongs to the CRM/account workspace: account facts, outstanding balance, credit headroom and commercial terms panels. This made the first card substantially taller than the Order Details and Stock & Fulfilment cards and recreated the visual impression of an older mixed layout.

The Stock & Fulfilment header also embedded the full Goods Note directory. That duplicated detailed fulfilment UI above the main order workspace and made the command area taller than the approved Order Command concept.

## v1.7.5 changes

- Sales Order customer command card is now compact: CRM identity, account-health state, contact details, customer search/change and Open CRM only.
- Customer financial/account data remains in the underlying application and customer/accounting surfaces. It was not deleted from the data model.
- Full Goods Note directory removed from the Sales Order command header. Fulfilment remains available through the header control and Fulfilment tab.
- Removed dead Sales Order CSS selectors for the deleted customer facts/commercial blocks so an old selector cannot recreate the expanded card.
- Kept the approved product finder, exact-variant control, allocation engines, custom lines, shipping lines, payment actions and Goods Note engines.
- Release/cache generation advanced from 1.7.4 to 1.7.5 across index assets, service-worker registration and service-worker precache URLs to prevent mixed cached UI generations.
- Added `test-sales-order-command-compact-v175.mjs` to prevent the expanded CRM/account blocks or Goods Note directory from returning to the top command row.
- Added current `test-ui-ownership-v175.mjs` and updated release-aware regressions to validate 1.7.5.

## Verification evidence

`npm run build` completed successfully and runtime validation passed.

Focused regressions pass for:

- UI ownership and release-coherent assets
- CSS ownership architecture (15 maintained modules)
- Dashboard command/right-rail composition
- Dashboard review/commercial composition
- Customer Design Lab parity
- Customer workspace and save flows
- Sales Order Order Command structure
- Compact Sales Order customer command
- Sales Order Design Lab parity
- Exact variant/precision line behaviour
- Smart product finder and live search
- Customer picker
- Asset freshness and service-worker cache coherence
- Catalogue, bundles, purchasing, fulfilment, receiving, workspace sync and accounting core logic through the full validation chain

The full `npm run validate` reaches the database test stage, then stops because this extracted project does not contain the development dependency `@electric-sql/pglite`. The failure is `ERR_MODULE_NOT_FOUND` before the database test can execute. No database implementation files were changed in v1.7.5.

## Browser verification limitation

The available headless Chromium environment is governed by an organization policy that blocks local/file/data URLs, so a fresh browser screenshot could not be generated from this extracted build. Inherited v1.7.4 QA screenshots were deliberately removed from this release rather than presenting stale visual evidence as current.

## Vercel status

The connected Vercel integration still returns an empty team list, so the existing Pool Shed Vercel project cannot yet be discovered or safely targeted. This release has not been pushed to an unknown/new project and production has not been modified.
