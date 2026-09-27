# Azzy integration · Pool Shed 1.45.1

This release integrates the packaged Azzy engine into Pool Shed as a **read-only Preview intelligence layer**. Pool Shed remains authoritative for authentication, permissions, workspace/Supabase data, stock, orders, procurement, projects, finance, approvals and audit.

## Runtime

- `api/azzy.js` is the authenticated Pool Shed serverless boundary.
- `server/azzy-pool-shed.js` resolves the signed-in Supabase user, workspace membership, profile, permissions, canonical workspace snapshot and workspace revision on the server.
- `server/azzy/` contains the packaged Azzy engine and the adapted Pool Shed normalization/runtime bridge.
- `public/azzy-live.js` + `public/azzy-live.css` provide the embedded assistant UI.
- Existing Pool Shed record links use `PoolShedRouter`; the standalone Azzy route map and standalone `server.js` are not used as the production boundary.

The browser never sends a role, permission set or workspace snapshot to Azzy. It sends only the message and up to five record-context references. The API re-derives authority for every request.

## Preview safety

The first production sequence is deliberately read-only:

- `actions.prepare` and `actions.approve` are not granted.
- `/api/azzy?action=approve-action` is locked.
- Finance is exposed only when the signed-in Pool Shed user has Accounting access and all finance categories represented by Azzy's current coarse `finance.read` capability.
- The old floating assistant is suppressed when `PoolShedAzzyLive` is mounted, but its implementation remains in-tree until Preview acceptance so existing regression checks and rollback remain available.

## Local AI

The engine still supports `AZZY_OLLAMA_MODEL` (including `qwen3:8b`) and defaults to the configured Ollama URL. A Vercel function cannot normally reach an Ollama service bound only to an office machine's `127.0.0.1`; do not expose the raw Ollama port publicly. Without a reachable Ollama endpoint, Azzy uses its deterministic Pool Shed intelligence path.

## Environment

Existing Pool Shed variables remain required. Azzy additionally understands:

- `POOL_SHED_WORKSPACE_ID` — canonical workspace ID; defaults to `pool-bros-main` to match this release.
- `APP_ORIGIN` — optional exact origin check for Azzy POST requests.
- `AZZY_OLLAMA_MODEL` — optional local model name.
- `AZZY_OLLAMA_URL` — optional reachable Ollama service URL.

## Verification

Run:

```bash
node scripts/test-azzy-live-integration-v1451.mjs
npm run test:azzy-ui
npm run build
```

The standalone packaged Azzy suite should also remain at 169 passing checks before enabling action execution.

## Next rollout gate

After Preview acceptance across manager/operations/engineer/warehouse-style roles, wire Azzy's prepared warehouse and purchasing action types into Pool Shed's existing `action-authority` / approval / domain executors with permission, revision, stock/demand and current-record revalidation immediately before execution. Finance should remain review-only initially, and no Azzy path should call a bank-payment operation.
