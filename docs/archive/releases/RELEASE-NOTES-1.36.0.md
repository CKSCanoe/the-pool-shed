# Pool Shed v1.36.0 - Elite Quote Studio & Acceptance Automation

## Purpose

v1.36.0 makes Quote Studio a dedicated premium commercial workspace rather than a normal Pool Shed page and completes the customer-confirmation handover from proposal acceptance into CRM, Sales Orders, Projects, stock allocation and purchasing.

## Elite Quote Studio

- Quotes now open in their own full-width commercial workspace while remaining inside Pool Shed.
- The normal Pool Shed sidebar and top bar are removed while Quote Studio is active so the editor is not compressed by the standard application shell.
- A dedicated premium command header shows quote identity, workflow, customer, status, next action, investment, quote readiness, undo/redo, Preview and Review & Publish.
- The workspace uses a dark Build & Control stage rail inspired by the approved V9.2 Design Lab.
- Build stages are Details, Build Quote, Pool Layout for project proposals, and Review.
- Customer & Operations stages are Engagement, Versions and Handover.
- The visual builder is widened to a three-panel layout with Library/sections on the left, the live client canvas in the centre and contextual editing on the right.
- The client canvas and option cards receive more space, stronger hierarchy and the same premium proposal language used by the customer portal.
- Product Hub, media, content blocks, templates, options and page controls remain available from the same quote record.

## Customer acceptance and CRM authority

The customer acceptance step now confirms the information Pool Bros needs to create or update the operational customer record:

- full legal name
- email
- phone
- address line 1
- address line 2
- town/city
- county
- postcode
- country
- exact quote selections
- Terms & Conditions version

The public API validates and sanitises this confirmation before it is written into immutable acceptance evidence.

During operational conversion, the accepted customer details enrich the existing Pool Shed CRM customer before linked operational records are created. The confirmed delivery/property address is therefore available to the Sales Order and Project without staff re-keying it.

## Automated handover

### Quick Quote

Accepted Quick Quote -> CRM customer confirmation -> Sales Order -> Product Hub SKU demand -> available stock allocation -> shortage calculation -> draft supplier Purchase Orders -> payment/Xero path according to the quote policy.

A Project is created only when the quote policy explicitly requests one.

### Project Proposal

Accepted Project Proposal -> CRM customer confirmation -> Project -> Sales Order -> accepted Product Hub SKUs/bundle components -> stock allocation -> supplier shortages/draft POs -> payment/deposit gate -> Project material plan and handover.

The existing idempotent conversion authority remains in place so retrying a failed operational handover cannot legitimately create duplicate acceptance records.

## Product Hub and stock authority retained

- Quote options retain Product Hub product IDs, Pool Bros SKUs and supplier SKU snapshots.
- Accepted quantities become operational demand rather than being re-keyed.
- Available stock is allocated automatically when the quote policy permits it.
- Only the shortage quantity becomes purchasing demand.
- Supplier shortages remain grouped into controlled PO drafts.
- Product Hub images/brochures from v1.34 can continue to flow into Quote Studio.

## Customer portal retained

The v1.35 V9.2 private-client proposal design remains the customer-facing renderer, including secure media, engagement, option selection where permitted, questions, decline, version protection and immutable acceptance.

## Supabase

No new Supabase migration is required for v1.36.0.

The current database authority remains the v1.34 schema through:

`database/010-product-crm-media.sql`

The new customer confirmation is stored in the existing JSONB acceptance evidence and then applied to the existing protected Pool Shed workspace during conversion.

## Verification

- `npm run test:deployment` PASS
- `npm run build` PASS
- Staff Elite Quote Studio Chromium QA PASS
- Visual builder desktop width QA PASS
- Customer acceptance/CRM confirmation payload PASS
- Product Hub SKU -> stock allocation -> shortage PO conversion regression PASS
- customer/internal portal isolation PASS
- Azzy protections PASS
- responsive workspace protections PASS
- runtime JavaScript errors during v1.36 Chromium QA: 0

## Rollback

Keep v1.35.0 available as the immediate application rollback point. No database rollback is required specifically for v1.36 because it introduces no new schema migration.
