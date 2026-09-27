# Pool Shed v1.35.0 - V9.2 Private Quote Portal

## Purpose
v1.35.0 applies the approved V9.2 private-client proposal design language to the real Pool Shed customer quote portal while retaining the v1.34 Product & CRM Media backend and the v1.33 Quote Process Authority.

## Customer proposal redesign
- V9.2-inspired architectural paper / charcoal / forest / water / restrained gold palette.
- Sticky private-client navigation with Overview, Vision, Choices, Documents, Investment and Accept anchors where available.
- Full-bleed proposal hero using the secure quote hero image.
- Project metadata and private-recipient presentation in the hero/navigation.
- Editorial project/vision section with confidence pillars.
- Premium option presentation, including V9.2-style row layouts for detailed choices and refined card layouts for enhancements.
- Existing image/gallery/content blocks retain secure media rendering.
- Sticky current project/quote bar with live selected specification summary and VAT-inclusive total.
- Refined pool-layout presentation.
- Premium supporting-document grid.
- Dark investment close with live selected total and payment milestones.
- Rebuilt acceptance presentation with Review / Confirm / Sign visual flow and typed-signature preview.
- Responsive mobile treatment designed specifically for the proposal rather than merely shrinking desktop.

## Behaviour retained
- Quick Quote vs Project Proposal wording.
- Customer-selectable options and fixed View + Accept permissions.
- Option questions and customer engagement tracking.
- Secure product, CRM and quote media resolution.
- Proposal documents.
- Decline flow.
- Atomic acceptance and conversion authority.
- Superseded/expired/revoked proposal protections.
- Customer/internal data isolation.

## Internal systems unchanged
The redesign does not replace or weaken Product Hub, CRM, Warehouse, Sales Orders, Purchasing, Projects, My Work, Azzy, Xero readiness, Supabase migrations or the secure media APIs from v1.34.

## Verification
- `npm run test:deployment` PASS.
- `npm run build` PASS.
- v1.35 V9.2 portal regression PASS.
- Chromium desktop portal QA PASS.
- Chromium mobile portal QA PASS.
- Customer portal runtime JavaScript errors: 0.
- Existing quote isolation, secure media, Product/CRM media, Azzy and responsive-workspace guards PASS.

## Database
No new Supabase migration is required for v1.35.0. Keep the v1.34 database setup through migration 010.
