# Pool Shed Executive Premium Steel Blue Design Specification

## Status
Approved visual direction: **Executive Premium, Steel Blue**.

Production baseline: **Pool Shed v1.23.0 Visual System Overhaul**.

Target release: **v1.24.0 Executive Premium Steel Blue**.

The approved interactive reference is `Pool-Shed-Executive-Premium-Steel-Blue-Design-Lab.html`. The production implementation must match its visual hierarchy and interaction language while preserving the existing v1.23 information architecture and business workflows.

## Non-negotiable baseline protections

- v1.23 is the only implementation baseline. Do not merge the v1.22 recovery branch over it.
- Preserve the current premium v1.22/v1.23 login structure, authentication behaviour, password recovery, MFA handling and Supabase session authority.
- Preserve every current business workflow and canonical data authority across Dashboard, CRM, Projects, Sales Orders, Project Purchasing, Product Hub, Inventory, Purchasing, Warehouse, Fulfilment, Finance, Analytics, Automation/Azzy, Settings and Production Readiness.
- Xero remains `Ready to Connect`. No live OAuth, tenant connection or sync is enabled by this visual release.
- Do not modify Supabase schema, RLS, authentication project, workspace snapshot contract or live business data.
- Do not restore Platform Hardening or public technical Supabase/Vercel/GitHub copy to the login screen.
- Version information remains discreet and secondary.

## Design objective

Pool Shed should read as a premium operational command system: calm, precise, dense where necessary, highly readable, and visually consistent across every maintained surface. Colour should establish hierarchy and interaction, not decorate large structural areas.

The system must work equally well in light and dark mode. Dark mode is a first-class design, not a colour inversion.

## Executive Premium palette

### Light mode

- App canvas: `#F5F7F8`
- Default surface: `#FFFFFF`
- Subtle surface: `#EEF2F4`
- Raised/secondary surface: `#E5EAED`
- Shell: `#101820`
- Shell secondary: `#17232D`
- Primary text: `#18242C`
- Secondary text: `#5F6D75`
- Muted text: `#89959C`
- Default border: `#D8E0E4`
- Strong border: `#C2CCD1`
- Primary steel-blue action: `#2F6B84`
- Primary action hover/pressed direction: `#24566A`
- Steel-blue soft/selection surface: `#E7F0F4`
- Steel-blue dark ink: `#173847`

### Dark mode

- App canvas: `#0F1419`
- Default surface: `#161D23`
- Subtle surface: `#1D252C`
- Raised surface: `#263039`
- Shell: `#0B1015`
- Shell secondary: `#121920`
- Primary text: `#EEF3F5`
- Secondary text: `#A9B5BB`
- Muted text: `#7F8C93`
- Default border: `#2C3841`
- Strong border: `#3A4852`
- Primary steel-blue action: `#69A8C2`
- Primary action hover/pressed direction: `#4E8DA7`
- Steel-blue soft/selection surface: `#17313D`
- Steel-blue light ink: `#DFF3FB`

### Semantic status colours

Status colours are not brand decoration. They are used only where state meaning is required.

- Success light: `#1F8A5B`
- Warning light: `#B56A14`
- Danger light: `#B13B46`
- Information light: `#2F6F9F`
- Success dark: `#55C68A`
- Warning dark: `#E2A451`
- Danger dark: `#E07079`
- Information dark: `#6FA9D3`

## Forbidden structural colours

- No purple anywhere in the maintained production UI.
- Bright aqua/cyan and legacy teal must not be used as table fills, card fills, navigation backgrounds, hover blocks or selected-row fills.
- Historical colour aliases may remain only as compatibility aliases that resolve to the new semantic tokens.
- Feature CSS must not introduce its own brand/action palette.

## Colour architecture

`public/assets/css/system/40-design-system.css` becomes the single colour authority.

The file will expose semantic tokens for:

- canvas
- default surface
- subtle surface
- raised surface
- shell
- primary, secondary and muted text
- inverse text
- disabled text
- default and strong borders
- primary action
- primary hover/pressed
- focus
- selected surface and selected edge
- hover surface
- scrim and shadows
- success, attention, danger and information states

All legacy compatibility aliases such as `--brand`, `--accent`, `--ps-cyan`, `--pb-teal`, `--ci-cyan`, `--bs-blue`, `--b2-blue` and similar names must resolve into the new semantic system. Their names may remain for compatibility, but they do not retain their historical colours.

Maintained feature CSS should consume semantic variables rather than hard-coded hex/RGB action colours. Existing status colours are converted to semantic status variables. Any unavoidable hard-coded colour must be documented in the visual audit as an explicit exception.

## Interaction model

### Hover

Hover must never flood a component with a saturated colour.

- Table row hover: a very low-opacity steel-blue tint over the current surface.
- Neutral button hover: subtle surface darkening/lightening plus border strengthening.
- Navigation hover: quiet shell lift with stronger text.
- Primary button hover: darker steel blue in light mode, controlled lighter/darker steel blue in dark mode.
- Icon controls: neutral hover unless the action is semantic danger/success.

### Selected state

Selected states use two cues:

1. soft steel-blue selected background;
2. explicit steel-blue edge marker, underline or border according to component type.

Selected state text must remain primary text and meet contrast requirements.

### Focus

Keyboard focus is always visible using a steel-blue focus ring. Focus must not depend on hover and must not be removed by module CSS.

### Pressed/active

Pressed controls use a stronger primary-action tone and preserve readable text. Active navigation is visually distinct from hover.

### Disabled

Disabled elements reduce contrast without becoming unreadable. Disabled is not represented by opacity alone on critical controls.

## Shared components

### Sidebar and shell

- Graphite/ink shell.
- White or soft light text hierarchy.
- Active navigation uses restrained steel-blue selection treatment, not a cyan block.
- Section labels remain clearly subordinate.
- Sidebar behaviour and navigation routing remain unchanged.

### Topbar

- Default surface with subtle border in light mode.
- Dark surface with subtle border in dark mode.
- Search uses neutral surface and steel-blue focus.
- Notifications, refresh, theme and account controls are neutral utility controls.

### Tables

- Headers use subtle neutral surfaces.
- Header text uses secondary text with high legibility.
- Row hover is a low-opacity steel-blue tint.
- Selected rows use soft steel-blue plus an explicit selection marker.
- Status pills provide state colour, not table backgrounds.
- Dense tables remain compact and readable.
- No maintained table header may use legacy aqua, teal or purple structural fills.

### Forms

- White/neutral fields in light mode, dark neutral fields in dark mode.
- Clear border at rest, stronger border on hover, steel-blue focus ring on focus.
- Placeholder and helper text remain readable.
- Error states use semantic danger, not primary accent.

### Buttons

- Primary: steel blue with readable white text.
- Secondary: neutral surface and border.
- Ghost/tertiary: transparent/neutral until hover.
- Danger: semantic danger only.
- Utility icon buttons stay neutral.

### Tabs

- Neutral text by default.
- Active state uses steel-blue underline/edge plus primary text.
- Avoid large accent-filled tab backgrounds unless the component specifically requires segmented-control behaviour.

### Cards and panels

- Neutral surfaces with restrained borders and shadows.
- Accent is not used as a full card background except an explicitly semantic callout.
- Elevation should be subtle and consistent.

### Badges and status pills

- Neutral pills for categories and metadata.
- Success, warning, danger and info colours only for actual state meaning.

### Modals, drawers and dropdowns

- Raised semantic surface.
- Clear scrim.
- Primary/secondary action hierarchy follows the global button system.
- Dark-mode surfaces and borders remain distinct from the canvas.

## Login

The current v1.23 premium login is preserved structurally. Its colour values are migrated into the Executive Premium Steel Blue tokens.

- Left/brand side uses deep graphite/ink rather than legacy teal/navy-aqua styling.
- Steel blue is used only as accent/focus/controlled emphasis.
- Authentication panel remains highly readable and visually separate.
- Password toggle, recovery, MFA, inactive-user and error states remain functionally unchanged.
- Mobile login retains the established responsive behaviour.
- No technical platform or Platform Hardening copy is added.

## Light and dark mode rules

- Every semantic token has an explicit light and dark value.
- Do not create dark mode by applying blanket inversion/filter rules.
- Text, borders, selected states, table hover, focus, forms, modal scrims and status states must all have explicit dark-mode behaviour.
- System theme switching behaviour remains unchanged.
- Both modes must pass automated contrast checks for normal text and interactive controls.

## Module scope

The visual conversion applies to the complete maintained system, including:

- Login
- Dashboard
- CRM / Customers
- Projects / Project Details
- Sales Orders
- Project Purchasing
- Product Hub / Catalogue / Bundles
- Inventory
- Purchasing / Purchase Orders / Supplier Command
- Warehouse / Goods-In / Picking / Fulfilment
- Accounting / Finance Command
- Analytics
- Automation / Azzy
- Settings / Permissions / Production Readiness
- Shared modals, dropdowns, forms, tables, buttons, toasts, badges and navigation

No module gets an independent brand colourway.

## CSS ownership cleanup

The current v1.23 tree contains thousands of historical `!important` declarations and more than 1,500 hard-coded hex references in maintained system CSS. This release will not attempt a risky wholesale rewrite of every historical selector, but it will remove or neutralise colour-specific overrides that compete with the semantic authority.

Rules:

- `40-design-system.css` owns palette and interaction tokens.
- Feature modules own layout and module-specific geometry, not brand colour.
- `55-login-command.css` may own login layout, but its colour values must resolve through semantic/login tokens.
- Generated `app.css` remains build output, never the edit source.
- New visual guards detect forbidden purple and structural aqua/teal usage in maintained CSS.
- New tests detect hard-coded primary-action colours outside approved authority files.
- Existing module visual guards remain in the regression matrix.

## Accessibility and readability

- Normal text target: WCAG AA 4.5:1 minimum.
- Large text and non-text controls: at least 3:1 where applicable.
- Keyboard focus must be visible.
- Colour is never the only carrier of critical status information.
- Microcopy below the current approved minimum is not introduced.
- Hover must not reduce text contrast.
- Dark mode must maintain the same information hierarchy as light mode.

## Functional safety

This is a visual-system release. It must not change:

- canonical data shapes
- persistence paths
- allocation/FIFO behaviour
- purchasing logic
- fulfilment lifecycle
- finance/accounting rules
- permissions
- Azzy data authority
- Automation authority
- Xero readiness gating
- Supabase authentication/data contracts

Changes outside CSS/theme presentation are allowed only when required to expose semantic classes or theme attributes without changing business behaviour.

## Verification requirements

Before packaging v1.24.0:

1. Add failing visual-system tests for the Executive Premium palette and forbidden colours before production CSS changes.
2. Verify the tests fail against untouched v1.23.
3. Implement the semantic token conversion.
4. Re-run dedicated visual tests until green.
5. Run protected module visual guards across Projects, Sales Orders, Product Hub, Inventory, Purchase Orders, Warehouse, Fulfilment, Supplier Command, Finance, Analytics, Automation and Settings.
6. Run login command/release tests.
7. Run CSS architecture, visual consistency, text rhythm, colour contrast and readability hardening tests.
8. Run production build.
9. Validate both `public` and `dist` runtime assets.
10. Run the broad non-database regression suite.
11. Attempt browser automation if the dependency is available. Do not claim browser/pixel acceptance if it is unavailable.
12. Document database-only test boundaries if PGlite remains unavailable.
13. Freshly unzip the final release archive and verify the packaged tree, not only the working tree.

## Acceptance criteria

The release is acceptable when:

- the production UI visually matches the approved Steel Blue Executive Premium Design Lab;
- the premium login is preserved and recoloured, not replaced;
- purple is absent from maintained runtime UI;
- no large aqua/teal structural fills remain in maintained operational surfaces;
- light and dark modes both remain readable and intentional;
- hover, focus, selected and disabled states are consistent across modules;
- tables, forms, cards, navigation and controls share one semantic visual language;
- existing business workflows and tests remain intact;
- the deployable build and packaged runtime pass verification.
