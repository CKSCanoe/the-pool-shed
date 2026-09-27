# Azzy production brain + durable memory

This release keeps the exact Azzy UI/CSS transplant unchanged and completes the next backend step for a hosted, multi-user Pool Shed deployment.

## What changed

### Secure shared Qwen/Ollama access

A new `azzy-brain-gateway/` runs on the office Mac beside Ollama. It is deliberately separate from Ollama itself.

The hosted Pool Shed API calls the gateway using:

- `AZZY_OLLAMA_URL`
- `AZZY_OLLAMA_TOKEN`
- `AZZY_OLLAMA_MODEL=qwen3:8b`

The gateway:

- requires a bearer token on every request;
- only exposes `/api/tags`, `/api/chat` and `/health`;
- limits accepted model names;
- limits request size and concurrent Ollama work;
- supports normal and streamed Ollama responses;
- never exposes database credentials to the model or to the browser.

Do not expose Ollama's native `11434` port directly to the public internet.

### Durable memory per Pool Shed login

`database/012-azzy-memory.sql` adds `ps_azzy_memory` keyed by:

- `workspace_id`
- authenticated `user_id`

It stores Azzy conversation state, working contexts, decisions, watches, seen alerts, prepared-action state and Azzy audit history for that user. It does not duplicate Product Hub, stock, SO, PO, Project, Finance or other canonical operational records.

When `AZZY_MEMORY_MODE=external`, the hosted Azzy API hydrates the signed-in user's state at the start of each request and writes it back after state-changing Azzy operations. This removes dependence on a Vercel/server filesystem for conversation continuity.

## Office Mac setup

1. Keep Ollama running.
2. Confirm `qwen3:8b` exists with `ollama list`.
3. Open `azzy-brain-gateway/`.
4. Copy `.env.example` to `.env`.
5. Generate a strong random token and place it in `AZZY_GATEWAY_TOKEN`.
6. Run `./START-AZZY-BRAIN.command`.
7. Confirm the local gateway health endpoint works with the bearer token.
8. Expose **port 8787**, not 11434, through a stable secure HTTPS tunnel/reverse proxy.

## Hosted Pool Shed setup

Add server-side environment variables:

```text
AZZY_OLLAMA_URL=https://<stable secure gateway hostname>
AZZY_OLLAMA_TOKEN=<same gateway token>
AZZY_OLLAMA_MODEL=qwen3:8b
AZZY_MEMORY_MODE=external
```

Then run `database/012-azzy-memory.sql` in the existing Pool Shed Supabase project.

No browser JavaScript should receive `AZZY_OLLAMA_TOKEN`, `SUPABASE_SERVICE_ROLE_KEY`, or raw Ollama access.

## Behaviour if the office brain is offline

Azzy does not take Pool Shed down. The deterministic Pool Shed intelligence/tool path remains available. Natural Qwen narration is skipped until the gateway is reachable again.

## Verification

Run:

```bash
npm run test:azzy-production
npm run build
```
