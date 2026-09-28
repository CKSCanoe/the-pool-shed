# Azzy origin hotfix

This build fixes the `Invalid origin.` failure from `/api/azzy` on Vercel.

## What was wrong

The previous Azzy API compared the browser `Origin` header to `APP_ORIGIN` using an exact string equality check. That could reject legitimate Pool Shed requests when Vercel used a preview URL, deployment alias, custom domain, or when `APP_ORIGIN` had a trailing slash or had accidentally been set to the Azzy gateway URL.

## What this build does

- Accepts the real same-origin Pool Shed host used for the `/api/azzy` request.
- Normalises configured origins rather than relying on fragile raw string equality.
- Supports `APP_ORIGIN` and optional comma-separated `APP_ORIGINS`.
- Recognises Vercel `VERCEL_URL` and `VERCEL_PROJECT_PRODUCTION_URL` origins.
- Continues to reject cross-site browser origins.
- Keeps local development behaviour working.

## Correct environment variable roles

`APP_ORIGIN` is the Pool Shed website URL, for example:

    APP_ORIGIN=https://your-pool-shed.vercel.app

It is NOT the AI gateway address.

The AI gateway belongs in:

    AZZY_OLLAMA_URL=https://your-secure-azzy-gateway.example
    AZZY_OLLAMA_TOKEN=<same strong bearer token used by the gateway>
    AZZY_OLLAMA_MODEL=qwen3:8b

A Vercel deployment cannot reach an Ollama gateway at `127.0.0.1` on an office Mac. The gateway needs a secure stable address that Vercel can reach if you want hosted Pool Shed to use the local Qwen model.

## Verification

Passed:

- Azzy origin policy regression test
- `npm run test:azzy-production`
- `npm run build`
