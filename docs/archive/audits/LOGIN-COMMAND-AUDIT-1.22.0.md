# Pool Shed v1.22.0 — Login Command release audit

## Release purpose

v1.22.0 replaces the legacy staff sign-in presentation with the approved premium Pool Shed login while retaining the v1.21.0 full operational system. The public/staff login deliberately excludes the proposed Platform Hardening view and all Supabase/Vercel/GitHub implementation detail.

## Staff-facing login

The production login now provides:

- Pool Bros logo and Pool Shed identity
- Operations Command System positioning
- premium flat navy/slate visual treatment consistent with the locked Pool Shed design system
- email/password sign-in
- show/hide password control
- generic failure messaging
- password reset
- password update after recovery
- enrolled authenticator MFA challenge
- session-ended state
- inactive/access-denied state
- responsive mobile layout
- discreet `Pool Shed v1.22.0 · Pool Bros Ltd` footer at the very bottom

No Platform Hardening screen is included in the runtime.

## Authentication safety changes

See `SUPABASE-AUTH-CHANGE-NOTE-1.22.0.md` for the exact comparison with v1.21.0. The material safety improvements are:

- browser local-storage session markers no longer initialise authenticated state
- Supabase session validation precedes workspace entry
- inactive `user_profiles` are denied
- existing enrolled TOTP MFA/AAL2 requirements are respected before workspace data is loaded

No Supabase database/schema/project migration is included.

## Regression evidence

Fresh v1.22.0 verification confirms:

- Login Command tests: PASS
- v1.22.0 release/cache wiring: PASS
- full-system v1.21+ regression guard: PASS
- Xero Ready-mode engine/API guards: PASS
- Settings security enforcement: PASS
- Smart Assistant authority: PASS
- Warehouse FIFO: PASS
- Goods Note shipment lock: PASS
- CSS architecture: PASS
- flat visual consistency: PASS
- readability hardening: PASS
- runtime validation (`public` and `dist`): PASS
- production build: PASS
- post-database-boundary non-database suite: PASS
- release asset audit: 50/50 referenced assets present; public/server/API JS parses

## Known environment limitations

`npm run validate` passes the application suite until `scripts/test-accounting-database.mjs`, where this extracted environment cannot import the declared `@electric-sql/pglite` development dependency. The remaining non-database tests after that boundary were run independently and passed.

`npm run test:browser` was attempted and cannot start because the extracted environment does not contain Playwright. No automated pixel/browser acceptance is claimed.

## Xero

Xero remains deliberately parked in `Ready to Connect` mode. v1.22.0 does not authorise a Xero tenant or start live sync.
