# Dashboard Header Fix — 1.2.2


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
