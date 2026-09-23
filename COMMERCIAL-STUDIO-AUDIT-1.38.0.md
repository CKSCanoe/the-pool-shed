# Pool Shed v1.38.0 - Commercial Studio Release Audit

## Release authority

Base: v1.37.0 Design Lab Parity, retaining v1.36 acceptance automation and v1.34 Supabase/media authority.

## Commercial calculation verification

Dedicated `scripts/test-quote-commercial-studio-v138.mjs` verifies the real Quote Studio engine, including:

- £1,000 net / £600 cost produces 40% margin;
- a quote-level 45% minimum margin triggers approval at 40%;
- a 50% target margin on £600 cost calculates £1,200 target net sell;
- a fixed £300 deposit on £1,200 gross produces a 25% effective deposit;
- a fixed deposit overrides the default percentage deposit for that quote only;
- hidden customer payment breakdown produces no milestone rows in the public snapshot;
- customer snapshot does not expose cost snapshots or margin controls;
- frozen commercial version retains deposit method, fixed deposit amount and effective deposit percentage;
- applying the target margin updates selected sell pricing to the requested margin;
- staff preview state uses an expiring v1.38 preview record.

## Visual/runtime QA

Chromium QA at 1920 x 1080 verified:

- Quote Studio Settings has visible Back to Pool Shed navigation;
- Quote Studio Settings Control Centre renders with the new commercial identity;
- Commercial Studio renders and accepts quote-specific target margin, minimum margin and fixed deposit;
- all quote detail tabs render without runtime failure after helper restoration;
- bespoke fixed deposit calculation persists through the real form handler;
- runtime JavaScript errors: 0.

The sandbox browser policy blocks normal localhost/file navigation, so the cross-tab Preview change is covered by engine/portal regression tests rather than a browser navigation test in this environment. The production implementation uses same-origin localStorage with explicit expiry, which is shared between same-origin tabs unlike the previous sessionStorage design.

## Full release gates

Passed:

- `npm run test:deployment`
- `npm run test:actions`
- `npm run build`
- `python scripts/qa-browser-v138.py`

The deployment suite retains Quote Studio, Design Lab parity, Supabase fresh-install authority, Product/CRM media, atomic acceptance, secure Quote Media, customer portal isolation, Quick Quote/Project workflow, deployment lock, Azzy contrast/panel and responsive workspace guards.

## Data and security boundary

Quote-level commercial controls remain internal. Public proposals receive presentation-safe pricing and payment information but not supplier cost, margin target, margin floor, internal SKU cost, stock, POs or operational handover controls.

## Database impact

No schema migration. v1.38 stores the commercial profile and presentation overrides inside the existing protected quote/workspace model and freezes them into the existing commercial publication snapshot.
