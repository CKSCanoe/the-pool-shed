# Pool Shed v1.32.0 · Elite Quote Builder

This release upgrades Quote Studio from a structured quote form into a visual private-client proposal builder while preserving the v1.31 Quotes First operational workflow.

## Quote-building experience

- Three-column visual editor: builder library, live client canvas, contextual inspector.
- Guided flow: Details → Build Quote → Review / Pool Layout for larger project proposals.
- Section templates for single-choice decisions, optional upgrades and included specifications.
- Multiple option layouts: cards, rows, comparison and compact.
- Product Hub remains the commercial authority for Product IDs, Pool Bros SKUs, supplier data, cost snapshots and bundles.
- Customer-facing titles, descriptions, benefits, badges, quantities, prices, recommendation state and visibility can be customised quote-by-quote without changing Product Hub.
- Proposal content layers include headings, text, callouts, imagery, galleries, brochures, pool-layout references, testimonials, payment information and design notes.

## Images and media

- Working JPG, PNG and WebP upload from the staff builder.
- Hero-image upload/replacement/removal with left/centre/right focal positioning.
- Option-card image upload and replacement.
- Image and gallery proposal blocks.
- Quote-specific reusable Media Library.
- Drag-and-drop image upload and clipboard image paste.
- Images are resized/compressed automatically before storage in the quote payload.
- Quote media allowance protects the secure publication payload from uncontrolled file growth.
- Removing an image from the quote media library detaches its quote references so the client does not keep seeing a supposedly removed asset.

## Customer presentation

- Customer proposal remains a physically separate presentation surface.
- Hero imagery and customer-safe proposal images render from the frozen quote snapshot.
- One- and two-option sections adapt to use the available presentation width rather than leaving empty three-column space.
- Payment milestone presentation has been refined for legibility.
- Customer receives no supplier costs, internal margins, Sales Orders, POs, stock, commercial snapshots or Project Handover controls.

## Operational workflow retained

### Quick Quote
Accept → Sales Order → stock allocation → draft supplier POs → optional Xero full-payment/deposit request. Project creation remains optional.

### Project Proposal
Accept → Project → Sales Order → stock/procurement → finance milestones and project handover.

Published workflow, SKU mapping and bundle composition remain frozen with the accepted version.

## Regression protection

The release build includes a dedicated v1.32 quote-builder test covering media library operations, customer-safe imagery and presentation layout support. Existing Quote Studio, customer isolation, Quick Quote/Project handover, Azzy and responsive-layout release gates remain active.

Final browser QA: Elite Quote Builder PASS, hero upload PASS, option-image upload PASS, media persistence PASS, customer image presentation PASS, customer portal isolation PASS, 0 runtime JavaScript errors.
