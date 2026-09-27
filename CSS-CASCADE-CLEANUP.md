# CSS Cascade Cleanup

This pass fixes CSS authority/cascade problems without changing the Industrial Aqua token palette.

## Changes

- Added `scripts/css-modules.mjs` as the single canonical list and load order for all 38 maintained runtime CSS modules.
- Updated CSS build and architecture/ownership tests to consume that manifest, so late modules can no longer bypass CSS architecture validation.
- Removed declarations from earlier layers only when a later authority layer owns the exact same selector + property in the same at-rule context:
  - `10-legacy-compat.css`: 78 shadowed declarations removed.
  - `41-sales-order-command.css`: 370 shadowed declarations removed.
  - `42-sales-order-parity.css`: 72 shadowed declarations removed.
- Reduced generated `app.css` from 2,961 to 2,774 `!important` declarations and by about 20 KB without changing the winning declaration map.
- Scoped Automation's `.action-row` rule to `.automation-command .action-row` so it cannot leak into unrelated screens.
- Scoped responsive topbar rules to `.main > .topbar`.
- Changed service-worker handling of versioned CSS/JS to network-first with cache fallback, and forced install-time cache revalidation. This prevents stale cached CSS from defeating a current deployment.
- Rebuilt `public/assets/css/app.css` and `dist/`.

## Verification

- `bash scripts/build.sh` — passes and produces a validated deployable `dist/`.
- CSS architecture — passes all 38 maintained modules.
- UI ownership, visual-system, contrast, semantic-surface, responsive and current Sales Order checks — pass.
- Cascade winner comparison against the original project found no winner changes except the intended Automation and topbar selector scoping.
- `npm run validate` proceeds through the CSS/UI/runtime suites; in this extracted environment it stops at `test-accounting-database.mjs` because `@electric-sql/pglite` is not installed locally.
