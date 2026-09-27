> Historical receiving-fix audit. The newer PROFESSIONAL-RELEASE-AUDIT.md supersedes its Tool Register and cloud conflict caveats.

# Pool Shed Version 1 — receiving workflow update

Base: the supplied `the-pool-shed-main` folder (dated 28 August 2026). This is a complete updated copy of that project. It does not contain the later Tool Register described in the referenced conversation; that implementation was not in the supplied files.

## Changed files

- `public/assets/js/01-legacy-01.js`: one PO receipt writer; permanent per-line receipt events with unique IDs, timestamps, supplier delivery references, notes, destination and sales-order link; PO received totals derived from events; legacy opening-balance migration without adding stock. Goods In uses stable line IDs, including repeated SKUs, entered quantities and repeat-submission protection. Purchasing/linked PO receiving routes to Warehouse. Receiving Bay queues derive from receipts less linked transfers, never outstanding PO quantities. Putaway and manual bay transfers use the same stock transfer function and reduce the queue using FIFO receipt links. Fast receipts create no putaway work. Quarantine and Receiving Bay are excluded from free stock; linked allocation happens at a final bin. Existing receipt/transfer stock-count locks are enforced. Explicit backorder splitting retains line cost and supplier reference. Supplier references and multiple notes remain in receipt history. Pending offline data is not replaced on remote load; an older save response cannot clear a newer pending edit.
- `public/assets/js/05-pb-v1100-inventory-product-hub.js`: fix undefined page-state variable and focused-element shadowing; product reconciliation retains receipt links when duplicate products are merged, preserving the original product ID on the event.
- `public/service-worker.js`: new cache version.
- `package.json`: add receiving regression checks to validation and a `test:receiving` command.
- `scripts/test-receiving-ledger.mjs`: executable behavioral regression tests.
- `dist/`: regenerated deployable static application.
- `REGRESSION-RESULTS.txt` and this audit: validation evidence and limitations.

## Operation

1. Purchasing → Book In opens Warehouse Goods In.
2. Enter the supplier delivery reference, receipt note and quantities actually delivered.
3. Choose a final bin for immediate availability, Goods In / Receiving Bay for staged receipt, or Quarantine for damaged goods. Receive the entered quantities once.
4. For staged receipts, use Guided Putaway or Transfers to move stock from the bay. This changes locations, not total stock or PO received quantities.
5. Leave partial POs open for later deliveries. Splitting a backorder is optional. Completing goods-in never receives additional stock.

## Verification

The full supplied validation suite, new receiving behavior tests, production build and performance audit passed. The new tests cover partial/multiple receipts, receipt replay, fast/staged receipt, quarantine, linked allocation, split-bin transfers, stock conservation, repeated completion, opening migration, JSON reload/history, duplicate SKU rows, stock-count locks, local storage failure rollback and explicit backorder splits.

An isolated Chrome check passed with no page errors: application boot, rendered receipt row identity, saving an entered quantity, repeated submission rejection, Putaway controls and transfer balances. It used synthetic local data, not the live Supabase account. Existing tests are a mixture of source checks and behavior tests; this is not a full authenticated end-to-end business workflow test.

## Remaining caveats

- Cloud persistence still uses whole-workspace Supabase snapshots. Concurrent operators/devices can overwrite one another; this release does not claim server-enforced exactly-once processing or conflict-safe offline merging. Production multi-device receiving needs transactional server receipt/transfer tables and idempotency constraints. Receipt replay protection here covers local submissions and saved ledger state.
- Historical receipts only provide their existing total. They become explicitly labelled opening balances; no historical delivery dates, notes or bin movements are invented, and old stock is not received again. Reconcile any pre-existing duplicated stock or uncertain receiving-bay balances physically before relying on them.
- Receiving Bay is reserved for new staged receipts. Transfers into it are rejected to avoid untracked putaway work. Transfers out link receipts FIFO by product. Quarantine release uses an explicit stock transfer after inspection; it is not a second receipt.
- Receipt notes are permanent per-line events rather than a separate printable multi-line goods-received-note document. Multiple events/notes on one PO are supported.
- Supabase credentials and production sign-in were not supplied. Configure the existing deployment environment variables as described in README. The generated `dist/config.js` has no live credentials.
- No live data, GitHub repository or deployment was changed. The supplied Downloads folder was left untouched.
