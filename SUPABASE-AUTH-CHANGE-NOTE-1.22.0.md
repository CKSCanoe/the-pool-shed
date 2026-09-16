# Supabase authentication change note — v1.22.0

## Summary

The Supabase project and Pool Shed data model were **not replaced or migrated** in v1.22.0. The release keeps the same browser Supabase client configuration, Auth users, `user_profiles`, workspace snapshot flow, project storage use and publishable-key build model from the v1.21.0 full-system baseline.

## What changed

1. **Supabase is now the only bootstrap authentication authority.**
   - v1.21.0 initially derived `isAuthenticated` from the local `poolshed:v169:sessionUserId` marker before Supabase boot validation.
   - v1.22.0 always starts unauthenticated and waits for `supabase.auth.getSession()` or a successful Supabase sign-in.
   - The local marker remains only as user/session UX history. It cannot grant access.

2. **Inactive Supabase profiles are actively denied.**
   - A `user_profiles.active = false` record now stops workspace entry and signs the Supabase session out.
   - The staff user receives the non-technical Access Unavailable screen.

3. **Existing enrolled TOTP MFA is respected.**
   - After password/session validation Pool Shed checks `supabase.auth.mfa.getAuthenticatorAssuranceLevel()`.
   - If the session can be promoted from `aal1` to `aal2`, Pool Shed presents the authenticator-code screen and verifies with `challengeAndVerify` before loading operational data.
   - v1.22.0 does not automatically enrol staff into MFA or force new MFA policy on existing accounts. It supports enrolled factors safely and leaves future mandatory-enrolment policy to the later live-auth acceptance stage.

4. **Session-expiry and recovery presentation improved.**
   - A previous local session marker with no valid Supabase session now opens the dedicated Session Ended state rather than appearing as a normal application session.
   - Password-reset success copy is deliberately generic to avoid unnecessary account-discovery information.

5. **The login no longer exposes implementation details.**
   - Staff do not see Supabase, Vercel, GitHub, deployment architecture or platform-hardening copy.
   - If Supabase runtime configuration is unavailable, the screen says only that sign-in is temporarily unavailable and asks the user to contact their Pool Shed administrator.

## What did not change

- No Supabase project was created, deleted or switched.
- No Supabase database schema migration was applied.
- No `user_profiles` or `workspace_snapshots` table contract was changed.
- No live Supabase rows were edited by this release build.
- No RLS policy was changed in this package.
- The build still receives `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` and writes only the public runtime values into `dist/config.js`.
- Service-role/secret keys are not added to the browser bundle.
- Xero remains `Ready to Connect` and is not activated by this release.

## Live-environment follow-up

Before production sign-off, test the v1.22.0 flow against the real Supabase project with representative Admin, Accounts, Warehouse/Engineer and disabled-user accounts. If mandatory MFA is later enabled for sensitive roles, validate the matching database/RLS/AAL policy at the same time rather than relying only on the browser challenge.
