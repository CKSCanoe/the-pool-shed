# Xero Connection Ready - Deferred Live Activation

Pool Shed v1.21.0 prepares Xero integration without connecting a live Xero organisation.

## Current state

- `XERO_INTEGRATION_MODE` defaults to `ready`.
- Ready mode exposes configuration health to authorised Finance/Admin users but blocks OAuth authorisation, callbacks, webhooks, scheduled sync, lookups, exports to Xero and reconciliation calls that require the provider.
- No Xero organisation should be authorised while Pool Shed remains in system acceptance.
- No provider data is imported or synchronised in Ready mode.

## Prepared OAuth/API contract

OAuth 2.0 web-app flow with a fixed redirect URI:

`https://<pool-shed-origin>/api/finance?action=callback`

Requested granular scopes:

- `offline_access`
- `accounting.invoices`
- `accounting.contacts.read`
- `accounting.settings.read`
- `accounting.payments.read`

Pool Shed stores OAuth tokens only on the server and encrypts them with AES-256-GCM using `XERO_TOKEN_KEY`. Tenant IDs and Xero document IDs are used as stable mappings.

## Environment prepared for future activation

Configure these only in the secure deployment environment, never in browser code:

```text
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
APP_ORIGIN=https://...
XERO_CLIENT_ID=...
XERO_CLIENT_SECRET=...
XERO_TOKEN_KEY=<32 random bytes, base64>
XERO_WEBHOOK_KEY=...
CRON_SECRET=...
FINANCE_WORKSPACE_ID=pool-bros-main
XERO_INTEGRATION_MODE=ready
```

Generate a token key with: `openssl rand -base64 32`.

## Do not enable yet

Keep `XERO_INTEGRATION_MODE=ready` until all of these are complete:

1. Full Pool Shed functional acceptance.
2. Browser/device acceptance.
3. Database integration test environment available.
4. User-role and finance-permission acceptance.
5. Backup/restore drill.
6. Xero Demo Company acceptance.
7. Accountant review of account/tax mappings.
8. Webhook replay, token refresh, rate-limit and failure-recovery tests.
9. Written approval to connect the Pool Bros Xero organisation.

Only after those gates are complete should the secure deployment value be deliberately changed to:

```text
XERO_INTEGRATION_MODE=live
```

Changing the flag does not itself select an organisation. An authorised Finance Admin must still complete Xero OAuth and select/confirm the intended tenant.

## Data ownership

Pool Shed remains the operational authority for orders, projects, stock, fulfilment, chasing, approvals and workflow context. Xero remains the accounting ledger. Stable external IDs are used for reconciliation; display names are not the primary matching key.
