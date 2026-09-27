# Pool Shed Visual System Overhaul Design

## Goal

Make the v1.22 full Pool Shed system feel like one premium, controlled operational platform. Remove bright aqua/cyan as a structural fill, strengthen hierarchy, standardise tables/buttons/tabs/surfaces, and preserve the approved premium login.

## Visual authority

The shared authority remains `public/assets/css/system/40-design-system.css`. Feature modules keep scoped layout rules but must consume shared semantic tokens. Do not add a second runtime stylesheet or a late global override file.

## Palette

Light mode:
- shell/navy: `#102B3A`
- primary teal: `#0F6B73`
- primary hover: `#0B5961`
- accent/focus aqua: `#36AFC0`, reserved for focus and small emphasis
- canvas: `#F6F8FA`
- subtle surface: `#F1F4F6`
- border: `#D9E1E6`
- primary text: `#17252E`
- secondary text: `#65747D`

Semantic status colours remain distinct and are used only for status/attention, not structural decoration.

## Component rules

### Tables
- Headers use neutral subtle surface, never aqua/teal fill.
- Body rows use white/default surface.
- Hover uses a 3–5% primary tint only.
- Selected rows use a soft teal field plus an explicit left/inner indicator, never a saturated full-row fill.
- Status remains a badge/pill, not a row background except very soft warning/error tints.

### Buttons
- One primary action colour per view.
- Secondary/ghost controls remain neutral.
- Back/navigation controls are secondary, not primary.
- Icon utility buttons are neutral bordered controls.

### Tabs
- Neutral text and surface.
- Active state uses underline + primary foreground.
- No filled teal tab blocks for normal navigation.

### Panels and KPI cards
- White/surface cards with light borders.
- Colour is limited to status marks, small top/side indicators, badges and deliberate hero areas.
- No gradients or large decorative colour bars.

### Top bar
- Search stays prominent but calm.
- Notification/theme/refresh/account controls use the same neutral utility treatment.
- Dashboard dark command header remains intentional, but non-dashboard screens keep a light professional header.

### Login
- Keep the approved v1.22 premium staff login.
- Public/staff login contains no platform-hardening technical content.
- Version stays in the discreet page footer.

## Dark mode

Dark mode preserves hierarchy using dark surfaces and borders. Teal/aqua accents remain restrained and selected/hover states use translucent tints rather than saturated fills.

## Supabase

This release does not change Supabase database schema, project configuration, provider, or authentication provider. It preserves the v1.22 auth safety improvements: Supabase session validation is authoritative, inactive profiles are denied, and enrolled TOTP/AAL2 requirements are respected. Visual/auth presentation changes only unless a test exposes a functional defect.

## Acceptance rules

- No generic `thead th` or `tbody tr:hover td` rule may use `--color-action-focus` as a structural fill.
- Shared table headers resolve to `--color-surface-subtle`.
- Shared row hover resolves to a very low primary tint.
- `--color-action-focus` is visually distinct but not the primary structural colour.
- Existing module regression tests must stay green.
- Single runtime stylesheet architecture must remain intact.
- CSS readability and contrast tests must pass.
- v1.22 login command behaviour must remain intact.
