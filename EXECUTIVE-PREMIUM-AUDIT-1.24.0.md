# Pool Shed v1.24.0 Executive Premium Steel Blue audit

## Release basis
v1.24.0 is built from the preserved v1.23.0 Visual System Overhaul baseline. It does not use the v1.22 recovery branch as its application baseline.

## Approved visual direction
The approved Design Lab direction is Executive Premium with a Graphite / Deep Navy / Steel Blue interaction system.

Canonical interaction colours:
- light action / selected edge: `#2F6B84`
- light action hover: `#24566A`
- light selected surface: `#E7F0F4`
- dark action / selected edge: `#69A8C2`
- dark action hover: `#4E8DA7`
- dark selected surface: `#17313D`

Green, amber, red and information blue are restricted to semantic operational state. Purple and bright aqua are not structural UI colours.

## Project naming
The staff-facing project detail workspace is now named **Project Details**. The former `PROJECT 360` kicker, accessibility label and visible explanatory copy were replaced. Historical internal engine, file and CSS class names remain unchanged to avoid breaking stable project behaviour.

## System-wide visual authority
- Premium v1.23 login retained and recoloured through the v1.24 semantic token authority.
- Light and dark mode share the same component rules and resolve through semantic tokens.
- Maintained feature CSS contains no independent fixed hex/rgb/rgba action palettes.
- Table headers are neutral.
- Row hover uses the shared hover surface.
- Selected rows/cards use a soft selected surface and explicit Steel Blue edge.
- Forms use neutral surfaces with Steel Blue focus rings.
- Tabs/navigation avoid saturated full-block selected paint.
- Primary actions use Steel Blue; destructive/status actions retain semantic state colours.
- Modal, drawer, overlay and shadow colours resolve through theme tokens.
- Legacy Finance compatibility CSS now consumes the semantic authority rather than the old fixed navy/teal palette.
- Browser theme colour, project helper UI and downloadable project report were aligned with the v1.24 palette.

## Sales Order correction discovered during validation
The broad validator exposed a real mapping defect where product finder result state classes could inherit the danger background. This was corrected so catalogue rows remain neutral, hover uses the shared hover surface, and semantic status colour stays inside status text/badges rather than painting normal product rows.

## Verification evidence
Fresh application validation passed from v1.24 through the declared database-only boundary, covering authentication, Xero Ready controls, Production Readiness, Settings/permissions, Azzy/Automation, Analytics, Finance, Suppliers, Goods Notes, Fulfilment, Inventory, Product Hub, project commercial controls, Purchase Orders, Warehouse/FIFO, Sales Orders, runtime/CSS architecture, visual consistency, contrast/readability, bundle/PO/receiving/workspace/accounting core tests.

Fresh visual matrix: 0 failures.

Measured contrast includes:
- white on Steel Blue primary: 5.90:1
- white on Steel Blue hover: 8.03:1
- primary text on light canvas: 14.72:1
- secondary text on light canvas: 4.97:1
- primary text on dark canvas: 16.55:1
- secondary text on dark canvas: 8.83:1
- dark selected text on selected surface: 11.89:1
- semantic state pairs: >= 4.79:1 in tested light/dark combinations

Post-database-boundary non-database tests passed:
- Accounting API
- Project engine
- Project AI
- Bundle System v2
- Dashboard Review
- Dashboard Command
- Release assets

Production build passed. Runtime validation passed for both source `public` and built `dist`. Release asset audit reports 50 referenced assets present and all public/server/API JavaScript parsing successfully.

## Environment-only acceptance boundaries
`npm run validate` stops at `scripts/test-accounting-database.mjs` because the extracted package does not contain the declared `@electric-sql/pglite` development dependency. This also prevents the other database-only workspace/project suites from being claimed as executed here.

`npm run test:browser` cannot start because the extracted environment does not contain the `playwright` module. Automated browser/pixel acceptance is therefore not claimed.

These are environment/dependency boundaries, not converted into false passes.

## Xero and data behaviour
No Xero live activation is introduced. Xero remains Ready to Connect and provider-locked. No business workflow, Supabase authentication contract, permission model, canonical data authority, Warehouse FIFO allocation logic or project commercial engine is intentionally changed by this visual release.
