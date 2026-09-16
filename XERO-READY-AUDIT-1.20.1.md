# Pool Shed v1.20.1 Xero Connection Ready Audit

## Release intent

This patch prepares Pool Shed for a future Xero connection without authorising or synchronising a live Xero organisation. The live integration is deliberately locked while the rest of Pool Shed remains under acceptance and workflow testing.

**Release:** 1.20.1  
**State:** Connection-ready, live provider access locked  
**Live Xero organisation connected:** No  
**Live Xero data imported:** No  
**Live sync/webhooks/cron enabled:** No

## Safety gate

`XERO_INTEGRATION_MODE` defaults to `ready`.

In Ready mode Pool Shed allows authorised Finance/Admin users to inspect integration readiness but refuses every provider operation that could connect to or modify/read Xero:

- OAuth Connect
- OAuth callback completion
- tenant/organisation lookup and selection
- Xero contacts/accounts/tax lookups
- invoice/bill draft export
- linked-document refresh
- reconciliation calls that query Xero
- manual Sync Now
- scheduled sync/cron
- webhook receipt/processing

The API returns a locked response before making an outbound Xero call.

Changing the deployment to `XERO_INTEGRATION_MODE=live` is necessary but not sufficient to connect Xero. The secure server prerequisites must also be complete, and a Finance Admin must still perform OAuth and deliberately choose/confirm the Xero organisation.

## Current Xero API contract

Prepared OAuth 2.0 scopes use Xero's 2026 granular Accounting scope model:

- `offline_access`
- `accounting.invoices`
- `accounting.contacts.read`
- `accounting.settings.read`
- `accounting.payments.read`

The deprecated broad `accounting.transactions` scope is not requested.

The intended callback is:

`https://<APP_ORIGIN>/api/finance?action=callback`

The intended webhook endpoint is:

`https://<APP_ORIGIN>/api/finance?action=webhook`

The intended scheduled worker endpoint is:

`https://<APP_ORIGIN>/api/finance?action=cron`

None of those live-provider paths is enabled while the integration mode remains `ready`.

## Security retained

The existing accounting integration retains:

- server-only client credentials
- AES-256-GCM encrypted OAuth token storage
- OAuth state/cookie validation
- fixed redirect URI
- Xero tenant ID binding
- Xero document ID mapping
- signed webhook validation
- finance-role checks
- origin checks on writes
- synchronisation lease/lock
- idempotency keys for draft creation
- ambiguous-create protection and reconciliation review
- no contact-name-first reconciliation
- service-role-only finance database access

No secret value is returned by the readiness API or rendered in the Settings UI.

## UI changes

Finance Command now distinguishes:

- **Ready to Connect**: integration prerequisites prepared, provider access locked
- **Setup incomplete**: one or more secure deployment prerequisites missing
- **Connected**: reserved for the later live state after OAuth and tenant selection

Settings → Integrations contains a dedicated **Xero Connection Readiness** review. It clearly states that the live connection is locked until production acceptance.

Production Readiness treats `Ready to Connect` as an intentional prepared integration state rather than a broken connection.

## Activation prerequisites

Do not change the integration to Live until all of these are complete:

1. Full Pool Shed functional acceptance.
2. Browser/device acceptance.
3. Database test environment available and database-only suites passing.
4. Real user-role and finance-permission acceptance.
5. Backup and restore drill.
6. Xero Demo Company OAuth and sync acceptance.
7. Accountant approval of account codes, VAT/tax mappings and contact strategy.
8. Payment, credit, void, reversal and partial-payment acceptance.
9. Token-refresh and reconnect acceptance.
10. Webhook signature/replay/duplicate/failure acceptance.
11. API rate-limit and temporary-outage recovery acceptance.
12. Written approval to connect the Pool Bros Xero organisation.

Only then change the secure deployment setting to:

`XERO_INTEGRATION_MODE=live`

## Verification

Dedicated v1.20.1 tests verify:

- Ready mode is the default.
- Valid credentials do not bypass Ready mode.
- Connect and Sync make zero Xero provider calls in Ready mode.
- Live mode requires an explicit environment flag and complete secure prerequisites.
- Only granular Xero Accounting scopes are requested.
- Finance Command and Accounting & Xero show the locked readiness state.
- Settings exposes Xero Connection Readiness.
- v1.20.1 cache/runtime wiring is current.
- Existing live-mode accounting API behaviour still passes when tests explicitly set `XERO_INTEGRATION_MODE=live`.

Protected Production Readiness, Settings security, Finance Command and release asset tests also pass.

The full application validator passes until the existing database-only boundary where `@electric-sql/pglite` is unavailable in this extracted environment. Remaining non-database tests after that boundary pass separately.

The production build and runtime validation pass.

Automated browser smoke cannot run because Playwright is not installed in this package. This remains an explicit acceptance gap and is not reported as passed.

## Files added/changed for this patch

- `server/accounting.js`
- `api/finance.js`
- `public/finance-command-engine.js`
- `public/finance-command-workspace.js`
- `public/accounting-workspace.js`
- `public/settings-command-workspace.js`
- `public/production-readiness-engine.js`
- `public/assets/js/01-legacy-01.js`
- `public/index.html`
- `public/service-worker.js`
- `package.json`
- `ACCOUNTING-SETUP.md`
- `XERO-CONNECTION-READY.md`
- `XERO-CONNECTION-READY.env.example`
- `scripts/test-xero-readiness-engine-v1201.mjs`
- `scripts/test-xero-readiness-api-v1201.mjs`
- `scripts/test-xero-readiness-ui-v1201.mjs`
- `scripts/test-xero-readiness-release-v1201.mjs`

## Conclusion

Pool Shed is structurally ready for a future Xero OAuth connection, but the connection is intentionally parked. No live accounting provider access should occur until the remaining Pool Shed acceptance work is complete and the Xero Demo Company gate has passed.
