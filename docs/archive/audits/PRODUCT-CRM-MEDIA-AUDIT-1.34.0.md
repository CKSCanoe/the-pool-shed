# Pool Shed v1.34.0 - Product & CRM Media Audit

## Authority model

Operational Product Hub and CRM records stay in the `pool-bros-main` workspace snapshot. Binary media is stored separately in private Supabase Storage. This avoids Base64 file growth and avoids introducing duplicate product/customer source tables.

## Product authority

`ps_product_media` stores media metadata. Product Hub stores only stable `product-media:<uuid>` references. Product Media can be used by Product Hub, quote authoring and customer proposal rendering.

## CRM authority

`ps_customer_media` stores secure customer/site attachment metadata. CRM stores stable `customer-media:<uuid>` references against the customer workspace record.

## Storage

`product-media` and `customer-media` are private buckets with a 25 MB per-file limit. Supported types are JPEG, PNG, WebP and PDF.

## Access

The browser cannot directly read/write Product or Customer media tables. `/api/media` validates a Supabase bearer session and `ps_workspace_members`. Upload/archive requires Admin or Operator workspace role. Signed URLs are temporary.

## Quote integration

Quote publication validates Product/CRM stable refs. The customer route resolves permitted refs server-side. Internal workspace/product/customer records are not exposed through the customer portal.

## Regression gates

A dedicated `test-business-media-v134.mjs` verifies migration, buckets, server API, browser client, Product Hub upload UI, CRM Files, Quote Studio inheritance and customer-safe resolution.
