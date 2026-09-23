# Pool Shed v1.33.0 - Deployment Guide

## Safe deployment order

Do not overwrite the current production deployment blindly. Keep v1.32.1 available as the immediate rollback point.

### 1. Database backup and checks

Confirm the live Supabase project and take the normal database backup/export used for Pool Shed change control.

### 2. Apply Quote Studio migrations in order

If 007 and 008 are already live, apply only 009.

```text
database/007-quote-studio.sql
database/008-quote-media.sql
database/009-quote-process-authority.sql
```

Verify:
- `ps_quote_publications`
- `ps_quote_acceptances`
- `ps_quote_media`
- `ps_quote_conversion_jobs`
- RPC `ps_quote_accept_atomic`
- RPC `ps_quote_conversion_claim`
- RPC `ps_quote_conversion_finish`

### 3. Confirm Vercel environment

Required existing Supabase/server variables must remain configured.

Optional for real proposal email:
- `RESEND_API_KEY`
- `QUOTE_FROM_EMAIL`

If the optional email variables are absent, Pool Shed will publish the link but will not claim the proposal email was sent.

### 4. Deploy as Preview first

Deploy this exact v1.33.0 artifact to a Vercel Preview deployment.

Do not promote immediately.

### 5. Preview smoke test

Check all of the following in the preview environment:

1. Login and Azzy readability
2. Quotes -> New Quote
3. Quick Quote minimal setup and Advanced workflow
4. Project Proposal setup
5. Start from Template
6. Product Hub item addition
7. hero / option image media signing
8. undo / redo
9. Review & Publish
10. Publish secure link
11. View + Accept proposal has no option-change/question controls
12. Interactive proposal can change allowed choices and ask a question
13. superseded old link is blocked
14. decline is recorded
15. acceptance returns confirmation even if operational conversion is deliberately made to fail
16. failed conversion appears in Handover and My Work
17. retry completes without creating duplicate SO / Project / POs
18. email send state is truthful
19. Quick Quote acceptance creates the intended Sales Order-only path
20. Project Proposal acceptance creates the intended Project + Sales Order path

### 6. Promote the tested preview

Promote the exact preview deployment that passed the checks. Do not rebuild a different artifact for production.

### 7. Post-deployment checks

Review production runtime logs and quote events for:
- acceptance errors
- conversion-job failures
- publication 4xx/5xx errors
- media signing errors
- duplicate conversion attempts

## Rollback

If a production UI/runtime issue occurs, roll Vercel back to v1.32.1 while leaving 009 in place. The migration is additive and the previous application can continue to ignore the new conversion-job table/RPCs.

Do not delete acceptance or publication evidence during rollback.
