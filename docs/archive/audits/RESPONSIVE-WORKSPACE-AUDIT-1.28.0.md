# Pool Shed v1.28.0 Responsive Workspace System Audit

## Scope

This release is a full-system responsive layout correction built from the complete v1.27.3 Azzy Panel Fix project. It addresses the page-width, duplicated navigation and tablet/mobile layout problems identified in the v1.27.3 responsive audit while preserving Pool Shed's existing business and data authorities.

The implementation covers Dashboard, My Work, CRM, Sales Orders, Projects, Project Purchasing, Product Hub, Inventory, Purchasing, Warehouse, Fulfilment, Accounting, Analytics, Automation and Settings.

## User-requested workspace banner removal

The persistent **Shared workspace has newer changes** panel has been removed from the operational interface.

The underlying workspace conflict state and sync protection remain intact. Pool Shed still protects local work from unsafe automatic replacement, but the conflict condition no longer inserts a large blocking panel above the active page. This is deliberately a presentation/workflow simplification, not removal of data-safety logic.

## Root layout correction

The principal defect was intrinsic CSS Grid sizing. `.screen.grid` had no explicit `minmax(0,1fr)` column authority, allowing long navigation strips, dense metrics and wide data components to establish an implicit track wider than the available main canvas. That is why Settings could have approximately 1168px of visible space while its content track grew beyond 1400px.

v1.28.0 adds a final maintained responsive authority module:

- `public/assets/css/system/60-responsive-layout.css`

It loads after all feature and authority CSS modules and establishes structural containment without replacing module business logic or visual identity.

## Navigation ownership correction

`professional-workspace.js` previously injected the generic `.ps-section-nav` into every module with sidebar subgroups, including modules that already rendered their own command navigation. This created the duplicate navigation visible in Settings and similar duplication in Automation, Inventory, Product Hub, Fulfilment and Warehouse.

v1.28.0 explicitly treats these modern modules as self-managed navigation owners:

- Settings
- Automation
- Inventory
- Product Hub
- Fulfilment
- Warehouse

The generic navigation remains available to legacy modules that require it. Selected items in compact horizontal navigation are automatically centred into view when necessary.

## Responsive design system

The final layout authority standardises three application breakpoints:

- **1200px:** laptop/dense-desktop reflow. Header actions and dense toolbars wrap deliberately instead of compressing.
- **940px:** tablet shell. The permanent sidebar collapses to the Menu drawer before it starves the workspace canvas.
- **640px:** phone layout. Dense grids become single-column and dialogs/forms use the available viewport width.

Long section navigation behaves differently by context:

- desktop: wraps into clean additional rows where required;
- tablet/phone: stays as a single touch-friendly local horizontal rail;
- page content itself never becomes horizontally wider because of the navigation.

## Corrected problem areas

### Settings
- Removed duplicate section navigation.
- Long Settings navigation wraps cleanly on desktop and scrolls locally on tablet/mobile.
- Six KPI cards now use available-width responsive sizing.
- Two-column settings panels collapse when the available content width requires it.
- Permission Inspector approval limits reflow correctly on tablet.
- Long permission/authority labels wrap rather than clipping.

### Analytics
- Eight metric cards no longer force the page wider than the canvas.
- Command navigation wraps on desktop.
- Toolbar controls and actions reflow at laptop sizes.
- Tablet and phone layouts retain local scrolling only where it communicates navigation/data.

### Automation / Azzy
- Retains the v1.27.2/v1.27.3 Azzy contrast and compact panel fixes.
- Removes duplicate Automation section navigation.
- Flow/metric surfaces now respect the content boundary on narrower workspaces.

### Inventory and Product Hub
- Removed duplicate navigation ownership.
- Dense metric and detail grids now respond to actual content width.
- Tablet layouts no longer inherit the old 210px sidebar at 768px.

### Fulfilment and Warehouse
- Removed duplicate navigation.
- Wide operational surfaces are constrained to the page and scroll internally only where necessary.
- Mobile hard-width overflow found in the v1.27.3 audit is removed.

### Purchasing and Supplier surfaces
- Purchasing layouts are constrained by the global content boundary.
- Supplier/detail tab rails follow the same desktop-wrap / compact-scroll navigation contract.

### Accounting
- Long finance navigation wraps on desktop rather than behaving like an endless hidden strip.
- On compact screens it becomes a contained horizontal rail.

### Dashboard
- The project table now preserves readable headings instead of truncating `PROJECTED PROFIT` and `NEXT KEY DATE`.
- The nine-column table gets a deliberate local minimum width and contained horizontal scroll where a laptop cannot show it legibly.

### CRM
- The customer-creation wizard becomes two columns on tablet and one column on phone rather than forcing five large steps into insufficient width.

### Sales Orders, Projects and Project Purchasing
- Global grid containment removes the mobile hard-width remnants recorded in the v1.27.3 audit.
- Existing module-specific command/fulfilment behaviour is retained.

## Responsive browser acceptance

A fresh Chromium layout matrix was executed against the rebuilt v1.28.0 source.

Coverage:

- **15 top-level modules**
- widths: **1920, 1440, 1280, 1100, 768 and 390px**
- **Compact and Comfortable** density modes
- representative **light and dark** mode checks
- discoverable module subpages at desktop, tablet and phone widths

Total structural checks: **498**

Result:

- hard document overflow: **0**
- hard active-screen overflow: **0**
- unprotected clipped elements: **0**
- duplicate generic navigation on self-managed modules: **0**
- `psSyncConflict` blocking banners: **0**
- browser page/runtime errors: **0**

The test definition is included as `scripts/test-responsive-layout-v128.cjs` and is chained into `npm run test:browser` for installed development environments. In this extracted sandbox, the Node `playwright-core` package is not installed, so the acceptance matrix was executed with the available system Chromium/Python Playwright runtime against the same rebuilt application assets. `playwright-core` remains declared and lockfile-synchronised for normal package installation.

## Regression verification

Passed after the responsive rebuild:

- v1.28 responsive release/static authority gate
- v1.27.3 Azzy panel retention
- v1.27.2 Azzy semantic contrast/WCAG checks
- v1.27 My Work / Action / Approval Authority suite
- v1.26 Identity / Permission / Audit / Record Router Foundation suite
- Settings Command suite
- Analytics Command suite
- Automation/Azzy suite
- Product Hub engine/command/visual guards
- Inventory engine/location/visual guards
- Purchase Order command and visual guards
- Warehouse FIFO / Precision Desk / receiving lifecycle
- Fulfilment / Goods Note lifecycle and guards
- Supplier Command suite
- public runtime validation
- built `dist` runtime validation
- CSS architecture
- visual consistency
- contrast/text rhythm
- colour contrast
- readability hardening
- semantic theme contrast
- contrast cascade and shell-surface contrast
- release asset audit: 60 referenced assets present; public/server/API JavaScript parses
- production build
- accounting API
- project engine and optional project AI
- bundle system v2
- Dashboard review and command tests

The broad `npm run validate` proceeds through the full application stack, Sales, warehouse and accounting core checks and then stops at the existing environment-only database boundary because `@electric-sql/pglite` is not installed in this extracted sandbox. The database-backed accounting/workspace/project tests are therefore not claimed here. Post-boundary non-database checks were run separately and passed.

## Data and authority boundary

No migrated business data was deleted or rebuilt. This release does not change the canonical authority for customers, products, stock, purchase orders, sales orders, projects, accounting, approvals, audit history or permissions. It is a workspace presentation/responsiveness release plus the requested removal of the persistent sync-conflict banner.
