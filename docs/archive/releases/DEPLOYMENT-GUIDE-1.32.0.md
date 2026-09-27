# Pool Shed v1.32.1 Deployment Guide

This package is a complete release candidate/full-project package. It has not been pushed over the live Pool Shed Vercel/Supabase production environment by this build process.

## Safe deployment order

1. Keep the current v1.31 production deployment and database backup available for rollback.
2. Install the normal development dependencies in CI/development and run `npm run validate`. The sandbox used to prepare this release does not contain the development-only `@electric-sql/pglite` dependency required by the database execution tests.
3. Confirm existing Supabase, Xero, AI and backup environment variables.
4. If Quote Studio migration `database/007-quote-studio.sql` has not already been applied, apply it after migrations 001-006. Do not re-create or overwrite existing live quote evidence manually.
5. Apply `database/008-quote-media.sql` after `007-quote-studio.sql`. This creates the private `quote-media` bucket and service-role-only media metadata.
6. Run `npm run build` and deploy the generated `dist` plus the existing `api` and `server` functions through the Pool Shed Vercel project.
7. Confirm the service worker is serving the `pool-shed-v1.32.1-elite-quote-builder` cache and not an older quote-builder cache.
8. Verify `/` loads only the internal Pool Shed app and `/proposal` loads only the isolated private-client presentation.
9. Create a test Quick Quote and upload a hero image and an option image. Preview the customer proposal and confirm both appear.
10. Create an image/gallery content block and verify the media library can reuse the uploaded quote image.
11. Publish a secure test quote and confirm the public payload contains no Product Hub supplier cost, margin, stock, Sales Order, PO or internal handover fields.
12. Accept a Quick Quote and verify one Sales Order is created; verify no Project is created unless `Create Project on acceptance` was selected.
13. Test a Project Proposal and verify Project + Sales Order + stock/procurement handover remains linked to the frozen version.
14. Confirm Azzy readability, responsive page fit, Product Hub, Sales Orders, Purchasing, Warehouse, Projects and Settings remain operational.
15. Only after the smoke tests pass should v1.32 become the production baseline.

## Release commands

- `npm run test:quotes` — v1.32 visual quote builder plus quote workflow tests.
- `npm run test:deployment` — quote, deployment, Azzy and responsive release gates.
- `npm run build` — creates `dist` and executes deployment guards.
- `python scripts/qa-browser-v132.py` — real Chromium quote/media/customer-portal QA in an environment with Playwright + Chromium available.
- `npm run validate` — full legacy/system suite, including database execution tests when all development dependencies are installed.

## Customer security rule

The client proposal is a separate secure route and is generated from the customer-safe published snapshot. Internal supplier cost, margin, stock, Sales Order, Purchase Order, Project Handover, approval and internal engagement data must never be added to that public payload.
