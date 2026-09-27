# Azzy Brain Gateway

This small server is the only component that should be exposed through your secure HTTPS tunnel. Do **not** expose Ollama's native port `11434` to the internet.

## Office Mac

1. Keep Ollama running with `qwen3:8b` installed.
2. Copy `.env.example` to `.env`.
3. Generate a long random token and place it in `AZZY_GATEWAY_TOKEN`.
4. Run `./START-AZZY-BRAIN.command` or `node server.mjs`.
5. Verify locally:

```bash
curl -H "Authorization: Bearer $AZZY_GATEWAY_TOKEN" http://127.0.0.1:8787/health
```

## Hosted Pool Shed

Expose port 8787 through a stable HTTPS tunnel or private reverse proxy. Configure these server-side environment variables in the hosted Pool Shed deployment:

```text
AZZY_OLLAMA_URL=https://your-secure-azzy-brain-hostname
AZZY_OLLAMA_TOKEN=<same strong token>
AZZY_OLLAMA_MODEL=qwen3:8b
AZZY_MEMORY_MODE=external
```

The token belongs only in the server environment. Never put it in browser JavaScript.

The gateway only exposes `/api/tags`, `/api/chat` and `/health`, only accepts the configured model(s), limits request size/concurrency, and requires the bearer token on every request.
