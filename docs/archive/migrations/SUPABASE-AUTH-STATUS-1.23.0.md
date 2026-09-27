# Supabase authentication status — v1.23.0

## v1.23.0 visual overhaul

The v1.23.0 visual-system release makes **no new Supabase project, schema, provider or database changes**.

Supabase remains the authentication provider and the existing runtime configuration contract remains:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- server-only secrets stay outside the browser bundle

No RLS policy, Auth user, `user_profiles` row, workspace snapshot contract or live Supabase data is changed by this release.

## What previously changed in v1.22.0

Compared with the original v1.21 full-system baseline, v1.22 tightened the browser authentication flow without migrating the Supabase project:

1. Pool Shed no longer treats the old local-storage session marker as authentication authority during bootstrap.
2. Workspace entry waits for a valid Supabase session or successful Supabase sign-in.
3. `user_profiles.active = false` explicitly denies access and signs the Supabase session out.
4. Already-enrolled TOTP MFA is respected. A session that needs `aal2` is challenged through Supabase MFA before operational data is loaded.
5. Password recovery, expired-session and access-denied presentation were improved and stripped of technical platform language.

See `SUPABASE-AUTH-CHANGE-NOTE-1.22.0.md` for the full original comparison.

## What still needs live acceptance

Before final production sign-off, test the package against the actual Supabase project using representative Admin, Accounts, Warehouse/Engineer and disabled-user accounts. Database RLS and MFA policy should be verified in the live Supabase environment rather than inferred only from browser UI behaviour.
