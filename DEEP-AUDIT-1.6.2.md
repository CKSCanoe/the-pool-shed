# Pool Shed Deep Release Audit — 1.6.2

## Scope

This audit was performed against the newly supplied complete production ZIP (`the-pool-shed.zip`), which contained application version **1.6.1** and therefore became the authoritative baseline for this review.

The review covered:
- deployment shell and asset loading;
- service worker/offline cache behaviour;
- Sales Order detail presentation ownership;
- Sales Order customer, item line, variant, catalogue, totals/payment and fulfilment hooks;
- CSS source ownership/cascade;
- build output consistency;
- release metadata and package hygiene;
- the available regression/runtime test suite.

## Primary root cause confirmed

The approved Sales Order Detail Command code was present in the 1.6.1 source, including:
- smarter customer intelligence;
- `Save Order`;
- `Take / Record Payment`;
- clearer tabs;
- Precision Row order lines;
- dedicated Variant column;
- viewport-layer actions menu;
- neutral Product Catalogue presentation.

However, the deployment shell referenced the critical presentation assets using stable, unversioned URLs:

- `./assets/css/app.css`
- `./sales-workspace.js`

The service worker used a cache-first strategy for same-origin static assets. This meant an installed browser could continue satisfying those URLs from a previous cache generation or HTTP cache path even while the source ZIP contained the newer Sales Order code. This is consistent with the supplied screenshot, which showed the legacy `Save changes`, old customer picker, old tabs and teal table header rather than the final `so2-*` presentation layer.

## Additional deployment finding

The 1.6.1 service-worker precache did not include six JavaScript files that are part of the application shell:

- `assets/js/01-legacy-01.js`
- `assets/js/02-legacy-02.js`
- `assets/js/03-pb-import-governance-v192.js`
- `assets/js/04-pb-product-profile-v196-fix.js`
- `assets/js/05-pb-v1100-inventory-product-hub.js`
- `assets/js/06-pb-product-title-persistence-v115-fix.js`

Those files would normally become cached after an online load, but were not guaranteed to be available after service-worker installation alone. The 1.6.2 fix aligns the precache with the real application shell.

## Presentation ownership audit

The approved Sales Order presentation is owned by:
- `public/sales-workspace.js`
- `public/assets/css/system/32-sales-workspace.css`

The business engines remain in the existing runtime files and were not duplicated.

The Sales workspace is loaded after the legacy Sales Order runtime, partial fulfilment and customer picker, so its final `salesOrderDetail`, `salesOrderTabContent`, `customerProfileCard`, tabs and totals presentation overrides remain the final Sales Order presentation layer.

The refined CSS confirms:
- three-column Sales Order summary grid at desktop widths;
- neutral order-line header rather than the old bright-teal strip;
- dedicated Variant column;
- neutral Product Catalogue result states;
- fixed-position `z-index:100000` order-line action menu;
- responsive collapse at the existing breakpoints.

No stock, allocation, VAT, Goods Note, payment, pricing, custom-line, shipping-line or fulfilment engine was replaced by this release.

## Release metadata audit

The supplied 1.6.1 package contained a stale `RELEASE-SHA256.json`:
- 167 entries still matched;
- 16 entries no longer matched the actual current files.

`SALES-CHANGED-FILES.json` also referenced two files that no longer existed:
- `public/sales-workspace.css`
- `dist/sales-workspace.css`

These are release-history artefacts rather than active runtime dependencies. A fresh integrity manifest is generated for the 1.6.2 package.

## Package hygiene audit

The supplied ZIP also contained:
- a complete `.git` directory;
- `.DS_Store`;
- macOS `__MACOSX`/resource-fork packaging artefacts in the outer ZIP.

Those are not production application assets. The returned 1.6.2 package excludes repository metadata and macOS packaging artefacts.

## 1.6.2 corrective changes

The fix is deliberately deployment-focused rather than another UI redesign:

1. `app.css` is loaded as `app.css?v=1.6.2`.
2. `sales-workspace.js` is loaded as `sales-workspace.js?v=1.6.2`.
3. The service-worker cache namespace is advanced to `pool-shed-v1.6.2-asset-freshness`.
4. The service worker precaches the exact versioned presentation assets used by the page.
5. The service-worker precache is aligned with all local JavaScript/CSS shell assets.
6. Service-worker registration uses `updateViaCache: "none"` so the browser checks the worker itself without relying on HTTP cache.
7. Runtime validation was made query-string aware for versioned JS/CSS assets.
8. Active release tests were moved to 1.6.2 expectations rather than continuing to assert the old 1.6.1/cache namespace.
9. The approved Sales Order design and all business engines remain otherwise unchanged.

## Verification actually performed

Passed:
- runtime validation;
- CSS architecture;
- visual consistency;
- contrast/text rhythm;
- colour contrast;
- readability hardening;
- catalogue health actions;
- Bundle Studio actions;
- fulfilment lifecycle;
- release cleanup;
- bundle sales intelligence;
- PO catalogue performance;
- PO picker UI;
- production-overhaul checks;
- Sales table header;
- Sales Order List Option A;
- Sales Order Detail 1.6.2;
- Sales Order asset-freshness regression;
- Sales Order customer picker;
- receiving ledger;
- professional workspace;
- workspace sync;
- ledger performance;
- accounting non-database checks;
- accounting API;
- project engine;
- project AI;
- bundle system v2;
- Dashboard review;
- Dashboard command;
- release-assets validation;
- production build.

The full `npm run validate` proceeds through the application/warehouse/sales/accounting non-database checks and then stops when it reaches the database tests because `@electric-sql/pglite` is not installed in this execution environment.

The following database-backed checks therefore could not execute here:
- accounting database;
- workspace database;
- project database.

The browser smoke test could not execute because Playwright is not installed in this environment. Therefore this audit does **not** claim pixel-level browser verification.

The production build completed successfully. The environment emitted the already-known unrelated spreadsheet-runtime warmup timeout after the application build.

## Conclusion

The supplied screenshot is consistent with a stale presentation asset path, not with the approved Sales Order design being absent from the source. The approved design code is present and correctly layered. The 1.6.2 release closes the deployment/cache gap that allowed the older Sales Order surface to remain visible and strengthens first-install offline asset completeness at the same time.
