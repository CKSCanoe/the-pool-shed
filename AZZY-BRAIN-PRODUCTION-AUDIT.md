# Azzy production brain audit

Baseline: Pool Shed 1.45.1 Accessibility Hardened with the exact Azzy Jarvis replacement.

## Completed in this pass

- Added a dedicated office-side Azzy Brain Gateway in `azzy-brain-gateway/`.
- Raw Ollama `11434` does not need to be exposed.
- Gateway requires a long bearer token.
- Gateway limits routes to `/api/tags`, `/api/chat` and `/health`.
- Gateway supports normal and streamed Ollama responses.
- Gateway limits model names, body size and concurrent requests.
- Hosted Azzy Ollama client now supports `AZZY_OLLAMA_TOKEN` server-side authentication.
- Added durable per-user Azzy state using `database/012-azzy-memory.sql`.
- Added external-memory hydration/persistence around chat, context, attention and action approval.
- Product, stock, SO, PO, project and finance data remain canonical Pool Shed data. The Azzy memory table contains assistant state only.
- The exact Azzy UI/CSS transplant was not redesigned in this pass.
- No credentials, `.env` file or runtime test memory are packaged.

## Required hosted environment

```text
AZZY_OLLAMA_URL=https://<secure stable Azzy gateway hostname>
AZZY_OLLAMA_TOKEN=<strong shared gateway token>
AZZY_OLLAMA_MODEL=qwen3:8b
AZZY_MEMORY_MODE=external
```

## Required database migration

Run `database/012-azzy-memory.sql` against the existing Pool Shed Supabase project after the existing migrations.

## Verification completed

`npm run test:azzy-production` passes:

- secure gateway auth and model restriction;
- hosted Ollama client bearer authentication;
- normal and streamed gateway responses;
- durable per-user memory import/export;
- exact Azzy UI replacement regression;
- Pool Shed procurement/warehouse/supplier/action integration suite.

`npm run build` passes and includes the same gateway/memory checks in the build gate.

## Fail-safe behaviour

If the Qwen/Ollama gateway is offline, Azzy's deterministic Pool Shed intelligence remains available. Pool Shed itself is not dependent on Ollama being online.
