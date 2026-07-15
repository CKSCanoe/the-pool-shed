# The Pool Shed — Live V1

Operational release for Pool Bros.

Includes CRM, Sales Orders, Jobs / Projects, Order Requests, Product Hub, Inventory, Purchasing, Supplier Hub, Warehouse, Fulfilment, Accounting, Analytics, role permissions, personal menu layouts, offline local saving, IndexedDB backup and pending sync queue.

## Deployment

- Build command: `bash scripts/build.sh`
- Output directory: `dist`

## Important

This package contains no demo reset controls or demo password fallback. Live central multi-user synchronisation still requires the configured Supabase production connection.


## Live V1.1
Includes the complete branded eight-step Product Creation wizard with identity, inventory, pricing, suppliers, content, bundles/variants, custom fields and review/publish.

## Supabase-connected live build

Required Vercel environment variables:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY` (or legacy `SUPABASE_ANON_KEY`)

Run `supabase-schema.sql` in Supabase SQL Editor before first login. Create each user in Authentication and add the matching UUID to `public.user_profiles`.

This release uses Supabase Auth and a shared `workspace_snapshots` record, while retaining localStorage and IndexedDB as the offline cache. Changes made offline are marked pending and uploaded automatically after connectivity returns.
