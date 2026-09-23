# Pool Shed v1.36.0 - Deployment Guide

## Database

v1.36.0 requires no new database migration.

Use the existing v1.34 Supabase schema through migration 010. Confirm the current backend is already configured before deploying the application.

## Required environment

Retain the existing Pool Shed environment variables, including:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` server only
- `APP_ORIGIN`
- `SECURE_WORKSPACE_WRITES=true`

Retain all currently approved Xero/AI/integration variables.

Optional real proposal email remains:

- `RESEND_API_KEY`
- `QUOTE_FROM_EMAIL`

## Safe deployment sequence

1. Keep v1.35.0 available as the immediate rollback deployment.
2. Confirm the v1.34 Supabase migrations through 010 are present.
3. Deploy this exact v1.36.0 artifact to Vercel Preview.
4. Test staff login and open Quotes.
5. Open a Project Proposal and confirm Quote Studio takes the full workspace rather than using the normal Pool Shed shell.
6. Test Details, Build Quote, Pool Layout, Review, Engagement, Versions and Handover.
7. Add a Product Hub item and confirm image/content/SKU information reaches the quote.
8. Preview/publish a customer proposal and verify customer-only data separation.
9. Accept a test proposal using a controlled customer account and confirm email, phone and property address.
10. Confirm the existing CRM customer is enriched rather than duplicated where the quote is already linked to that customer.
11. Confirm Project Proposal creates one Project and one linked Sales Order.
12. Confirm Quick Quote creates a Sales Order directly, plus a Project only when explicitly configured.
13. Confirm available stock is allocated and only shortages become PO demand.
14. Confirm failed conversion retry remains idempotent.
15. Check Product Hub, CRM, Warehouse, Purchasing, Projects, My Work and Azzy for regressions.
16. Promote the exact tested Preview deployment. Do not rebuild a different production artifact.

## Rollback

If an application/runtime issue is found, roll Vercel back to v1.35.0. No v1.36 database rollback is needed because this release adds no database migration.
