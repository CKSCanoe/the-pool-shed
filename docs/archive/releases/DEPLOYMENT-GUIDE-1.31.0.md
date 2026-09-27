# Pool Shed v1.31.0 Deployment Guide

This package is a release candidate/full project package. It has not been deployed to the live Pool Shed application by this build process.

## Safe deployment sequence

1. Keep the current production deployment and database backup available for rollback.
2. Install the normal development dependencies in a CI/development environment and run `npm run validate` so the PostgreSQL in-memory tests can execute.
3. Confirm the Vercel environment contains the existing Supabase and any enabled Xero/AI/backup secrets required by the app.
4. Apply `database/007-quote-studio.sql` to the correct Supabase database after migrations 001-006.
5. Run `npm run build` and deploy the generated `dist` together with the `api` and `server` functions through the existing Vercel project.
6. Verify `/` loads the internal Pool Shed login/app and `/proposal` loads only the isolated customer proposal surface.
7. Create one test Quick Quote. Publish it, open the secure proposal, accept it, and verify one Sales Order is created with no Project when `Create Project on acceptance` is off.
8. Create one Quick Quote with `Create Project on acceptance` enabled and verify both records are linked to the frozen quote version.
9. Create one Project Proposal and verify Project, Sales Order, stock demand, Purchase Order drafts and payment/deposit state are linked correctly.
10. Confirm Xero behaviour. If the live connection is not enabled or the customer has no linked Xero contact, the quote should remain `Ready for Xero` rather than fail.
11. Confirm customer presentation contains no internal costs, margins, stock, Sales Orders, Purchase Orders, approvals or Project Handover information.
12. Confirm Azzy readability, responsive page fit, Product Hub, Sales Orders, Purchasing, Warehouse and Projects still operate normally.
13. Only after the smoke test succeeds should the release be treated as the production baseline.

## Build commands

- `npm run build` - creates the deployable `dist` and runs deployment guards.
- `npm run test:quotes` - runs v1.31 Quote Studio tests.
- `npm run test:deployment` - runs quote plus deployment/Azzy/responsive release guards.
- `npm run validate` - full regression suite, including database tests when dev dependencies are installed.

## Customer route security

Vercel explicitly rewrites `/proposal` to `/proposal.html`. The customer route must not fall through to the internal SPA catch-all.

The proposal response uses private/no-store caching and security headers defined in `vercel.json`.

## Important operational rule

Published and accepted quote versions are immutable. If the customer needs a change after publication or acceptance, create a revision or variation. Do not edit the accepted commercial history.


## v1.31 operational simplification
- Quotes is the primary quotation entry point.
- Accepted Quick Quotes can go directly to Sales Orders.
- Project material control derives from Sales Orders, Purchase Orders, allocations, Job Bin stock and receipts.
- No separate request-layer migration is required. Historical workspace payload is discarded during normalisation.
