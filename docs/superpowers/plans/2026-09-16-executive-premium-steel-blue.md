# Pool Shed Executive Premium Steel Blue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the preserved Pool Shed v1.23.0 Visual System Overhaul into v1.24.0 Executive Premium Steel Blue, matching the approved Design Lab across light mode, dark mode, login, shared controls and every maintained operational module without changing business behaviour.

**Architecture:** Keep v1.23.0 as the functional baseline. `system/40-design-system.css` remains the only palette/token authority; `system/56-executive-premium-components.css` is a late-loaded component normalisation layer that consumes only those semantic tokens and prevents feature CSS from visually diverging, while `system/55-login-command.css` keeps ownership of login layout but consumes semantic/login tokens instead of its old hard-coded aqua/navy palette. Feature modules retain geometry and workflow-specific layout, and high-impact legacy action/selection colours are migrated to semantic variables where they can otherwise defeat the final component authority.

**Tech Stack:** Static HTML/JavaScript runtime, CSS custom properties, Node.js ESM verification scripts, existing `scripts/build-css.mjs` / `scripts/build.sh`, service-worker versioning.

**Spec:** `docs/superpowers/specs/2026-09-16-executive-premium-steel-blue-design.md`

## Global Constraints

- Baseline is Pool Shed v1.23.0 Visual System Overhaul only.
- Target release is v1.24.0 Executive Premium Steel Blue.
- Preserve the current premium v1.22/v1.23 login structure and all Supabase authentication, password recovery, MFA and inactive-user behaviour.
- Preserve canonical data shapes, persistence, stock/FIFO, purchasing, fulfilment, finance, permissions, Azzy, Automation, Xero readiness and Supabase contracts.
- Xero remains `Ready to Connect`.
- `public/assets/css/system/40-design-system.css` is the only source of brand/action/status palette values.
- `public/assets/css/app.css` remains generated build output and is never edited directly.
- No purple in maintained production UI.
- Bright aqua/cyan and historical teal are forbidden as structural backgrounds, table headers, row hover blocks or selected-row fills.
- Light and dark modes are explicit semantic themes, not inverted copies.
- WCAG AA target is 4.5:1 for normal text and 3:1 for applicable large text/non-text controls.
- Browser/pixel acceptance may only be claimed if browser automation actually runs.

---

### Task 1: v1.24 Visual Contract and Release Guard

**Files:**
- Create: `scripts/test-visual-system-v124.mjs`
- Modify: `package.json`
- Modify: `public/index.html`
- Modify: `public/service-worker.js`
- Modify: `public/assets/js/01-legacy-01.js`

**Interfaces:**
- Consumes: current v1.23 runtime/version wiring and the approved v1.24 design spec.
- Produces: a failing-then-green `test-visual-system-v124.mjs` contract that later tasks must satisfy and v1.24 cache/runtime version identifiers.

- [ ] **Step 1: Write the failing v1.24 visual contract test**

Create `scripts/test-visual-system-v124.mjs` with checks that require package version `1.24.0`, exact light/dark Executive Premium palette tokens in `40-design-system.css`, inclusion of `system/56-executive-premium-components.css` in the CSS build, semantic login colour usage, no approved Design Lab purple hex values, no legacy structural teal/aqua values outside explicitly allowed compatibility declarations in `40-design-system.css`, current v1.24 runtime/cache references, and retention of `.ps-login-stage`.

The test must include exact required token assertions for:

```js
const required = [
  '--color-shell: #101820;',
  '--color-shell-secondary: #17232D;',
  '--color-surface-canvas: #F5F7F8;',
  '--color-surface-default: #FFFFFF;',
  '--color-surface-subtle: #EEF2F4;',
  '--color-surface-raised: #E5EAED;',
  '--color-text-primary: #18242C;',
  '--color-text-secondary: #5F6D75;',
  '--color-text-muted: #89959C;',
  '--color-border-default: #D8E0E4;',
  '--color-border-strong: #C2CCD1;',
  '--color-action-primary: #2F6B84;',
  '--color-action-primary-hover: #24566A;',
  '--color-action-soft: #E7F0F4;',
  '--color-action-ink: #173847;'
];
```

It must explicitly reject these Design Lab/legacy structural colours in maintained CSS outside `40-design-system.css` compatibility comments/token aliases:

```js
const forbidden = ['#8F6BFF','#6F4FE8','#A88CFF','#36AFC0','#0F6B73','#0B5961'];
```

- [ ] **Step 2: Run the v1.24 test against untouched v1.23 and verify RED**

Run:

```bash
node scripts/test-visual-system-v124.mjs
```

Expected: FAIL because package/runtime remains v1.23.0 and Executive Premium Steel Blue tokens/component authority do not yet exist.

- [ ] **Step 3: Advance release wiring only**

Change package version to `1.24.0`; replace v1.23.0 cache-busting references in `public/index.html`, service-worker cache/version strings in `public/service-worker.js`, and the discreet footer/version string in `public/assets/js/01-legacy-01.js` with `1.24.0`. Do not alter application behaviour.

- [ ] **Step 4: Re-run the v1.24 test and confirm it still fails for visual requirements**

Run:

```bash
node scripts/test-visual-system-v124.mjs
```

Expected: FAIL on missing Steel Blue tokens/component authority, proving release wiring alone cannot satisfy the visual contract.

---

### Task 2: Semantic Executive Premium Token Authority

**Files:**
- Modify: `public/assets/css/system/40-design-system.css`
- Modify: `scripts/test-colour-contrast.mjs`
- Test: `scripts/test-visual-system-v124.mjs`
- Test: `scripts/test-colour-contrast.mjs`

**Interfaces:**
- Consumes: v1.24 visual contract from Task 1.
- Produces: light/dark semantic tokens used by login and all shared/module components: `--color-shell`, `--color-shell-secondary`, `--color-surface-*`, `--color-text-*`, `--color-border-*`, `--color-action-*`, `--color-status-*`, `--color-hover-surface`, `--color-overlay-*`, shadow and focus tokens, plus compatibility aliases resolving to those tokens.

- [ ] **Step 1: Add contrast expectations before token changes**

Update `scripts/test-colour-contrast.mjs` to verify at minimum these pairs:

```js
['white on steel-blue primary', '#FFFFFF', '#2F6B84', 4.5],
['white on steel-blue hover', '#FFFFFF', '#24566A', 4.5],
['primary text on light canvas', '#18242C', '#F5F7F8', 4.5],
['secondary text on light canvas', '#5F6D75', '#F5F7F8', 4.5],
['dark primary text on dark canvas', '#EEF3F5', '#0F1419', 4.5],
['dark secondary text on dark canvas', '#A9B5BB', '#0F1419', 4.5],
['dark steel-blue ink on dark soft selection', '#DFF3FB', '#17313D', 4.5]
```

Retain semantic success/warning/danger/info contrast checks using the approved v1.24 values.

- [ ] **Step 2: Run contrast and visual contract tests and verify RED**

Run:

```bash
node scripts/test-colour-contrast.mjs
node scripts/test-visual-system-v124.mjs
```

Expected: the v1.24 visual contract remains red until tokens change; contrast script proves chosen literal pairs meet targets.

- [ ] **Step 3: Replace the palette/semantic section in `40-design-system.css`**

Implement the exact spec values. The semantic layer must expose light values in `:root`, explicit dark values under the existing `[data-theme="dark"]` selectors, and these interaction variables:

```css
--color-hover-surface: color-mix(in srgb, var(--color-action-primary) 5%, var(--color-surface-default));
--color-selected-surface: var(--color-action-soft);
--color-selected-edge: var(--color-action-primary);
--color-focus-ring: color-mix(in srgb, var(--color-action-primary) 26%, transparent);
```

Dark mode must set `--color-action-primary:#69A8C2`, `--color-action-primary-hover:#4E8DA7`, `--color-action-soft:#17313D`, `--color-action-ink:#DFF3FB` and the approved dark canvas/surface/text/border values.

Compatibility aliases (`--brand`, `--accent`, `--ps-cyan`, `--pb-teal`, `--ci-cyan`, `--bs-blue`, `--b2-blue`, etc.) must resolve to semantic variables, not retain historical hues.

- [ ] **Step 4: Run token and contrast tests**

Run:

```bash
node scripts/test-colour-contrast.mjs
node scripts/test-visual-system-v124.mjs
```

Expected: contrast PASS; visual contract progresses but remains RED until component authority/login conversion exists.

---

### Task 3: Preserve and Recolour the Premium Login

**Files:**
- Modify: `public/assets/css/system/55-login-command.css`
- Test: `scripts/test-login-command-v122.mjs`
- Test: `scripts/test-login-release-v122.mjs`
- Test: `scripts/test-visual-system-v124.mjs`

**Interfaces:**
- Consumes: semantic v1.24 tokens from Task 2.
- Produces: unchanged login DOM/behaviour with Executive Premium graphite/steel-blue styling and semantic error/success states.

- [ ] **Step 1: Strengthen the v1.24 test around login colour authority**

Require `55-login-command.css` to contain semantic references including:

```css
background:var(--color-shell)
background:var(--color-surface-default)
border-color:var(--color-action-primary)
box-shadow:var(--focus-ring)
```

and reject `#071a27`, `#071b28`, `#0b3043`, `#78bec9`, `#83c7d1`, `#68aebc`, `#387b8b`.

- [ ] **Step 2: Run the v1.24 visual test and verify RED on login**

Run:

```bash
node scripts/test-visual-system-v124.mjs
```

Expected: FAIL on hard-coded legacy login palette.

- [ ] **Step 3: Convert login colour declarations to semantic tokens**

Keep all selectors, layout, responsive breakpoints and auth-specific class names. Replace brand-side backgrounds with `--color-shell` / `--color-shell-secondary`; auth/card/field surfaces with `--color-surface-default` / `--color-surface-subtle`; text with `--color-text-*`; primary button/focus/links with `--color-action-*`; error/success blocks with `--color-status-*`; and shadows/scrims with shared shadow/overlay tokens.

No authentication JS, DOM flow or copy is changed.

- [ ] **Step 4: Run login and visual tests**

Run:

```bash
node scripts/test-login-command-v122.mjs
node scripts/test-login-release-v122.mjs
node scripts/test-visual-system-v124.mjs
```

Expected: login behaviour/release-retention PASS; v1.24 visual test only remains red for component/module cleanup if any.

---

### Task 4: Shared Executive Premium Component Authority

**Files:**
- Create: `public/assets/css/system/56-executive-premium-components.css`
- Modify: `scripts/build-css.mjs`
- Test: `scripts/test-visual-system-v124.mjs`
- Test: `scripts/test-css-architecture.mjs`
- Test: `scripts/test-visual-consistency.mjs`
- Test: `scripts/test-readability-hardening.mjs`

**Interfaces:**
- Consumes: semantic tokens from Task 2 and existing component class names across Pool Shed.
- Produces: a late-loaded visual normalisation layer using no independent brand hex values; it controls shared surface, typography, table, form, button, navigation, tab, modal, dropdown, badge, hover, selected, focus and disabled states while leaving feature geometry/workflows intact.

- [ ] **Step 1: Extend the v1.24 test to require final component authority**

Require `scripts/build-css.mjs` to include `system/56-executive-premium-components.css` after `system/55-login-command.css`, and require the new file to use semantic variables while containing no hex colour literals other than `transparent`-independent CSS syntax.

- [ ] **Step 2: Run test and verify RED because module 56 is absent**

Run:

```bash
node scripts/test-visual-system-v124.mjs
```

Expected: FAIL for missing component authority.

- [ ] **Step 3: Create `56-executive-premium-components.css`**

Implement final shared visual rules for:

```css
body,.main
.sidebar
.topbar,.top-bar,.workspace-topbar
button,.btn,[class*="-btn"]
input,select,textarea
.table-wrap,table,thead th,tbody td,tbody tr:hover
[aria-selected="true"],.selected,.active-row,.is-selected
.tabs,.tab,.tab-chip
.card,.panel,.workspace-card,[class*="-card"]
.modal,[class*="-modal"],.drawer,[class*="-drawer"]
.dropdown,[class*="-popover"],[class*="-menu"]
.pill,.badge,[class*="-pill"],[class*="-badge"]
```

Use scoped `:where(...)` selectors and semantic tokens. Tables must use `--color-surface-subtle` headers, `--color-hover-surface` row hover, and `--color-selected-surface` plus a steel-blue edge marker for selected rows. Primary controls must use steel blue with white text; neutral controls stay neutral. Generic `.success/.warning/.danger/.info` states use semantic status tokens. Focus-visible uses the shared focus ring.

Dark-mode behaviour is inherited exclusively from Task 2 tokens, except component-specific distinction rules for scrims/elevation where needed.

- [ ] **Step 4: Add module 56 to the CSS build after login**

Append `"system/56-executive-premium-components.css"` to the `sources` array in `scripts/build-css.mjs`, then rebuild generated CSS:

```bash
node scripts/build-css.mjs
```

- [ ] **Step 5: Run shared architecture/readability tests**

Run:

```bash
node scripts/test-visual-system-v124.mjs
node scripts/test-css-architecture.mjs
node scripts/test-visual-consistency.mjs
node scripts/test-readability-hardening.mjs
```

Expected: module inclusion and shared component authority PASS; any remaining forbidden module colours are now isolated for Task 5.

---

### Task 5: Module Colour Conflict Cleanup

**Files:**
- Modify as required: `public/assets/css/system/24-product-hub.css`
- Modify as required: `public/assets/css/system/32-sales-workspace.css`
- Modify as required: `public/assets/css/system/34-customer-workspace.css`
- Modify as required: `public/assets/css/system/35-warehouse-workspace.css`
- Modify as required: `public/assets/css/system/41-sales-order-command.css`
- Modify as required: `public/assets/css/system/42-sales-order-parity.css`
- Modify as required: `public/assets/css/system/43-sales-order-finder-polish.css`
- Modify as required: `public/assets/css/system/44-purchase-order-command.css`
- Modify as required: `public/assets/css/system/45-project-360-command.css`
- Modify as required: `public/assets/css/system/46-product-hub-command.css`
- Modify as required: `public/assets/css/system/47-inventory-location-control.css`
- Modify as required: `public/assets/css/system/48-fulfilment-command.css`
- Modify as required: `public/assets/css/system/49-supplier-command.css`
- Modify as required: `public/assets/css/system/50-finance-command.css`
- Modify as required: `public/assets/css/system/51-analytics-command.css`
- Modify as required: `public/assets/css/system/52-automation-command.css`
- Modify as required: `public/assets/css/system/53-settings-command.css`
- Modify as required: `public/assets/css/system/54-production-readiness.css`
- Test: existing module visual guards listed below

**Interfaces:**
- Consumes: shared semantic token/component authority from Tasks 2 and 4.
- Produces: module CSS that no longer defeats shared hover/selected/focus/table/button/surface rules with legacy structural teal/aqua/purple or hard-coded action colours.
- Coverage explicitly includes Dashboard shared surfaces and Purchasing / Purchase Order / Supplier Command presentation, in addition to the listed module files.

- [ ] **Step 1: Run the forbidden-colour scan from the v1.24 test and capture remaining conflicts**

Run:

```bash
node scripts/test-visual-system-v124.mjs
```

Expected: if RED, failures name exact files/colours/selectors that still violate the v1.24 colour contract.

- [ ] **Step 2: Replace structural/action conflicts with semantic variables**

For each named conflict, replace only the presentation declaration, not layout. Apply these rules:

```css
legacy navy used as body text -> var(--color-text-primary)
legacy slate/muted text -> var(--color-text-secondary) or var(--color-text-muted)
white/default panel -> var(--color-surface-default)
light panel/header fill -> var(--color-surface-subtle)
canvas fill -> var(--color-surface-canvas)
legacy border -> var(--color-border-default) / var(--color-border-strong)
legacy teal/aqua/blue action -> var(--color-action-primary) / hover / soft / selected edge
success/warning/danger/info -> corresponding --color-status-* variables
```

Preserve workflow-specific semantic distinctions such as approval/warning/danger nodes; remove purple branch decoration by using information or neutral status semantics instead.

- [ ] **Step 3: Rebuild CSS and run all protected module visual guards**

Run:

```bash
node scripts/build-css.mjs
node scripts/test-project-360-visual-guard-v110.mjs
node scripts/test-sales-order-command-compact-v180.mjs
node scripts/test-product-hub-visual-guard-v111.mjs
node scripts/test-inventory-visual-guard-v112.mjs
node scripts/test-purchase-order-visual-guard-v190.mjs
node scripts/test-warehouse-visual-guard-v180.mjs
node scripts/test-fulfilment-command-visual-v113.mjs
node scripts/test-supplier-command-visual-v115.mjs
node scripts/test-finance-command-visual-v116.mjs
node scripts/test-analytics-command-visual-v117.mjs
node scripts/test-automation-release-v118.mjs
node scripts/test-settings-command-release-v119.mjs
node scripts/test-production-readiness-release-v120.mjs
node scripts/test-visual-system-v124.mjs
```

Expected: PASS. If an old visual guard is hard-coded to a superseded v1.23 colour, update the guard to assert retained functionality/semantic authority rather than the historical hue; do not weaken functional checks.

- [ ] **Step 4: Run shared visual/readability/contrast tests**

Run:

```bash
node scripts/test-css-architecture.mjs
node scripts/test-visual-consistency.mjs
node scripts/test-contrast-text-rhythm.mjs
node scripts/test-colour-contrast.mjs
node scripts/test-readability-hardening.mjs
```

Expected: PASS.

---

### Task 6: Full Regression, Build, Audit and Release Package

**Files:**
- Create: `EXECUTIVE-PREMIUM-STEEL-BLUE-AUDIT-1.24.0.md`
- Create: `FINAL-EXECUTIVE-PREMIUM-1.24.0.txt`
- Create: `Pool-Shed-1.24.0-Executive-Premium-Steel-Blue.zip`
- Create: `Pool-Shed-1.24.0-Executive-Premium-Steel-Blue.sha256.txt`
- Generated: `public/assets/css/app.css`
- Generated: `dist/**`

**Interfaces:**
- Consumes: completed v1.24 source tree.
- Produces: verified deployable release archive and explicit evidence/limitations.

- [ ] **Step 1: Run protected non-database regression suites**

Run existing package suites for login, final system, Xero Ready, Production Readiness, Settings, Automation/Azzy, Analytics, Finance, Suppliers, Inventory/Warehouse/Fulfilment, Product Hub, Projects and Sales Orders. For database-backed package scripts, run non-database components separately if `@electric-sql/pglite` is unavailable and record that boundary rather than claiming a pass.

- [ ] **Step 2: Run production build and runtime validation**

Run:

```bash
npm run build
node scripts/validate-runtime.mjs public
node scripts/validate-runtime.mjs dist
node scripts/test-release-assets.mjs
```

Expected: all commands exit 0.

- [ ] **Step 3: Attempt browser automation**

Run:

```bash
npm run test:browser
```

If Playwright is unavailable, record that exact limitation. Do not claim pixel/browser acceptance.

- [ ] **Step 4: Write the release audit**

Document: v1.23 baseline protection; exact v1.24 palette; light/dark state model; premium login retention; modules covered; forbidden-colour scan result; test/build/runtime evidence; and any database/browser environment limitation.

- [ ] **Step 5: Create archive and checksum**

From the parent directory:

```bash
zip -qr Pool-Shed-1.24.0-Executive-Premium-Steel-Blue.zip Pool-Shed-1.24.0-Executive-Premium-Steel-Blue
sha256sum Pool-Shed-1.24.0-Executive-Premium-Steel-Blue.zip > Pool-Shed-1.24.0-Executive-Premium-Steel-Blue.sha256.txt
```

- [ ] **Step 6: Freshly unzip the exact release archive and verify it**

Extract into a new verification directory and run at minimum:

```bash
node scripts/test-visual-system-v124.mjs
node scripts/test-login-command-v122.mjs
node scripts/test-colour-contrast.mjs
node scripts/test-css-architecture.mjs
node scripts/test-readability-hardening.mjs
npm run build
node scripts/validate-runtime.mjs dist
node scripts/test-release-assets.mjs
```

Expected: all supported checks PASS on the packaged tree itself.

