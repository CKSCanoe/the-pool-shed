# Pool Shed v1.27.3 Azzy Panel Fix Audit

## Reported issue
The production screenshot showed the floating Azzy assistant open on Dashboard with three visible presentation defects:

1. Only the active `Ask` mode was readable. The inactive `Find Anything`, `Guide Me` and `Training` controls were effectively white-on-white.
2. The close control and source chips were also rendered with insufficient visual contrast.
3. A short answer occupied a fixed-height 650px panel, leaving a large blank region and obscuring more of Dashboard than necessary.

## Root cause
Azzy is mounted directly under `body`, outside the `.main` application shell. Legacy floating-assistant button colours therefore remained capable of winning for controls that are not covered by the Executive Premium `.main` cascade. The panel also used a fixed height with a `1fr` conversation row, so short answers expanded into unused vertical space.

## v1.27.3 correction
- Added a scoped `#azzyFloating` presentation authority with deliberate specificity for the floating controls.
- All four mode buttons now receive explicit visible text, selected, hover and border states.
- Header close control now uses primary/secondary semantic text rather than the old contrast token.
- Source chips now use neutral subtle surfaces with primary text and readable hover selection.
- Answer action buttons retain Steel Blue action semantics.
- Quick questions, input, placeholder, footer and answer copy are explicitly governed.
- Floating panel changed from fixed-height grid to content-driven flex layout.
- Conversation area now grows only as required, with a 420px scroll ceiling for longer answers.
- Mobile layout stacks the four modes into two columns and constrains the panel to the viewport.
- Runtime, stylesheet, service-worker and release identity advanced to v1.27.3 to prevent stale v1.27.2 assets from being reused.

## Retained behaviour
No intended business or data-authority change was made. Existing CRM, Sales, Projects, Product Hub, Inventory, Purchasing, Warehouse, Fulfilment, Accounting, Analytics, Automation, Settings, My Work, Action Authority, Approval Authority, identity, permission, audit and record-routing behaviours are retained.

## Verification performed
Passed:
- v1.27.3 Azzy visibility/compact-layout guard
- v1.27.3 release/cache-busting guard
- v1.27.2 Azzy semantic contrast guard
- Automation/Azzy engine, workspace, settings and release suite
- v1.27 Actions/Approvals suite
- v1.26 Foundation Authority suite
- public runtime validation
- built `dist` runtime validation
- semantic theme contrast
- CSS architecture
- contrast cascade
- colour contrast
- release asset audit: 60 referenced assets present and JavaScript parses
- production build

## Result
The floating assistant is now designed to remain readable independently of the rest of the application cascade. Short answers produce a compact panel instead of the large blank state shown in the supplied screenshot, while long answers scroll inside the conversation region.
