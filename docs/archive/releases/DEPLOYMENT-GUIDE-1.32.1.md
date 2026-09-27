# Pool Shed v1.32.1 Deployment Guide

## Safe deployment order

1. Keep the current production deployment available for rollback.
2. Take/confirm the normal Supabase backup before schema changes.
3. Run `npm run test:deployment` and `npm run build` from this package.
4. Confirm these existing Vercel environment variables: `APP_ORIGIN`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` plus the existing Xero/AI variables in use by Pool Shed.
5. If not already applied, run `database/007-quote-studio.sql` as the database owner.
6. Apply `database/008-quote-media.sql` as the database owner. Confirm bucket `quote-media` exists and is private.
7. Deploy the tested v1.32.1 build to a Vercel preview deployment first.
8. Verify `/` is the staff app and `/proposal` is the isolated customer portal.
9. Create a test Quick Quote, upload a hero image and option image, reload the quote and confirm both signed previews return.
10. Publish the test quote and open its secure customer link in a separate browser session. Confirm images load and no internal supplier cost, margin, stock, Sales Order, PO or handover data is present.
11. Accept a Quick Quote and verify exactly one Sales Order is created, plus a Project only when selected.
12. Test a Project Proposal acceptance and procurement handover.
13. Confirm Product Hub, Warehouse, Sales Orders, Purchasing, Projects, Azzy and responsive layouts still work.
14. Promote the validated preview deployment to production. Do not rebuild between preview approval and promotion.
15. Scan Vercel runtime errors immediately after promotion and retain the previous production deployment for rollback.

## Quote Media security model

- Bucket: `quote-media`
- Public bucket: no
- Direct anon/authenticated table access: revoked
- Upload/sign operations: service-role Quote API only
- Staff preview URL lifetime: temporary
- Customer proposal URL lifetime: temporary and generated at request time
- Frozen quote versions store stable media references, not signed URLs

## Required release gates

- `npm run test:deployment`
- `npm run build`
- `python scripts/qa-browser-v132.py`

The development-only database execution suite may additionally require the dev dependency `@electric-sql/pglite` in the normal CI/development environment.
