# Performance review and next priorities

This complete package includes the prior Professional Workspace release plus the changes below. The professional release audit still applies to live integrations and deployment acceptance testing.

## Implemented

- Receipt totals now use a single indexed pass rather than scanning all events for every PO line.
- Putaway balances index transfers once per calculation instead of scanning transfer history for every receipt.
- Global search waits 120 ms after the latest keystroke before performing its search; clearing the field remains immediate.
- Removed the DOM observer and startup timers for the already-disabled Bundle Intelligence panel. Its operational API remains available.
- Updated the service-worker version and added a ledger performance regression test.

## Measured results

Final local run, synthetic dataset of 500 POs, 10,000 PO lines/receipt events and 10,000 transfers; three timed iterations after warm-up:

| Calculation | Previous build | Updated build |
| --- | ---: | ---: |
| Receipt ledger normalization | 729 ms | 4.89 ms |
| Awaiting-putaway total | 712.08 ms | 2.45 ms |

Results vary by machine and run; these are calculation benchmarks, not claims that the entire application is hundreds of times faster. Both versions returned the same tested quantities. Full numbers are in PERFORMANCE-BENCHMARK.json.

A fresh isolated Chrome page on a local file server reached DOMContentLoaded at 114 ms and the load event at 120 ms. This was the unauthenticated local shell on this machine. It excludes live authentication, loading a real Supabase workspace, real internet latency and a user's production data; it is not a production-load guarantee.

Full source validation, behavioral regression checks, production build and asset audit passed. Browser verification opened 72 section views without page errors, plus the connected receipt-to-shipment flow and tool forms. Mobile document width remained 390px at a 390px viewport. The browser script now reports shell startup timing for future comparisons.

## What I recommend next

1. **Load modules on demand.** The shared legacy script remains about 1 MB uncompressed, with many globally coupled feature extensions. Refactor by module with explicit dependencies, then load Purchasing, Warehouse, CRM, Jobs and Accounting when opened. Do not simply split the file into more eagerly loaded scripts: that does not remove startup work. See [web.dev code splitting guidance](https://web.dev/articles/reduce-javascript-payloads-with-code-splitting).
2. **Move from whole-workspace snapshots to transactional records and paged queries.** Orders, receipt events, transfers and assets should eventually be individual database records. This addresses growing download/save size, conflict handling and list performance together. Use indexed filters and stable ordering for paged lists. [Supabase documents ranged queries](https://supabase.com/docs/reference/javascript/using-modifiers-range); the current single-JSON snapshot cannot use row pagination without a data migration. Back up and migrate deliberately, with server-side permissions and transaction tests.
3. **Saved working views.** Let each role save columns, sorting and filters: overdue supplier orders for purchasing, today's receipts for warehouse, and outstanding tools for engineers. Reuse the existing filters and navigation, with fewer repeated setup steps.
4. **An assigned action inbox.** Extend Operations Review with an owner, due date, status and deep link to the exact affected record. Prioritize late deliveries, missing tools and stock exceptions. This should turn existing findings into work people can complete.
5. **Verified accounting and email connections.** Connect actual send/sync results, retries and failure states. The app currently records local invoices and references; it must not claim successful delivery without a real service response.

For visual refinement, prioritize one clear main action per workspace, move occasional actions into a secondary menu, and let users save table layouts. Preserve the new spacing system and avoid layering another independent theme on top.

These are recommendations, not implemented features. The next architectural performance step should precede a broad feature expansion.

## Files changed in this performance pass

- public/assets/js/01-legacy-01.js — indexed receipt/putaway calculations and search debounce.
- public/bundle-sales-intelligence.js — remove no-op observation/timers.
- public/service-worker.js — release cache.
- scripts/test-receiving-ledger.mjs — include the indexed transfer helper in behavioral tests.
- scripts/test-ledger-performance.mjs — reproducible scale benchmark and regression budget.
- scripts/test-browser-smoke.cjs — startup timing capture.
- package.json — include performance regression check and test command.
- dist/ — rebuilt deployable output.

Nothing was published or changed in the live workspace. To measure production loading accurately, test the deployed URL with representative real data and authenticated users.
