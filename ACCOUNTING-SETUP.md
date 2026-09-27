> **v1.21.0 safety gate:** keep `XERO_INTEGRATION_MODE=ready` until Pool Shed production acceptance is complete. Ready mode blocks all live Xero provider calls. See `XERO-CONNECTION-READY.md`.

> For project phase invoices, also follow PROJECT-SETUP-AND-USER-GUIDE.md and apply the project migrations. The full-order limitation below describes the standalone sales-order invoice form.

# Accounting connection setup

This release adds a server-backed Xero draft-invoice and payment-status integration. It is not connected to a live organisation. Xero remains the accounting ledger; Pool Shed remains responsible for orders, receiving and stock. Do not enter production credentials into chat or public/config.js.

## Deploy and grant access

1. Back up the existing database and export any unsynchronised browser work. Test on a staging deployment first.
2. Apply `database/001-accounting.sql` in the Supabase SQL editor as the database owner. It creates separate finance tables and service-only functions; it does not change warehouse records.
3. Add authorised Supabase Auth user IDs to `ps_finance_members` with workspace ID `pool-bros-main` and role `admin`, `accountant` or `viewer`. This is a database-administrator action. Existing client-side Admin labels do not grant finance access. An admin connects Xero; accountants can queue and reconcile drafts; viewers can read.
4. Deploy the entire project root to Vercel, including `api/` and `server/`. Uploading only `dist/` cannot run accounting. Node 22 or later is required. Install dependencies, then run the existing build command.
5. Set the following server environment variables:

| Variable | Purpose |
| --- | --- |
| SUPABASE_URL | Existing Supabase project URL |
| SUPABASE_SERVICE_ROLE_KEY | Server-only database access |
| SUPABASE_PUBLISHABLE_KEY | Existing public browser key used by the build |
| APP_ORIGIN | Exact HTTPS application origin, without trailing slash |
| XERO_CLIENT_ID / XERO_CLIENT_SECRET | Credentials for a Xero OAuth Web App |
| XERO_TOKEN_KEY | 32 random bytes encoded as base64; retained securely for token decryption |
| XERO_WEBHOOK_KEY | Signing key from Xero webhook configuration |
| CRON_SECRET | A long random scheduler authentication secret |
| FINANCE_WORKSPACE_ID | `pool-bros-main` unless deliberately using another workspace |
| XERO_INTEGRATION_MODE | Keep `ready` until the production-acceptance gate is explicitly approved |

6. In the Xero developer portal, prepare the Web App with the exact callback `https://YOUR-HOST/api/finance?action=callback` and the granular scopes documented in `XERO-CONNECTION-READY.md`. Do not authorise the live Pool Bros organisation yet.
7. Keep `XERO_INTEGRATION_MODE=ready`. In this mode Pool Shed reports configuration readiness but rejects OAuth authorisation, tenant selection, webhooks, Xero lookups, document export, reconciliation calls and scheduled sync with a locked status.
8. Prepare the future webhook URL `https://YOUR-HOST/api/finance?action=webhook` and scheduler route `/api/finance?action=cron`, but do not activate either against the live organisation yet. The example schedule remains in `vercel-accounting-schedule.example.json`.
9. When the rest of Pool Shed has passed production acceptance, use a Xero Demo Company first. Only after the demo acceptance checklist passes should an authorised Finance Admin change the secure deployment setting to `XERO_INTEGRATION_MODE=live`, complete OAuth and explicitly select the intended organisation.

## What synchronises

Choose a sales order, load existing Xero contacts/accounts/taxes, check currency, due date and all lines, and queue a draft. Contact selection uses Xero IDs, so names do not create duplicate contacts. One draft per full sales order is supported. Net amounts are sent with the explicitly selected tax treatment. Mixed-tax and partial invoices must currently be handled in Xero.

The worker creates DRAFT invoices only. Approve/send the invoice in Xero. Pool Shed reads the linked invoice status, number, amounts paid/credited/due and authoritative remote details, including payment reversals. It never turns a payment into a stock movement. It does not overwrite posted Xero documents with later local order edits.

Each run handles up to one queued export and three linked invoice checks, oldest check first; webhook notifications prioritise affected invoices. This deliberately bounded first implementation needs throughput tuning for large invoice volumes. It is eventual synchronisation, not an instantaneous guarantee. Only linked records are imported; this is not a full import of every Xero transaction.

Uncertain submissions move to review. “Find matching Xero draft” searches the permanent Pool Shed reference and only links a unique matching contact/type. It never blindly recreates an ambiguous invoice. If there is no match, an accountant must investigate; automatic re-export is intentionally unavailable in this build. Failures before submission and failures on already-linked documents retry with increasing delay, up to five retries; uncertain creates require review. Connection and polling failures are visible. Operational monitoring still needs deployment configuration.

## Optional server-enforced workspace saves

`database/002-workspace-hardening.sql` replaces existing snapshot policies. Before applying it, enrol all authorised users in `ps_workspace_members` (admin/operator/viewer) and arrange a coordinated client update. You can create/enrol that table first, or apply the migration in a maintenance window and enrol immediately afterwards.

Deploy with `SECURE_WORKSPACE_WRITES=true`. The build exposes only this boolean. Saves then use the authenticated `ps_workspace_save` function with no fallback to direct table writes. The database rejects stale revisions, negative/over-reserved stock and removal/changes to historical receipt or putaway events, and retains previous snapshots. Membership is verified on the server. Old clients lose write access after the migration. Test real users before reopening the system.

This strengthens snapshot saving; it does not replace the snapshot architecture with individual stock transactions. Conflicting offline snapshots still require manual review. Module-specific permissions, a full transactional stock ledger and multi-device production load testing remain outstanding.

## Backups and acceptance checks

Set a separate `BACKUP_ENCRYPTION_KEY` (32 random bytes, base64), then run:

```
node scripts/accounting-backup.mjs export /secure/path/pool-shed-backup.json
node scripts/accounting-backup.mjs verify /secure/path/pool-shed-backup.json
```

The export excludes OAuth credentials, encrypts content and verifies checksum/document links. Pause writes while exporting for consistency. This is not a replacement for transaction-consistent managed database backups. Configure those in Supabase, test restoration into a separate project, and establish retention and monitoring. The export tool does not restore live data automatically.

Before production use, test a Xero demo organisation: authorisation/reconnection; two simultaneous queue requests; draft approval; part-payment/full payment/reversal; credit/void status; repeated webhook; expired access token; connection loss immediately after export; revoked permissions; offline warehouse receipt followed by reconnect. Run a real restore drill. None of these live-provider acceptance steps has been performed in this workspace.

## Official references checked

- [Xero scopes](https://developer.xero.com/documentation/guides/oauth2/scopes/)
- [OAuth authorisation](https://developer.xero.com/documentation/guides/oauth2/auth-flow/)
- [Webhook requirements](https://developer.xero.com/documentation/guides/webhooks/overview/)
- [Xero idempotent requests](https://developer.xero.com/documentation/guides/idempotent-requests/idempotency/)
- [Vercel scheduling limits](https://vercel.com/docs/cron-jobs/usage-and-pricing)
