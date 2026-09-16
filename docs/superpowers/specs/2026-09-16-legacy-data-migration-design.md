# Pool Shed Legacy Data Migration Design

## Goal
Recover useful business records from the pre-v1.20 Pool Shed system into the v1.20+ canonical workspace without restoring old UI/code or overwriting newer records.

## Authority
The current Pool Shed workspace remains authoritative. Legacy sources are read-only inputs. Migration is explicit, admin-controlled, dry-run first, backed up, auditable and reversible from an exported pre-migration snapshot.

## Sources
1. Legacy browser localStorage key `poolbros:system:appData`.
2. Legacy per-user `poolbros:<user>:appData` keys when present.
3. Legacy IndexedDB database `the-pool-shed-offline`, store `state`, key `appData`.
4. Legacy Supabase `offline_sync_snapshots` rows when the current authenticated Supabase session can read them.
5. Manually supplied legacy JSON snapshot.

## Merge order
Suppliers, customers, products, locations, projects/jobs, sales orders, purchase orders, stock, allocations, movements, goods notes, engineer requests, credits, notifications and remaining safe operational history.

## Matching and conflict rules
- Products: ID/SKU first, then unique supplier SKU, barcode or MPN. Current populated fields win. Legacy values fill blanks. Alternative old identifiers become aliases where safe.
- Customers: ID/code first, then unique email, then unique normalised name + postcode. Current populated fields win.
- Suppliers: ID/name match. Supplier records can also be derived from legacy products and purchase orders.
- Locations: ID then unique normalised name. Current quantity/location truth is never overwritten.
- Orders/projects/history: stable ID first. Existing current records are preserved; missing fields and uniquely missing historical lines may be added. Material disagreements are reported as conflicts.
- Stock: never add legacy quantity onto an existing current product/location balance. Only absent product/location balances may be introduced.
- Allocations/movements: deduplicate by ID or deterministic fingerprint. Invalid/orphaned relationships are skipped and reported.

## Safety
- Dry run creates a complete preview with created, matched, enriched, skipped and conflict counts per entity.
- Applying requires an explicit action after preview.
- A complete pre-migration workspace backup is generated before mutation and offered as a JSON download.
- Apply mutates the existing canonical workspace object, calls normal `saveAppData`, and records `legacyMigrationHistory` with source, timestamp, report and backup key.
- Migration never enables Xero or changes authentication/permissions.
- Old presentation/runtime code is never imported.

## User interface
Settings gains `Legacy Data Migration`. It shows source discovery, snapshot summary, dry-run results, conflicts, backup/export and apply controls. The page is admin-only through the existing Settings permission model.

## Release
Version `1.21.0`, service worker cache `pool-shed-v1.21.0-legacy-data-migration`, with dedicated migration engine/workspace tests plus protected v1.20 regression/build checks.
