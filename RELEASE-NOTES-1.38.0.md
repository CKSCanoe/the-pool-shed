# Pool Shed v1.38.0 - Commercial Studio

## Purpose

v1.38 turns Quote Studio into a distinct premium commercial workspace rather than a generic Pool Shed settings/form surface. The release strengthens navigation, per-quote commercial control, bespoke proposal styling and staff preview reliability while retaining the v1.37 Design Lab workspace and the v1.36 acceptance automation.

## Navigation and Quote Studio identity

- Persistent **Back to Pool Shed** control across Quote Studio list, new quote, templates, engagement, approvals and settings.
- Quote detail header includes Pool Shed / Quotes / Quote breadcrumb plus a visible Pool Shed return action.
- Quote Studio has its own deep-water commercial colour authority, independent of the normal Pool Shed operational shell.
- Settings is rebuilt as a Quote Studio Control Centre with company identity, proposal defaults, commercial defaults and acceptance/safety controls.
- Company settings are starting defaults only. Published quotes never change retrospectively.

## Per-quote Commercial Studio

Every quote receives its own commercial profile:

- target margin percentage;
- minimum margin floor;
- deposit method: percentage or fixed amount;
- deposit percentage;
- fixed deposit amount override;
- installation milestone percentage;
- customer payment-breakdown visibility.

Commercial Studio shows:

- current net sell;
- frozen cost snapshot;
- forecast profit;
- current margin;
- target margin and minimum floor;
- target sell value required to achieve the target margin;
- target profit;
- 30 / 35 / 40 / 45 percent margin scenarios;
- first payment / deposit;
- effective deposit percentage;
- balance after first payment;
- payment milestones;
- margin-floor approval status;
- accepted SKU / cost snapshot.

The **Apply target margin to selected prices** action proportionally updates selected customer sell prices while retaining quantities and cost snapshots.

## Bespoke customer presentation per quote

Each quote can override the company proposal defaults with its own:

- style preset;
- primary colour;
- accent colour;
- paper/background colour;
- corner style;
- content density.

The selected presentation theme is frozen into the published customer version.

## Customer safety

- Cost snapshots and margin controls stay internal.
- The customer-safe snapshot contains the accepted investment and payment information only.
- Payment milestone details can be hidden per quote.
- Fixed deposits are reflected correctly in the customer investment and operational payment request.
- Published commercial profiles are frozen into the immutable commercial version snapshot.

## Preview reliability

Staff Preview now uses a short-lived same-origin local preview payload rather than tab-isolated session storage. This removes the previous design where a newly opened preview tab could immediately report that the preview had expired.

The preview payload has an explicit 30-minute expiry and staff preview remains separate from customer engagement tracking.

## Existing automation retained

- customer contact/address confirmation at acceptance;
- CRM customer enrichment;
- Quick Quote to Sales Order;
- Project Proposal to Project + Sales Order;
- Product Hub SKU/bundle traceability;
- existing stock allocation first;
- shortage-only supplier purchasing demand;
- draft supplier POs;
- payment-gated PO release;
- atomic acceptance and retryable operational conversion;
- secure Quote Media / Product Media / Customer Media;
- customer/internal isolation;
- My Work and approval authority;
- Azzy and responsive workspace protections.

## Regression repairs during v1.38 QA

Browser QA identified five v1.37 Quote Studio helper renderers that had been dropped during the commercial rebuild. The following were restored from the last known-good v1.37 source and are now protected by the v1.38 test gate:

- customer canvas option renderer;
- Engagement view;
- Versions view;
- Handover view;
- Review & Publish dialog.

A publish-version calculation defect involving the effective deposit percentage was also corrected and is now covered by the commercial regression test.

## Supabase

No new Supabase migration is required for v1.38. Continue using the current Pool Shed backend through migration `010` from v1.34.
