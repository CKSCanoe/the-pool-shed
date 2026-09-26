# Pool Shed v1.34.0 - Product & CRM Media

## Purpose

v1.34.0 makes Product Hub and CRM the reusable media authorities for Pool Shed. Product/customer master records remain in the protected Pool Shed workspace while files are stored privately in Supabase Storage using stable references.

## Product Hub media

Product Details -> Media & Docs now supports secure uploads for:

- main product image
- gallery images
- brochure
- datasheet
- installation guide
- warranty
- certificate / compliance document

The Product Hub record stores stable `product-media:<uuid>` references. The main image and approved brochure/datasheet are automatically inherited when a Product Hub item is added to Quote Studio. Quote-specific overrides remain available.

## CRM customer files

Customer -> Files now supports private:

- site photos
- drawings
- surveys
- access files
- warranties
- general documents

The customer workspace record stores stable `customer-media:<uuid>` references while the file bytes remain in private Supabase Storage.

## Security

Migration `database/010-product-crm-media.sql` creates:

- `ps_product_media`
- `ps_customer_media`
- private bucket `product-media`
- private bucket `customer-media`

No anon/authenticated access policy is created for these buckets/tables. Upload, list, signing and archive operations are mediated by `/api/media` using the service role after staff authentication and workspace membership checks.

Product assets that have been archived remain signable for immutable historical quote versions. Deleted/archived customer assets are not available to new customer views.

## Quote Studio integration

- Quote Studio resolves Product/CRM secure refs as temporary signed URLs.
- Publishing validates referenced Product/CRM assets before creating a live proposal.
- Customer proposal payloads receive temporary signed URLs, never storage paths or service credentials.
- Product Hub main images and brochures are reused automatically in new quote options.

## Existing systems retained

- v1.33 Process & Quote Authority
- atomic acceptance before operational conversion
- Quick Quote direct-to-Sales-Order
- Project Proposal Project + Sales Order
- Quote Media
- My Work quote actions
- Product Hub SKU/bundle authority
- Warehouse, Purchasing, Projects and Finance/Xero readiness
- Azzy readability/panel protections
- responsive workspace authority

## Database order

For an existing v1.33 database, apply only:

`database/010-product-crm-media.sql`

For a fresh backend, use the supplied v1.34 full Supabase installer covering the core foundation and migrations 001-010.

## Verification completed

- `npm run test:deployment` PASS
- `npm run build` PASS
- Product Hub engine/command/product setup tests PASS
- Action Authority/My Work suite PASS
- Full-system release contract PASS
- runtime validation PASS
