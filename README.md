# The Pool Shed — Live V1.6

This is the complete deployable Pool Bros operational workspace. It includes CRM, customer addresses and credit controls, products and catalogue imports, supplier profiles and catalogues, Sales Orders, Purchase Orders, Jobs / Projects, Order Requests, master-warehouse stock, vans and job bins, Goods In, quality control, putaway, transfers, Goods Notes, pick/pack/ship, returns, stock counts, accounting views, permissions, personal menu layouts, dark mode and offline recovery.

## Production connection

The application uses Supabase Auth and a shared Supabase workspace record. Browser local storage and IndexedDB provide immediate offline saving. Pending changes are uploaded when connectivity returns.

## Required Vercel variables

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`

Only the publishable browser key is used. Never expose the Supabase secret key.

## Vercel settings

- Framework: Other
- Build command: `npm run build`
- Output directory: `dist`
- Install command: `npm install`

## Database

Run `supabase-schema.sql` once in Supabase SQL Editor. The script is safe to run again during setup because table creation is idempotent.

## Important operating note

Live V1.6 synchronises the system as a shared workspace snapshot. This is workable for a controlled team rollout and offline recovery, but simultaneous edits to the same record can still result in the most recent complete workspace save winning. High-risk stock operations should eventually be moved to server-side transactional functions before a large multi-site rollout.


## Live v1.7 polish
- Unified Pool Bros branding, spacing, forms, cards and buttons.
- Improved user and permissions administration readability.
- Removed outdated user-switching wording; Supabase session remains the only login identity.
- Improved light/dark-mode contrast, responsive forms and accessible focus states.
- Updated offline cache namespace to Live v1.7.
