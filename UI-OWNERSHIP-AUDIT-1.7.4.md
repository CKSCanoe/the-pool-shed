# Pool Shed UI Ownership Audit — 1.7.4

## Scope

This audit started from `Pool-Shed-1.7.3-Product-Finder-Polish.zip` and compared the production runtime against the approved Dashboard, Customer and Sales Order Design Lab direction. The focus was the reported symptom that rebuilt screens still looked or behaved like older code was winning.

## Confirmed root causes

### 1. Mixed-generation runtime assets were still possible

The 1.7.3 page loaded the application stylesheet, the core legacy runtime and `sales-workspace.js` with a release query string, but most other local JavaScript assets were still loaded from stable unversioned URLs. That included `pool-shed-overhaul.js`, partial fulfilment, the Sales Order customer picker, catalogue intelligence, bundle modules and several workspace modules.

Because the application is a PWA with a service worker and cache-first static assets, a browser transitioning between releases could temporarily combine a new HTML/CSS/Sales workspace with an older cached helper or mutation script. That is the exact failure mode most likely to create an apparently random hybrid of old and approved UI.

### 2. Legacy DOM polish still watched the modern Sales Order

`pool-shed-overhaul.js` installs a document-wide `MutationObserver` and repeatedly runs presentation decorators. Those decorators were authored for the older `.sales-order-compact` / `.so-line-composer` structure and fixed table-cell positions. The approved Sales Order Command is now rendered by `sales-workspace.js` with `.sales-command-page` and Precision Row markup.

Even where old selectors happened to no-op, leaving that observer free to mutate the modern page made presentation ownership ambiguous and vulnerable to future markup collisions. The modern Sales Order now explicitly fences those obsolete decorators out.

### 3. Shared hover behaviour had two owners

The legacy compatibility stylesheet still contained an unscoped live-polish `button:hover, .button:hover, [role="button"]:hover` rule that added lift, saturation and shadow. The later Precision Operations design system also defined shared button hover behaviour. This violated the stated ownership model and allowed old visual effects to leak into newer workspaces unless a feature stylesheet overpowered them with higher specificity or `!important`.

The legacy global hover rule is removed. The design system now explicitly owns transform, filter, shadow, background and border hover state. Semantic feature-specific states remain scoped.

### 4. CSS architecture tests had a real blind spot

The production CSS build contains 15 maintained modules, but `test-css-architecture.mjs` covered only 11. It omitted `34-customer-workspace.css` and the late Sales Order authority modules `41`, `42` and `43`. As a result, a test could report clean ownership while some of the most important final cascade layers were not being checked at all.

The test now covers all 15 maintained modules in actual build order.

## Corrective implementation

- Advanced package version to 1.7.4.
- Versioned all local runtime JavaScript and `app.css` URLs with `?v=1.7.4`.
- Aligned the service-worker CORE list byte-for-byte with those runtime URLs.
- Advanced the cache namespace to `pool-shed-v1.7.4-ui-ownership`.
- Versioned the service-worker registration URL and retained `updateViaCache: "none"`.
- Prevented legacy Sales Order toolbar, bundle-row and composer decorators from touching `.sales-command-page`.
- Removed the old unscoped live-polish hover rule and made the design system explicitly neutralise legacy transform/filter/shadow.
- Expanded CSS architecture coverage to all 15 maintained modules.
- Added `scripts/test-ui-ownership-v174.mjs` and `scripts/test-sales-order-finder-polish-v174.mjs`.
- Made runtime validation release-aware instead of hardcoding the previous cache key.
- Made the Catalogue Health test query-string aware now that all local runtime scripts are versioned.

## Verification performed

Fresh checks completed successfully for:

- v1.7.4 UI ownership regression;
- v1.7.4 Sales Order finder polish;
- runtime validation;
- all 15 CSS architecture modules;
- visual consistency, colour/contrast and readability checks;
- Customer Design Lab parity;
- final Dashboard composition;
- Catalogue Health, Bundle Studio and bundle sales intelligence;
- fulfilment lifecycle;
- Sales Order queue/detail/asset freshness/customer picker;
- Purchase Order picker and catalogue performance;
- receiving ledger;
- professional workspace and sync conflict handling;
- accounting core/API;
- project engine/AI;
- Dashboard review/command;
- release asset existence and JavaScript parse checks.

`npm run build` completed successfully and produced a validated `dist/` deployment.

## Verification limitation

The extracted release does not include its development-only `@electric-sql/pglite` package and network access was unavailable to install it. Therefore three database-only regression scripts could not be executed in this environment: `test-accounting-database.mjs`, `test-workspace-database.mjs` and `test-project-database.mjs`. The full validation command reached the first of those tests after all preceding checks passed. Their production runtime code was not modified by this UI-ownership patch.

A Playwright browser acceptance run was also unavailable because Playwright is not installed in this extracted package. The release should still receive one normal browser acceptance pass after deployment, specifically Dashboard, Customer master-detail, Sales Order detail/finder, hover states and a service-worker upgrade from the prior version.

## Result

The patch removes the identified routes by which old presentation code could win over the approved workspaces. It deliberately does not redesign the three agreed screens again. The next visual changes, if any, should be made only against the approved Design Lab references after this coherent 1.7.4 runtime is loaded in the browser.
