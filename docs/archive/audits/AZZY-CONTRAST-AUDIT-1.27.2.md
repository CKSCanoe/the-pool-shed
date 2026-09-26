# Pool Shed v1.27.2 — Azzy Contrast & Readability Audit

## Scope

This release is a focused visual/accessibility correction built from the complete **Pool Shed v1.27.1 Deployment Hotfix** project. It preserves the full application, migrated business data behaviour, authentication authority, My Work, Action Authority, Approval Authority, Foundation Authority, Notifications Command and Executive Premium Steel Blue system.

No Supabase schema, RLS policy, authentication contract, canonical data authority, business workflow or operational calculation was intentionally changed by this release.

## Reported issue

The floating Azzy assistant showed pale text on pale Steel Blue surfaces, most visibly on the suggested-question buttons. The close control and some secondary controls were also too faint in light mode.

## Root cause

The floating assistant is mounted directly under `document.body`, outside the main application shell. The Executive Premium component authority intentionally scopes shared button/input rules under `.main`, so those rules did not govern the floating Azzy controls.

The Automation Command stylesheet supplied the correct soft action background but some floating controls did not have an explicit semantic foreground colour. They therefore inherited legacy/general button text rules that produced insufficient contrast.

## v1.27.2 correction

A dedicated, scoped Azzy floating-assistant contrast authority was added to `public/assets/css/system/52-automation-command.css` and compiled into the production CSS bundle.

The floating assistant now explicitly governs:

- primary and secondary copy;
- assistant heading and supporting text;
- close control and hover state;
- mode controls and selected mode;
- suggested-question buttons;
- question input, placeholder, hover and focus states;
- primary Ask action;
- answer copy;
- source chips;
- answer actions;
- floating assistant status badge;
- keyboard focus-visible rings.

All colours use the existing Executive Premium semantic design tokens, so light and dark mode remain coupled to the approved theme rather than hard-coded one-off colours.

The floating assistant markup was also hardened so close, mode and quick-question controls are explicitly `type="button"`, and the close control has an accessible label.

## Measured contrast

The new automated contrast guard calculates ratios directly from the production design tokens.

### Light mode

- Quick-action text on Steel Blue soft surface: **10.73:1**
- Primary copy on default surface: **15.82:1**
- Secondary copy on default surface: **5.34:1**
- Header secondary copy on subtle surface: **4.74:1**

### Dark mode

- Quick-action text on Steel Blue soft surface: **11.89:1**
- Primary copy on default surface: **15.21:1**
- Secondary copy on default surface: **8.11:1**
- Header secondary copy on subtle surface: **7.40:1**

These combinations meet WCAG AA normal-text contrast thresholds.

## Release/cache identity

Runtime and cache references are advanced to **v1.27.2**. The retained service-worker family remains `my-work-action-authority`, with the cache namespace now `pool-shed-v1.27.2-my-work-action-authority`. This forces deployed browsers to retrieve the corrected presentation assets while preserving the v1.27 release authority contract.

## Verification performed

Passed on the final working tree:

- deployment manifest/lock synchronisation guard;
- v1.27.1 deployment-hotfix retention guard, made patch-forward for v1.27.x;
- v1.27.2 Azzy contrast/accessibility guard;
- v1.27.2 release wiring guard;
- complete Automation/Azzy retained suite;
- Executive Premium interaction, theme and colour contrast suites;
- readability hardening suite;
- complete v1.27 Action/Approval/My Work suite;
- complete v1.26 Foundation Authority suite;
- production build;
- public runtime validation;
- built `dist` runtime validation;
- release asset audit: **60 referenced assets present; all public/server/API JavaScript parses**;
- post-database-boundary accounting API, project engine, project AI, bundle system, dashboard review and dashboard command checks.

The broad `npm run validate` passed all checks before the database-test boundary and then stopped only because this sandbox does not have `@electric-sql/pglite` installed. The three PGlite-backed database tests therefore could not execute here. The package manifest and pnpm lockfile still declare the expected dependency for a normal dependency install.

The repository's Playwright browser-smoke script could not run in this sandbox because `playwright-core` is not installed in the local runtime. A direct Chromium attempt was also not reliable in this container because of browser-process/D-Bus startup behaviour. Pixel-level browser automation is therefore not claimed by this audit.

## Retained system authority

This release does not replace or reset existing Pool Shed data. It retains the v1.27.1 application and its existing data bridges, permissions and workflows. The change is deliberately limited to Azzy presentation/accessibility, related regression coverage and release/cache identity.
