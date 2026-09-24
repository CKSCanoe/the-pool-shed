# Pool Shed v1.38.0 - Quote Studio Command & Commercial Control

## Purpose

v1.38.0 turns Quote Studio into a stronger standalone commercial design workspace while preserving the v1.36 acceptance automation and v1.37 Design Lab editor.

## Navigation and layout

- Permanent `Pool Shed` exit on Quote Studio pipeline, Templates, Engagement, Approvals and Settings.
- Quote detail command deck split into navigation/actions and identity/commercial metrics.
- Eliminates the compressed one-row header shown in the v1.37 regression screenshot.
- Dedicated Quote Studio forest, water and restrained brass visual identity.
- Legacy quote sub-navigation is hidden while Quote Studio owns the workspace.
- Visual Build Quote mode remains full-width with Library, live customer canvas and Inspector.
- 1920px and 1366px command-layout regression tests added.

## Bespoke commercial control

Each quote now owns a commercial policy separate from company defaults:

- target margin
- minimum approval margin
- deposit type: percentage, fixed, full payment or none
- deposit percentage
- fixed deposit amount
- installation milestone percentage
- VAT rate
- customer-facing payment note

The Commercial Control Centre shows cost base, sell ex VAT, forecast margin, target sell, investment, deposit/payment, margin guardrails, accepted SKU/cost snapshot and operational handover.

`Apply target sell` can proportionally move currently selected option pricing to the quote's target margin and remains undo-able.

## Proposal customisation

Each quote can override:

- client-facing brand name
- proposal descriptor
- portal style: Architectural, Waterline, Minimal or Contrast
- primary colour
- accent colour
- paper colour
- hero imagery and focus
- page visibility
- section layouts and presentation content

The customer portal consumes these customer-safe theme values and never receives internal margin/cost strategy.

## Staff Preview fix

Preview data now uses a 30-minute customer-safe local preview ID stored in shared browser local storage. A new preview tab can read that ID, fixing the previous false `Proposal unavailable` result caused by tab-scoped session storage.

## Existing automation preserved

- customer contact/address confirmation at signature
- CRM enrichment
- Quick Quote to Sales Order
- Project Proposal to Project + Sales Order
- Product Hub SKU mapping
- available stock allocation first
- shortage-only purchasing demand
- draft supplier POs
- atomic acceptance and retry-safe operational handover
- secure Quote/Product/CRM media
- My Work actions
- Xero readiness

## Database

No new Supabase migration is required. Database authority remains through migration `010`.
