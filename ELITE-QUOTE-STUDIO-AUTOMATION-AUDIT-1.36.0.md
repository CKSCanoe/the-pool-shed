# Pool Shed v1.36.0 - Elite Quote Studio & Automation Audit

## Design authority

The approved V9.2 Quote Design Lab was used as the interaction and visual reference rather than treating Quote Studio as a normal Pool Shed module.

The primary correction is spatial and architectural: Quote Studio now takes control of the workspace while active. The standard Pool Shed navigation shell no longer compresses the editor.

### Staff workspace verified

- dedicated Quote Studio root: PASS
- premium command header: PASS
- dark Build & Control stage rail: PASS
- normal Pool Shed sidebar hidden while Quote Studio active: PASS
- normal global topbar hidden while Quote Studio active: PASS
- Details / Build Quote / Pool Layout / Review stages: PASS
- Engagement / Versions / Handover stages: PASS
- three-panel visual proposal builder: PASS
- desktop builder width in Chromium QA: 1,448 px
- desktop live client canvas in Chromium QA: 836 px
- Product Hub option rendering: PASS
- undo/redo retained: PASS
- Preview and Review & Publish retained: PASS

## Acceptance authority verified

The customer portal now collects and validates a customer confirmation object at signature time. The exact accepted information is recorded with acceptance evidence before operational conversion.

Verified fields:

- signer/legal name
- email
- phone
- address line 1/2
- city
- county
- postcode
- country
- Terms & Conditions confirmation

Chromium QA confirmed the submitted acceptance payload contains the confirmed email and property address.

## CRM -> operational handover verified

The server conversion applies the accepted customer confirmation to the linked CRM customer before creating the downstream records.

A regression scenario verifies:

1. customer contact/address is enriched;
2. Project Proposal creates a linked Project;
3. one linked Sales Order is created;
4. accepted Product Hub product identity and SKU are preserved;
5. available stock is allocated first;
6. only the outstanding shortage becomes purchasing demand;
7. the shortage creates one controlled draft Purchase Order;
8. the Project material plan contains the accepted item;
9. customer/address data is available to the Sales Order handover.

## Existing authorities preserved

- v1.33 atomic acceptance and conversion jobs
- v1.34 Product Media and CRM Media
- v1.35 customer proposal design
- customer/internal-data separation
- Product Hub SKU/bundle mapping
- Sales Order authority
- stock allocation authority
- purchasing authority
- Project material planning
- payment/PO release gating
- My Work exception management
- Azzy UI/contrast safeguards
- responsive workspace authority

## Known follow-up

The previously identified staff Preview cross-tab persistence issue remains separate from this release. It does not affect genuine published customer links. The recommended later fix is a short-lived server-backed staff preview token rather than cross-tab `sessionStorage`.

## Release verdict

v1.36.0 is suitable for controlled Vercel Preview deployment on the existing v1.34 Supabase schema, subject to normal preview smoke testing before production promotion.
