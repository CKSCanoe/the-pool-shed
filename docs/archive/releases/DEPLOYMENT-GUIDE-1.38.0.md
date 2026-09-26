# Pool Shed v1.38.0 Deployment Guide

## Database

No schema migration is required for this release. Keep the Supabase database through migration `010`.

## Safe promotion

1. Keep v1.37.0 available as the immediate application rollback point.
2. Confirm the existing v1.34 Supabase migrations through `010` are already present.
3. Preserve all current Vercel environment variables.
4. Deploy this exact v1.38.0 artifact to Vercel Preview first.
5. Test Quote Studio at desktop and tablet widths.
6. Open Settings and confirm `Pool Shed`, Quotes, Templates, Engagement, Approvals and Settings navigation.
7. Create one Quick Quote and one Project Proposal.
8. Test percentage and fixed deposits.
9. Test per-quote target/minimum margin and approval behaviour.
10. Preview a proposal in a new tab and confirm it does not show a false expired-preview message.
11. Publish a customer-safe test proposal and confirm the per-quote colour/theme settings.
12. Accept the test Quick Quote and verify Sales Order, stock and shortage flow.
13. Accept the Project Proposal and verify CRM enrichment, Project, Sales Order and procurement handover.
14. Smoke test Product Hub, CRM, Warehouse, Purchasing, Projects, Finance and Azzy.
15. Promote the exact Preview build that passed. Do not rebuild a different production artifact.

## Rollback

If a UI/runtime issue appears after production promotion, roll Vercel back to v1.37.0. No database rollback is needed because v1.38.0 adds no schema migration.
