# The Pool Shed — rebuilt workspace + live APIs

This UI uses the same backend contracts as Pool Shed 1.45.1.

## Existing APIs

- `/api/quote` — staff, publish, send, public, accept, process-conversion, media
- `/api/finance` — status, connect, tenants, tenant, lookups, queue, sync, refresh-document, reconcile
- `/api/azzy` — bootstrap, chat, record, attention-seen
- `/api/media` — product/customer list and signed URLs
- `/api/project-review` — project or dashboard AI review
- `/api/project-email` — proposed-extra customer email

Workspace records still live in Supabase `workspace_snapshots` for `pool-bros-main`, saved through `ps_workspace_save` when `secureWorkspaceWrites` is on.

## Connect it

1. Copy `js/config.example.js` over `js/config.js`.
2. Use the same `supabaseUrl` and publishable key as the current Pool Shed deploy.
3. Leave `apiBase` empty if this UI is served from the existing Vercel origin so `/api/*` is same-origin.
4. If the UI is hosted elsewhere, set `apiBase` to that live origin. The server still checks `APP_ORIGIN` and `Authorization`.
5. Sign in with a real `ps_workspace_members` user. Finance actions also need `ps_finance_members`.

Until config is set, **Use offline demo** keeps the sample workspace.

## What becomes live after sign-in

- Lists and records read the shared snapshot
- Finance status / connect / sync hit `/api/finance`
- Publish and staff activity hit `/api/quote`
- Azzy chat hits `/api/azzy`
- Project AI review hits `/api/project-review`
- Extra approval email hits `/api/project-email`

Customer acceptance stays on `/proposal?token=` from the original portal.
