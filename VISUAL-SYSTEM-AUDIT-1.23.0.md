# Pool Shed v1.23.0 — Visual System Overhaul release audit

## Release purpose

v1.23.0 carries forward the approved v1.22 premium staff login and overhauls the internal Pool Shed colour hierarchy so the application reads as one controlled operational system rather than a collection of legacy colourful screens.

The screenshot-driven defect that triggered the release was a Sales Orders / Customer Orders table whose header and hovered row could become a large saturated cyan field. The cause was an old high-specificity legacy rule that used the focus accent as structural table paint.

## Approved visual system

The new shared palette is:

- Navy shell: `#102B3A`
- Primary teal: `#0F6B73`
- Primary hover: `#0B5961`
- Aqua focus/accent: `#36AFC0`
- Canvas: `#F6F8FA`
- Subtle surface: `#F1F4F6`
- Border: `#D9E1E6`
- Primary text: `#17252E`
- Secondary text: `#65747D`

Aqua is now an accent/focus colour, not a large structural fill.

## Key UI corrections

- Generic table headers now use the neutral subtle surface.
- Table hover uses only a 4% primary tint.
- Selected rows use a soft selected surface plus an explicit primary edge marker.
- Legacy global aqua header and row-hover `!important` rules were removed/neutralised.
- Warehouse table headers and row hover now follow the same neutral shared authority.
- Back/navigation buttons are neutral secondary controls rather than competing primary buttons.
- Topbar notification/theme/refresh/account controls use neutral utility styling.
- User avatar initials no longer risk white-on-white presentation.
- Historical hard-coded Pool teal/aqua values in maintained feature CSS were converged toward the semantic shared tokens.
- Semantic green/amber/red remain reserved for state, warning and danger rather than decoration.
- Dark-mode hierarchy remains supported through the existing semantic token layer.

## Login

The v1.22 premium staff login remains the production entry point. The staff runtime contains no Platform Hardening screen or Supabase/Vercel/GitHub technical copy. The version remains a discreet footer and now reports v1.23.0.

## Supabase

No additional Supabase project or schema change is made in v1.23.0. See `SUPABASE-AUTH-STATUS-1.23.0.md` and the original `SUPABASE-AUTH-CHANGE-NOTE-1.22.0.md`.

## Regression evidence

Fresh protected verification on the v1.23 tree passes:

- v1.23 visual-system contract
- v1.22 Login Command behaviour and release retention
- final-system release contract
- Xero Ready-mode controls
- Production Readiness
- Settings permissions/security enforcement
- Smart Assistant and Automation
- Analytics
- Finance
- Supplier Command
- Goods Note shipment lock
- Fulfilment
- Inventory
- Product Hub
- Project 360 commercial engine
- Purchase Order Command
- Warehouse exact-SKU FIFO
- Sales Order compact command
- CSS architecture
- visual consistency
- contrast/text rhythm
- colour contrast
- readability hardening

The final colour-contrast test reports:

- white on primary teal: 5.05:1
- navy on aqua: 5.13:1
- primary text on canvas: 14.43:1
- secondary text on canvas: 5.22:1

## Production build / runtime

- production build: PASS
- runtime validation (`public`): PASS
- runtime validation (`dist`): PASS
- release assets: 50/50 referenced assets present; public/server/API JavaScript parses

## Known environment limitations

The complete `npm run validate` reaches the first database-only test and then cannot import the declared `@electric-sql/pglite` package in this extracted environment. The non-database tests after that boundary were run separately and passed.

`npm run test:browser` was attempted and cannot start because Playwright is not installed in the extracted environment. No automated browser/pixel acceptance is claimed.

## Xero

Xero remains deliberately in `Ready to Connect` mode. v1.23.0 does not authorise a tenant or start live sync.
