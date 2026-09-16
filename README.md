
## v1.10.0 Project 360 Commercial Control

- Projects now open into an exception-first Precision Desk with an optional Stage Board and a full Project 360 workspace.
- Project 360 reconciles live Warehouse Job Bin stock, allocations, linked Purchase Orders, Engineer Requests, tools, costs, variations and billing without creating parallel ledgers.
- Commercial controls show accepted contract, approved variations, forecast final cost, projected profit/margin, invoice exposure and remaining value to invoice.
- Material plans are project budgets only. They compare planned quantities/costs with live allocations, inbound POs, Job Bin stock, project use and damage/loss movements.
- Project Use and damage/loss actions mutate only free Job Bin stock through the shared stock/movement engine and remain auditable.
- Configurable target, minimum and near-loss margin guardrails create explainable Project Health alerts.
- Configurable invoice cost-exposure thresholds recommend billing review but never create invoices automatically.
- Project close-out is blocked by unresolved stock, POs, Engineer Requests, tools, variations, billing or stale critical-margin review.
# Pool Shed v1.7.4 — UI Ownership & Legacy Isolation

This release fixes a mixed-generation UI problem rather than adding another cosmetic layer. Dashboard, Customers and Sales Orders keep the approved Design Lab direction, while deployment/runtime ownership is tightened so older cached scripts and legacy DOM polish cannot visually win after the newer workspace renders.

Key changes:
- every local runtime JavaScript file and the application CSS bundle now use the same `?v=1.7.4` release token, eliminating mixed old/new presentation assets during deployment;
- the service worker uses the matching `pool-shed-v1.7.4-ui-ownership` cache and precaches the exact URLs loaded by `index.html`;
- service-worker registration itself is release-versioned and continues to use `updateViaCache: "none"`;
- old `pool-shed-overhaul.js` Sales Order toolbar, bundle-row and line-composer decorators explicitly stop when the approved `.sales-command-page` is present;
- shared button hover behaviour is owned by the Precision Operations design system, removing the legacy global saturation/lift/shadow rule that could leak into newer workspaces;
- CSS architecture coverage now includes Customer Workspace and all late Sales Order authority modules, closing the test blind spot that previously let final cascade layers escape ownership checks;
- a new v1.7.4 regression asserts coherent runtime assets, cache alignment, modern Sales Order fencing and shared hover ownership.

No stock, allocation, pricing, VAT, CRM, Goods Note, fulfilment, accounting, project or offline sync business engine was replaced by this patch.

# Pool Shed v1.7.3 — Product Finder & Precision Line Polish

This patch implements the approved high-fidelity Smart Product Finder treatment directly in the Sales Order and brings the added order-line row to the same visual standard. Product selection uses calm aqua/blue-grey interaction states; semantic green is restricted to stock/readiness signals.

Key changes:
- polished three-column Smart Product Finder with customer context, recommendations, team popularity and customer history;
- live typo-tolerant search, exact SKU/barcode priority, "Why shown" reasoning and product imagery/fallbacks;
- selected-product confirmation bar before commit;
- customer and team recommendations derive from existing Sales Order history rather than parallel data;
- added Sales Order lines now include a polished product thumbnail, dedicated editable Variant column, warehouse/free-stock context, net/VAT totals and the existing floating action menu;
- removed dark-green product hover/selection treatment in favour of the locked teal/aqua interaction language;
- v1.7.3 asset/service-worker cache namespace prevents stale finder presentation from surviving deployment.


This patch forces the browser/service worker to load the same Sales Order finder runtime that owns the approved Smart Product Finder. The core legacy runtime asset now carries the release query version alongside `app.css` and `sales-workspace.js`, preventing an older cached product-finder implementation from running inside the new Sales Order shell.

The Sales Order Smart Product Finder remains the approved design: live results while typing, typo/common-term suggestions, Best Matches with Why Shown, customer Frequently Ordered and Customer History recommendations, stock/location/price enrichment, full catalogue access and exact-variant selection.

# Pool Shed Uniform System — 1.7.2


## 1.7.2 — Sales Order Design Lab Parity

- Makes the approved Sales Order Command layout the direct Items & Pricing render path instead of extracting it back through the legacy record shell.
- Pulls the product finder, order lines, totals/payment and secondary line tools into one coherent presentation layer.
- Keeps the Smart Product Finder live-as-you-type, customer history/frequently ordered recommendations, exact-SKU variant handling, stock and pricing engines intact.
- Adds a final maintained Sales Order parity CSS module so older Sales/Product Intelligence rules cannot visually win the cascade.

## 1.7.0 — Smart Sales Order Product Finder

- Replaces the basic Sales Order catalogue result list with a fast recommendation-first mega menu.
- Live results update while typing with a short debounce, cached catalogue search index, typo/common-term support and ranked matches.
- Adds customer-specific Frequently Ordered and Recently Ordered recommendations derived from existing Sales Order history; no duplicate customer-product store is introduced.
- Adds “Why shown” context, visible stock/location/price, new-user keyword suggestions, keyboard navigation and an Open Full Catalogue escape hatch.
- Keeps exact SKU/variant selection, pricing, stock and Sales Order engines authoritative.


## 1.6.3 — Sales Order Design Parity

- Replaced the legacy Sales Order outer record shell with the approved Order Command structure so the production page now matches the Design Lab hierarchy instead of relying on CSS rearrangement.
- Added the dedicated final-authority `sales-order-command.css` layer after `app.css` to stop older Sales Order/Product Intelligence styles from visually winning.
- Preserves the smarter customer intelligence card, compact order details, Stock & Fulfilment summary, clearer tab rail, Precision Row item lines, separate editable Variant column, Connected Product Catalogue, live VAT totals, Save Order, and Take / Record Payment.
- Existing stock, allocation, fulfilment, Goods Note, CRM, pricing, tax, payment and offline engines remain authoritative.
- Product Intelligence keeps search/ranking/data ownership but no longer owns the Sales Order visual surface.
- Service-worker/cache asset versions advanced for this release.

## 1.6.2 — Sales Order Asset Freshness & Release Audit

- Versioned every local runtime CSS/JavaScript URL used by the application shell so a deployment cannot silently reuse a previous Sales Order presentation layer.
- Aligned the service-worker precache with the actual application shell, including the legacy runtime modules that were previously omitted from first-install offline precache.
- Service-worker registration now bypasses the browser HTTP cache when checking for a worker update.
- Preserves the approved Sales Order Detail Command, Precision Row variant selector, CRM intelligence, Product Catalogue, payment/totals, stock/allocation, Goods Note and fulfilment engines unchanged.
- Release package hygiene was tightened by excluding repository metadata and macOS packaging artefacts.

## 1.6.1 — Sales Order Detail Command

- Rebuilt the Sales Order detail presentation around the approved Order Command design while preserving the existing stock, allocation, VAT, Goods Note, payment, CRM and fulfilment engines.
- Added a smarter customer intelligence summary, clearer operational tabs, neutral connected product catalogue presentation, live totals with Take / Record Payment, and first-class Save Order action.
- Reworked order lines into the selected Precision Row with a dedicated exact-variant/SKU column, safe variant switching before stock activity, and a viewport-safe actions menu.
- Product Intelligence now supplies catalogue/search/stock intelligence without owning the Sales Order surface styling.


Sales Orders now use the approved Option A **Order Queue** list before the order detail workspace: operational KPIs, Needs Action / Ready / Backorders queue tabs, smart order/customer/product/Goods Note search, stock/due/status filters, VAT-inclusive order value and selection-only bulk actions. The list continues to use the existing stock, allocation, fulfilment, Goods Note and invoice engines. Light-mode CRM and Sales Order form fields are explicitly protected from legacy dark-form palette rules; Dashboard command surfaces remain unchanged.



Vercel deployment now skips npm dependency installation because the production build has no runtime npm dependencies; `@electric-sql/pglite` remains a local test-only development dependency.
Production now loads one deterministic CSS bundle (`assets/css/app.css`) generated from the maintained source modules in their established cascade order, removing the 26-link runtime stylesheet chain without changing business logic.
Active application styling is now maintained in four ordered source modules: legacy compatibility, feature-scoped rules, workspace-scoped rules, and one authoritative Precision Operations design system. The production bundle is regenerated from those modules; print-only popup styles remain separate.
Twelve repeated unscoped global primitives (`html`, `body`, headings, controls and core table cells) were consolidated into the authoritative design-system module, preventing feature/workspace CSS from owning competing top-level definitions.
Shared buttons, form controls, fields, panels, record surfaces, KPIs, action rows, tabs, breadcrumbs, top bars, status pills, tables and modal shells now have one unscoped Precision Operations definition in the authoritative design-system module; legacy/feature/workspace modules retain only scoped variants.
Feature styling is now ownership-based: Sales/Product, Catalogue, Bundles, platform feature overrides, Product Hub, workspace core, Projects, Sales workspace and workspace polish are maintained separately while production still ships one generated app.css. Routine feature cards/panels/summaries use the Precision Operations panel geometry; feature dialogs/popovers use the shared dialog geometry.
Final visual consistency pass: routine feature panels, search/results surfaces, tables, status controls and tabs now use the locked Precision Operations radii, flat border-led surfaces and shared dialog elevation. Feature modules retain layout/behaviour ownership; no business engines or data contracts were changed.
Dashboard now implements the selected Design Lab Option A: dark operational command layer, compact exception-led Sales Order Flow, Needs Action rail, restrained semantic status markers, and responsive value/location summaries.
Second-pass readability audit: corrected remaining light-on-light hero/command surfaces, removed same-colour semantic fills, raised all ordinary legacy micro-copy below 10px to the locked micro floor, and relaxed overly tight text line-height.
Accessibility/visual correction pass: text selection and row highlights now use explicit high-contrast foreground/background pairs; semantic status chips use derived readable status colours; decorative rainbow/gradient stripes and top-edge graphics were removed; shared headings/body copy use calmer line-height and no overlapping decorative rules.
Selected Concept B is now the production visual foundation: 16px operational rhythm, 38px desktop controls, compact 39px data rows, sharp 5/6/8px geometry, flat border-led surfaces, underline tabs, Aqua focus treatment, touch-safe mobile density, and the approved PB logo. The Professional Palette remains unchanged.

The UI now uses the locked Pool Shed Professional colour foundation through one canonical semantic token layer. Legacy CSS colour literals resolve through the approved palette, arbitrary Sales Order status colour entry is constrained to approved semantic colours, and the token stylesheet is included in the offline core cache.

# Project management release

Start with [PROJECT-SETUP-AND-USER-GUIDE.md](PROJECT-SETUP-AND-USER-GUIDE.md), [PROJECT-RELEASE-AUDIT.md](PROJECT-RELEASE-AUDIT.md) and [PROJECT-MANAGEMENT-RESEARCH.md](PROJECT-MANAGEMENT-RESEARCH.md). This release includes the earlier accounting build. Default project target margin: 30%.

# Connected accounting build

See [ACCOUNTING-SETUP.md](ACCOUNTING-SETUP.md) and [CONNECTED-RELEASE-AUDIT.md](CONNECTED-RELEASE-AUDIT.md) before enabling the new server features. Xero is not connected by this ZIP alone. Existing offline warehouse functionality is retained.

# Performance update

See `PERFORMANCE-REVIEW.md` for this release’s speed improvements, measurements and recommended next steps.

# Professional Workspace update

See `PROFESSIONAL-RELEASE-AUDIT.md` for the current release, deployment notes and limits. The ZIP includes the complete source and rebuilt `dist` folder.

# The Pool Shed - Version 1.1.0

Production-clean application package for Vercel + Supabase.

## Deployment

1. Upload the contents of this folder to the root of the GitHub repository.
2. Keep Vercel Root Directory blank.
3. Build command: `npm run build`
4. Output directory: `dist`
5. Keep the existing Supabase environment variables configured in Vercel.

## Data safety

This release does not run destructive SQL and does not recreate existing products, customers, stock, sales orders, purchase orders, suppliers or locations.

Bundle component sales-order lines are operational stock lines only. Their sales value and sales-order margin cost are zero; the priced/costed bundle head remains the commercial line. The underlying component product records retain their own true supplier cost for purchasing and stock reporting.

## Main production cleanup

- Large Sales Order bundle-intelligence panel removed from the page while the stock/transfer/PO engine remains available behind the linked component lines.
- Bundle components remain linked to real catalogue product IDs and stock SKUs.
- Bundle component cost is excluded from Sales Order margin totals to prevent double-counting.
- Sales Order controls are compact and kept at the top of the order.
- Product and Sales Order tabs are more visibly interactive.
- Non-stock/custom/delivery lines are collapsed behind a compact + control.
- Fulfilment uses the Print -> Pick -> Pack -> Ship sequence.
- Sales Order product smart search retains live/offline catalogue behaviour.
- Purchase Order catalogue search uses a cached token index for large catalogues.
- Old user-facing version labels are removed.
- A clean branded boot screen prevents legacy screens flashing during application startup.
- Light/dark and responsive layout refinements are applied by the production UI layer.

## Validation

Run:

```bash
npm run validate
npm run build
npm run audit
```

## Sales Order Smart Customer Picker

Sales Orders now use a live CRM customer picker rather than the browser datalist / Apply workflow. Staff can search by name, company, email, phone or customer code, choose a suggested CRM customer with mouse or keyboard, or create a new customer in an on-page drawer. New customers are saved to the existing CRM data store and attached to the Sales Order immediately, including pricing and master delivery-address population. Duplicate email/phone detection offers the existing CRM record instead of creating a second profile. The picker and its assets are included in the offline service-worker cache.