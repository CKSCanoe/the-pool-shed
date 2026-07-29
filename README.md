# The Pool Shed

Production deployment package for the Pool Shed application.

## Deploying to Vercel

1. Add the existing `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` environment variables.
2. Deploy the repository root.
3. Vercel runs `npm run build` and serves the generated `dist` directory.

The build does not run SQL migrations or change the Supabase schema.

## Local checks

```bash
npm run validate
npm run build
npm run audit
```
