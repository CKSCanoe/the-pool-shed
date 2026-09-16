# Pool Shed v1.22.0 Recovery & Readability Audit

## Purpose

This release addresses the two production symptoms visible in the supplied Projects screenshot:

1. legacy Pool Shed business records were not reaching the current canonical workspace, leaving Projects and related modules empty;
2. bright aqua legacy CSS was overriding the approved neutral table treatment and reducing readability.

The v1.20/v1.21 rebuilt application remains the authority. No old presentation layer is restored.

## Root cause 1: old data was not actually being reconstructed

v1.21 could discover browser snapshots and an old offline Supabase snapshot table, but it did not reconstruct records from the older normalized Supabase schema. If the user's historic data existed in tables such as `customers`, `projects`, `sales_orders`, `purchase_orders`, `products` and stock tables rather than in a full snapshot, the migration scan could return no useful source.

### v1.22 correction

A read-only legacy recovery bridge now probes the normalized legacy tables independently. One missing or inaccessible table cannot abort the rest of the scan.

Recovered sources include:

- suppliers when a direct legacy supplier table is available, plus supplier reconstruction from products, POs and supplier bills
- products and supplier SKUs
- customers and customer addresses
- locations
- projects into the current canonical `jobs` collection used by Project 360
- purchase orders and lines
- sales orders and lines
- Goods Notes and lines
- notification history
- stock balances
- location restock rules
- allocations
- stock movements
- supplier bills
- product import history

The bridge remains read-only against legacy tables. All writes go through the current Pool Shed canonical save path.

## Recovery safety

Automatic recovery is deliberately conservative:

- Admin authority is required.
- Automatic apply occurs only when the current canonical business workspace is genuinely empty.
- Seed locations and system configuration do not incorrectly make an empty workspace look populated.
- Existing populated current workspaces are never silently overwritten.
- Existing stock balances remain authoritative and are not added to old balances.
- Current populated values win during reviewed merges.
- Ambiguous identities are reported as conflicts rather than guessed.
- A pre-migration backup is created before apply.
- `legacyMigrationHistory` prevents automatic recovery running twice.

A partially populated workspace can still use Settings > Legacy Data Migration to scan, dry-run and review the controlled merge.

## Recovery Diagnostics

Settings > Legacy Data Migration now exposes a Recovery Diagnostics panel after a scan. It reports:

- legacy tables checked
- readable tables
- unavailable tables
- legacy rows found
- legacy snapshot status
- first unavailable-table errors
- transform warnings when present

This makes live diagnosis explicit if old records are absent because of missing tables, Supabase RLS/permissions, or a transform issue.

## Root cause 2: unreadable bright aqua table treatment

The old compatibility stylesheet contained a global `thead th` rule with `background: var(--color-action-focus) !important`. `--color-action-focus` resolves to the bright aqua `#00A7C4`. It overrode newer Project 360 styling. A global row-hover rule could also force the same fill.

Additional legacy table-header fallbacks were found in Purchase Orders, Sales Orders and Bundle Sales Intelligence.

### v1.22 correction

- Removed the global aqua table-header authority.
- Removed global aqua hover-cell authority.
- Project 360 has scoped neutral header and hover authority.
- Sales Order, Purchase Order and Bundle Sales Intelligence table-header fallbacks now use neutral subtle surfaces and readable secondary text.
- Catalogue and Warehouse maintained table treatments are neutral.
- A regression guard scans all maintained CSS modules and fails if any table-header selector uses the bright focus aqua as its fill.

The aqua token remains available for small focus/accent treatments where contrast is appropriate. It is no longer permitted as a maintained table-header fill.

## Cache freshness correction

The previous service worker could serve stale same-origin CSS/JS from cache first. That could make a corrected deployment still look like the old release.

v1.22 uses a new cache namespace and network-first handling for Pool Shed's own same-origin runtime assets, with cache fallback for offline operation. Navigation remains network-first. Supabase CDN dependencies retain their appropriate cache behaviour.

## Verification evidence

Fresh post-fix verification completed against the v1.22 source tree:

- `npm run build`: PASS
- `npm run test:legacy-recovery`: PASS, including automatic normalized recovery into Projects/Customers/Suppliers/Sales
- Project 360 workspace and visual guard: PASS
- Sales Order detail and sticky table-header checks: PASS
- Purchase Order visual guard: PASS
- Warehouse Precision Desk visual guard: PASS
- Settings Command workspace: PASS
- Production Readiness engine: PASS
- colour contrast checks: PASS
- readability hardening: PASS
- public runtime parse/asset validation: PASS
- dist runtime parse/asset validation: PASS
- release asset validation: PASS, all 52 referenced assets exist and JavaScript parses
- Accounting API non-database checks: PASS
- Project engine and Project AI non-database checks: PASS
- Bundle Product System checks: PASS
- Dashboard review and command checks: PASS

The broad `npm run validate` chain passed every application test reached before the database-only accounting stage. That stage cannot run in this extracted environment because `@electric-sql/pglite` is not installed. An attempted dependency install timed out and did not alter the project. Browser smoke automation likewise cannot start because `playwright` is not installed. These are test-environment dependency boundaries, not reported as passing tests.

## Live deployment expectation

On a genuinely empty canonical workspace, v1.22 will attempt safe automatic recovery after the current Supabase workspace loads. If meaningful legacy data is readable, it is merged into the current canonical data model and persisted once.

If the live workspace is already populated, no silent migration is performed. Use Settings > Legacy Data Migration > Scan Legacy Data to inspect the source and Recovery Diagnostics, then run the dry-run before applying a reviewed merge.

If the diagnostics show zero readable legacy rows, the next investigation is the live Supabase legacy-table availability/RLS state rather than the UI migration code.
