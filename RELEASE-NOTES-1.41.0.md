# Pool Shed v1.41.0: Quote workspace layout

## Changes
- Compact light header separates navigation, quote identity, totals and next action. Long titles can wrap normally.
- Clear, readable stage navigation with explicit foreground/background colours across Mineral, Forest and Graphite.
- Replaced overlapping structural rules, including the old fixed minimum canvas width and oversized padding.
- Three editor columns on wide screens; laptop library opens above the canvas. Inspector moves below the canvas at narrower widths. Library starts collapsed on laptops.
- Responsive forms use their card width, with larger labels, inputs, text and spacing. Operations settings on the details page are expandable.
- Setup steps are working navigation buttons. Back, Pool Shed exit, preview, publishing, undo/redo and focus controls remain connected.
- Hero headings have explicit white text; commercial, settings, layout, list, template and modal surfaces have consistent spacing.
- Separate customer acceptance page and typed/drawn signatures from v1.40.0 retained.

## Verification
- Quote regression suite, signature flow/API tests and production build.
- Real workspace handlers exercised across every quote stage, laptop panel defaults, long titles, workflow disclosure, publish and back navigation.
- Layout rules and 4.5:1 minimum contrast checks for principal text/palette pairs.
- Full ZIP extraction with SHA-256 comparison of every project file.
- No live customer data was changed. Browser visual and touchscreen testing have not been completed in this environment; static layout checks are not a substitute for browser rendering.

## Deployment
Deploy this complete project to the existing Pool Shed application. The build refreshes the generated app.css and v1.41.0 asset references.
No new Supabase migration or environment changes are required relative to v1.40.0. Existing server/API/database behaviour is preserved.
This package has not been deployed to the live application.
