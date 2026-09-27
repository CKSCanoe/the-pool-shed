# Pool Shed v1.27.1 Deployment Hotfix Audit

## Reported production build failure

Vercel completed the Pool Shed application build, then failed during dependency installation with `ERR_PNPM_OUTDATED_LOCKFILE` because `package.json` declared `playwright-core@^1.55.0` but the root importer in `pnpm-lock.yaml` did not contain that dependency.

## Root cause

The v1.27.0 browser acceptance work added Playwright Core to `devDependencies`, but the pnpm lockfile retained only `@electric-sql/pglite`. Vercel uses frozen pnpm lockfiles in CI, so manifest and lockfile drift correctly blocked the deployment.

This was a release-packaging defect. It was not a Pool Shed runtime, My Work, Action Authority, Approval Authority, Supabase or Vercel application-code failure.

## v1.27.1 correction

- `package.json` and the root pnpm importer now contain the same development dependencies.
- `playwright-core` is locked to 1.55.0 for the `^1.55.0` manifest specifier.
- The lockfile contains the Playwright Core 1.55.0 package integrity, Node engine requirement and executable metadata.
- Playwright remains development-only and is not added to Pool Shed browser runtime code.
- `scripts/test-deployment-lock-v1271.mjs` verifies manifest/lock agreement without external dependencies.
- `scripts/build.sh` runs the manifest/lock guard before producing `dist`.
- `npm run validate` now begins with `test:deployment` before the retained Action and Foundation suites.
- Runtime/cache/version references are advanced to 1.27.1 so the corrected package can be distinguished from the failed 1.27.0 release.
- The v1.27 Action Authority release guard is patch-forward compatible across 1.27.x releases.

## Retained authority

No intended business-process or UI behaviour changes are introduced by this deployment patch. The following remain retained:

- v1.27 My Work, Action Authority and Approval Authority
- controlled Stock Take approval workflow
- v1.26 Identity, Permission, Audit and Record Router authorities
- Permission Inspector
- v1.25 Notifications Command
- Executive Premium Steel Blue visual system
- Sales, CRM, Projects, Product Hub, Inventory, Purchasing, Warehouse, Fulfilment, Finance, Analytics, Automation and Settings workflows

## Fresh verification on hotfix tree

Passed:

- deployment manifest/lock synchronisation guard
- v1.27.1 release/cache hotfix guard
- complete v1.27 Actions/Approvals suite
- complete v1.26 Foundation retention suite
- complete v1.25 Notifications retention suite
- production build
- public runtime validation
- built `dist` runtime validation
- release asset audit: 60 referenced assets present and all public/server/API JavaScript parses
- stale v1.27.0 deployable runtime/cache reference scan

The broad retained validator again reaches the PGlite-backed database test boundary without an application assertion failure before it. This execution environment still cannot install `@electric-sql/pglite`; that existing environment limitation is independent of the pnpm lockfile defect corrected here.

## Deployment expectation

The exact failure reported by Vercel, `ERR_PNPM_OUTDATED_LOCKFILE` for missing `playwright-core@^1.55.0`, is addressed by synchronising the root importer and package records in `pnpm-lock.yaml`. Vercel should therefore be able to perform its frozen dependency install against the corrected v1.27.1 manifest/lock pair, subject to normal registry availability in Vercel's build environment.
