# Pool Shed — Professional Workspace release

Built on the completed receiving-fix project. This ZIP contains the complete source, deployable `dist` folder, regression tests, results and screenshots from synthetic test data. Nothing was published, emailed or changed in the live database.

## Interface

A shared design layer now controls typography, spacing, panel borders, tabs, tables, controls and focus states. The sidebar uses a quieter navy treatment with clearer active states. Section navigation is visible at the top of each workspace. Tables scroll within their own regions; mobile navigation has a Menu control. Light and dark themes, compact/comfortable density, reduced-motion support and Ctrl/Command K search focus are included. Sales Order controls no longer float over record content. Repetitive Jobs guidance is hidden.

## Workflow fixes and additions

- Purchasing → Linked Sales Orders previously called a missing page function. The page now renders filters, linked records and the single Book In shortcut.
- Normal warehouse bins are included in the Sales Order availability helper.
- Effective partial-fulfilment allocation and shipping functions now respect the order's permitted stock locations. Shipping excludes Quarantine, Receiving Bay and locations frozen for stock counting; malformed/repeated product rows in a goods note are rejected before deduction.
- Job allocation rejects non-positive/invalid quantities and missing jobs.
- Project costing no longer adds requested materials to stock already held, which could double-count the same material. Requested value, held stock and tool/hire costs are displayed separately. These planning figures are not claimed to be actual materials consumed.
- Tool Register added under Jobs / Projects: asset identity, serial, replacement value, ownership, supplier/reference, daily rate, service date, kit contents, notes, assignment to job/location/responsible person, return date, return checks, missing-kit inspection, off-hire confirmation, cost history and audit history. Duplicate allocations are blocked. Closed jobs cannot accept new tool assignments. Jobs with outstanding tools or unconfirmed external hire cannot be completed/invoiced through the job editor; jobs with tool history cannot be deleted there.
- Operations Review added under Dashboard for administrators. Read-only checks identify broken stock/product/location/customer/order links, invalid balances, PO quantity/status mismatches, overdue tools and closed jobs with outstanding hire. It links to the affected module; it does not silently repair historical data.
- Invoice confirmation accurately records a local invoice and explicitly states that no customer email was sent. Shipment notifications are queued as Ready to send rather than falsely labelled Sent. No email service or live accounting integration was added.
- Shared saves now use a revision-conditional update rather than an unconditional overwrite. A changed remote revision or conflicting first insert preserves local edits, shows a conflict warning and supports a local backup before loading the shared version. A later local edit is not cleared by an older save response. Local-storage failure is visibly reported instead of silently ignored.
- Deployment headers now revalidate unversioned assets. The service worker cache version and offline asset list include the new workspace files.

## Changed files

| File | Change |
| --- | --- |
| `public/professional-workspace.css` | Shared visual system, responsive navigation, density and dark-mode treatment |
| `public/professional-workspace.js` | Section navigation, Tool Register, project links/costs/guards, Operations Review, conflict recovery controls |
| `public/assets/js/01-legacy-01.js` | Linked PO page, stock availability, allocation validation, receipt actor, costing, invoice messaging, conditional cloud save and storage failure state |
| `public/partial-fulfilment.js` | Location-scoped allocation/shipping, held/frozen stock exclusion, shipment validation, notification status |
| `public/pool-shed-overhaul.js` | Accurate accounting connection description |
| `public/index.html` | Load new shared workspace assets |
| `public/service-worker.js` | Offline assets and release cache |
| `vercel.json` | Revalidation for unversioned assets |
| `package.json` | New test commands and validation coverage |
| `scripts/validate-runtime.mjs` | Update partial-shipment test fixture with location-scope and stock-count helpers |
| `scripts/test-professional-workspace.mjs` | Behavioral tool, costing, audit, rollback and diagnostics tests |
| `scripts/test-workspace-sync.mjs` | Mocked conditional-write/conflict/offline tests |
| `scripts/test-browser-smoke.cjs` | Reproducible browser route, connected-stock and tool-form smoke checks |
| `dist/` | Rebuilt deployable application |

The prior receiving-fix changes and receipt regression tests remain included.

## Validation completed

- Full existing validation suite, receiving behavior tests, new tool/diagnostics tests and mocked shared-save tests passed.
- Browser opened 72 section views with no page errors, plus populated Purchasing, Sales Order and Goods In records.
- Browser exercised receipt → Receiving Bay → final bin → linked Sales Order allocation → shipment. Stock balances were checked, a repeated shipment was refused and quarantined stock could not ship.
- Browser forms exercised creating, allocating and returning a tool with a missing kit item, then releasing it after inspection.
- Desktop at 1440px and mobile at 390px were inspected. Mobile document width stayed at 390px. Light and dark screenshots are included as `qa-*.png`; all records shown are synthetic test records.
- Production build and performance audit passed. Detailed output is in `REGRESSION-RESULTS.txt`.

## Deployment and remaining limits

1. Keep a backup of the current workspace and deploy the complete package using the existing Vercel setup. Existing Supabase environment variables are still required. No live credentials were supplied, and the generated configuration contains no live credentials.
2. Update all devices to this release. Revision checks protect cooperating updated clients; older clients still using unconditional writes can bypass that protection. This remains a snapshot-based application, not a server-side transaction ledger. Conflicting edits require manual review/merge. On upgrading a device with pending older edits and no saved revision, it may intentionally ask for conflict review rather than overwrite shared data.
3. The shared-save behavior was tested with mocks, not the live Supabase schema, policies, triggers or multiple authenticated users. Live sign-in, database permissions, conflict recovery, accounting exports and email delivery still require deployment acceptance testing. “All tests passed” does not mean every possible production workflow is flawless.
4. Existing historical stock errors are reported, not automatically corrected. Legacy receipt opening balances remain as documented in the historical receiving audit.
5. Tool costs use elapsed whole days rounded up, minimum one day. Internal cost stops on return; external cost stops at confirmed off-hire. There is no weekly rate, tax calculation, supplier billing reconciliation, photographic condition capture or automatic off-hire message. Asset tracking is separate from stock SKUs.
6. Existing accounting functions remain local records/references and exports. The release does not establish a verified Xero connection or send emails. Historical “Sent” records were not rewritten.
7. UI permission checks remain based on existing roles. Database authorization and live concurrency behavior must be checked in the deployment environment; no security certification is implied.

## Running checks

`npm run validate` covers the automated local checks. `npm run build` regenerates `dist`. The optional `npm run test:browser` needs Playwright and a browser installation; `PLAYWRIGHT_MODULE` and `CHROME_EXECUTABLE` can point to existing installations. Browser tests serve synthetic data locally and do not sign in to production.
