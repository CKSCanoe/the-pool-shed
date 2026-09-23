# Pool Shed v1.33.0 - Process & Quote Authority

## Purpose

v1.33.0 turns the v1.32 visual quote builder into a safer and clearer commercial process. The release focuses on customer-decision authority, truthful delivery states, operational handover reliability, simpler staff workflows and actionable exception management.

## Quote process changes

- New Quote is reduced to customer, job name, work type, workflow and optional template.
- Operational settings now sit under **Advanced workflow** with safe defaults.
- Quick Quotes show **Quote Total** rather than Project Investment.
- Quote Templates now support **Use**, **Duplicate** and **Delete**.
- Staff quote header now shows one clear **Next Action**.
- Undo and redo are available in the quote workspace, including Cmd/Ctrl+Z and redo shortcuts.
- Quote pipeline now separates live pipeline, drafts, accepted and closed records instead of summing every quote into one open figure.
- Publishing is now distinct from email delivery.
- **Publish secure link** creates the live secure proposal.
- **Publish & email** only marks a quote Sent when the configured provider confirms delivery.
- If email is not configured, the quote remains Published and the secure link is ready to copy.
- Only the current live proposal version can be emailed.
- Publishing a newer version marks the previous live version Superseded.
- Proposal validity controls secure-link expiry so two different commercial expiry dates cannot drift.

## Customer authority changes

- Customer permission mode is enforced server-side.
- **View + accept only** disables option changes and questions.
- Interactive mode keeps choices and questions available.
- Customer can explicitly choose **Not proceeding** and optionally provide a reason.
- Superseded, revoked, declined and expired links can no longer act as live proposals.
- Quick Quotes consistently use quote wording in the customer presentation.

## Acceptance and operational handover

New migration `database/009-quote-process-authority.sql` adds the acceptance and conversion authority layer.

Customer acceptance now follows this order:

1. validate the live published version and selected configuration;
2. atomically write the canonical acceptance record;
3. mark that exact publication Accepted;
4. create one idempotent conversion job;
5. attempt Project / Sales Order / stock / PO / finance conversion;
6. if operational conversion fails, the acceptance remains permanently safe and staff can retry the handover.

This prevents an operational error from making a valid customer signature ambiguous.

## My Work integration

Quotes now feed actionable exceptions into the existing Action Authority:

- customer quote question waiting;
- accepted quote handover failed;
- accepted quote payment outstanding;
- sent quote not opened after the follow-up period;
- published quote still awaiting confirmed delivery.

The quote remains the source record. My Work is the action surface.

## Existing systems retained

- Product Hub SKU and bundle authority
- Quick Quote direct-to-Sales-Order workflow
- Project Proposal Project + Sales Order workflow
- private Quote Media storage
- stock allocation and PO shortages
- Xero readiness and payment gating
- Azzy readability and panel fixes
- v1.28 responsive workspace authority
- customer/internal data separation

## Required database order

For a new Quote Studio deployment, apply in this order:

1. `database/007-quote-studio.sql`
2. `database/008-quote-media.sql`
3. `database/009-quote-process-authority.sql`

## Optional email environment variables

- `RESEND_API_KEY`
- `QUOTE_FROM_EMAIL`

Without them, secure publication still works and Pool Shed accurately reports **Published - Link ready** rather than pretending an email was sent.

## Verification completed

- `npm run test:deployment` PASS
- `npm run test:actions` PASS
- `npm run build` PASS
- runtime validation PASS
- Azzy contrast/panel guards PASS
- responsive workspace guard PASS
- quote customer-isolation guard PASS

The sandbox Chromium policy blocks localhost and file navigation, so a fresh interactive browser smoke test could not be executed in this environment. Browser smoke remains a required preview-deployment gate before production promotion.
