# Pool Shed v1.24.2 — Interaction & Navigation Authority Audit

## Release purpose
v1.24.2 corrects the interaction and navigation contrast defects identified on the Sales Orders screen while retaining the v1.24.1 Executive Premium Steel Blue system and all operational behaviour.

## Root causes fixed
1. The `New Sales Order` CTA was incorrectly marked `class="success"`, which routed a core creation action into the semantic green success palette.
2. `Save customer` used the same incorrect success-action classification.
3. Legacy sidebar submenu rules in `30-workspace-core.css` used `!important` with page-muted and Steel Blue foregrounds, overriding the final shell navigation hierarchy.
4. Shared success callout styling could recolour legacy success-button text after action styling had already set its background.

## Interaction authority
- Primary creation/save actions use Steel Blue action tokens.
- Primary hover uses the darker Steel Blue hover token and preserves the action-contrast foreground.
- Green is reserved for success state, badges, pills and callouts rather than core creation/save CTAs.
- Runtime scanning prevents `button.success` / `button.green-action` from reappearing as action markup.
- Legacy success-button names defensively fall back to primary action presentation if encountered.
- Status/callout selectors explicitly exclude buttons so state colours cannot recolour action text.

## Sidebar authority
- Added dedicated `--color-shell-text-subnav` for readable nested navigation.
- Removed legacy submenu `!important` foreground ownership.
- Inactive submenu items use the dedicated readable shell submenu token.
- Hover uses shell text on a restrained shell hover surface.
- Active submenu items use high-contrast shell text, a soft Steel Blue selection surface and a Steel Blue edge cue.

## Contrast evidence
Protected colour tests report:
- white on Steel Blue primary: 5.90:1
- white on Steel Blue hover: 8.03:1
- light primary text on canvas: 14.72:1
- light secondary text on canvas: 4.97:1
- dark primary text on canvas: 16.55:1
- dark secondary text on canvas: 8.83:1

## Regression evidence
Fresh v1.24.2 checks pass for:
- interaction/navigation authority
- v1.24.2 release/cache wiring
- Executive Premium Steel Blue visual contract
- v1.24.1 contrast-cascade protections
- shell-surface contrast
- light/dark semantic contrast
- semantic surface usage
- Project Details naming
- premium login
- Sales Order command, finder, list and detail
- Purchase Orders
- Projects
- Product Hub
- Inventory
- Fulfilment
- Suppliers
- Finance
- Analytics
- Settings
- Production Readiness
- CSS architecture
- visual consistency
- text rhythm
- colour contrast
- readability hardening
- public runtime validation
- production build
- dist runtime validation
- release assets: 50 referenced assets present and JavaScript parses

## Full validator boundary
`npm run validate` passes the retained application stack through Accounting core and then stops because this extracted environment does not contain the declared development dependency `@electric-sql/pglite`. This is the same database-only environment boundary as previous releases.

The non-database tests after that boundary were run separately and passed: Accounting API, Project engine, Project AI, Bundle System v2, Dashboard Review, Dashboard Command and release assets.

## Browser automation
`npm run test:browser` was attempted. It cannot start because the extracted package does not contain the `playwright` module. No automated browser/pixel acceptance is claimed.

## Result
v1.24.2 makes the interaction hierarchy consistent with the approved Executive Premium Design Lab: Steel Blue for primary action, neutral secondary controls, status colours reserved for meaning, and readable nested navigation in both light and dark mode.
