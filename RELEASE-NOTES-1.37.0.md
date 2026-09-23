# Pool Shed v1.37.0 - Design Lab Parity Quote Studio

## Purpose
v1.37.0 brings the staff Quote Studio much closer to the approved V9.2 Design Lab interaction model while retaining the v1.36 acceptance and operational automation.

## Quote Studio design changes
- Build Quote runs as a dedicated full-screen design workspace.
- Build-stage navigation automatically compacts to an icon rail.
- Left library tabs now follow the Design Lab order: Elements, Products, Sections, Uploads.
- Larger live client artboard with editorial proposal styling.
- Desktop, tablet and mobile canvas modes.
- Canvas zoom controls.
- Independent Library and Inspector collapse controls.
- Focus Canvas hides both editing rails without collapsing the live artboard.
- Product/option cards, editor layers and inspector styling updated to the V9.2 visual language.
- The normal Pool Shed sidebar/topbar remain hidden while Quote Studio owns the workspace.

## Automation retained
- Customer contact/address confirmation at acceptance.
- CRM customer enrichment from accepted confirmation.
- Quick Quote -> Sales Order path.
- Project Proposal -> Project + Sales Order path.
- Product Hub identity/SKU retention.
- Existing stock allocated before purchasing shortages are created.
- Draft supplier POs for outstanding demand only.
- Atomic acceptance and idempotent operational handover.
- Secure Quote Media and Product/CRM Media.
- Customer/public data separation.

## QA
- deployment regression suite PASS
- My Work / Action Authority suite PASS
- production build PASS
- Chromium staff Quote Studio PASS
- Design Lab tab/order controls PASS
- Focus Canvas PASS
- desktop/tablet/mobile controls PASS
- panel collapse PASS
- customer acceptance CRM confirmation PASS
- runtime errors 0

## Database
No new Supabase migration is required beyond the v1.34 backend through migration 010.
