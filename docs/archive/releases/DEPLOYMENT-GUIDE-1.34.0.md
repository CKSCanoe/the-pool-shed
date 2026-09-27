# Pool Shed v1.34.0 - Deployment Guide

## Existing v1.33 Supabase

1. Back up Supabase.
2. Apply `database/010-product-crm-media.sql` as database owner.
3. Confirm `ps_product_media` and `ps_customer_media` exist.
4. Confirm Storage contains private `product-media` and `customer-media` buckets.
5. Keep existing 001-009 schema in place.
6. Deploy v1.34 as Vercel Preview.
7. Test Product Hub image/document upload, CRM Files and Quote Studio Product Hub asset reuse.
8. Promote the exact tested Preview.

## Fresh Supabase

Use:

- `Pool-Shed-v1.34-FRESH-SUPABASE-FULL-INSTALL.sql`
- `Pool-Shed-v1.34-ENROL-FIRST-ADMIN.sql`
- `Pool-Shed-v1.34-SUPABASE-VERIFY.sql`

Do not use the old destructive July clean-install SQL.

## Environment

Required server/browser configuration:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` server-only
- `APP_ORIGIN`
- `SECURE_WORKSPACE_WRITES=true`

Optional proposal email:

- `RESEND_API_KEY`
- `QUOTE_FROM_EMAIL`

## Preview smoke test

- sign in
- Product Hub -> Product Details -> Media & Docs
- upload/replace main image
- add gallery image
- upload brochure/datasheet/guide/warranty/certificate
- reload and confirm signed previews
- CRM -> customer -> Files
- upload site photo, drawing, survey, access file and document
- reload and confirm access
- create quote and add Product Hub item
- confirm approved image/brochure inherit into quote option
- publish and open isolated customer proposal
- confirm imagery loads but internal product/customer/stock/cost data does not leak
- run Quick Quote acceptance/handover
- run Project Proposal acceptance/handover
- regression-check Product Hub, CRM, Warehouse, Purchasing, Projects, Azzy and responsive layouts

## Rollback

If UI/runtime trouble occurs, rollback the Vercel application while leaving migration 010 and private storage objects in place. Do not delete Product/Customer media during rollback because historical quote versions may refer to stable Product Media refs.
