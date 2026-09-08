# Project release audit

The full project release includes all files from the connected-accounting build, plus the project features below. The original supplied download and earlier ZIPs remain unchanged.

## Added and linked

- Projects uses existing job IDs and links multiple customer sales orders, item quantities, delivery progress, POs and engineer-request purchasing.
- Accepted quote baseline, approved/proposed extras and a default 30% margin target, with configurable near-loss warnings.
- Forecast cost split into recorded costs, received estimates, outstanding commitments, remaining forecast and tools/hire. Linked PO/bill and order/material matching avoid counting the same estimate and actual cost twice.
- Labour-hour entries, expense categories, supplier/reference duplicate checks and reasoned cost corrections.
- Tasks, owners, dates, stage dependencies and fixed-amount invoice stages. Deposits count within the contract total.
- Server-side stage validation, duplicate queue handling, whole-order/project billing separation, contract cap and immutable accepted quote/cost/approved-extra/queued-stage history.
- Local document storage with private Supabase upload support, cost-reference links, duplicate file detection and downloads.
- Optional AI review endpoint with workspace permission checks, a request throttle, bounded data and no action tools. Rules-based billing guidance remains available without it.
- Project warnings appear in Operations Review; project stage labels can display returned Xero payment balances.

## Changed source files

| File | Purpose |
| --- | --- |
| `public/project-engine.js` | Shared project costing, forecast, alerts and validated commands |
| `public/project-workspace.js` / `.css` | Project screens, forms and responsive layout |
| `public/project-documents.js` | Offline file persistence, private upload and download |
| `public/project-billing.js` | Stage review, Xero queue and payment-label refresh |
| `public/accounting-workspace.js` | Expose authenticated finance reads; block duplicate order-level billing |
| `public/index.html`, `public/service-worker.js` | Load/cache project assets; APIs remain excluded from cache |
| `api/finance.js` | Allow the stable project/stage source-reference length |
| `api/project-review.js` | Optional advisory AI endpoint |
| `database/003-project-documents.sql` | Private document bucket and membership policies |
| `database/004-project-billing.sql` | Atomic project billing validation and contract cap |
| `database/005-project-ai.sql` | Server request throttle |
| `database/006-project-history.sql` | Preserve accepted quotes, costs, extras and queued stages |
| `scripts/test-project-*.mjs` | Project engine, database and optional AI checks |
| `scripts/test-browser-smoke.cjs` | Project creation, costing, documents and invoice-stage journey |
| `package.json`, `vercel.json` | Test commands and advisory function duration |
| `dist/` | Rebuilt browser application |

`PROJECT-CHANGED-FILES.json` records the complete diff from the connected-accounting build. Setup instructions and the cited market/design comparison are included separately.

## Validation

The complete validation chain contains 22 checks and passes, including the existing receiving, putaway, stock, fulfilment, catalogue, tool and performance checks. PostgreSQL migrations were executed in PGlite with simulated Auth/Storage schemas. API tests use simulated Xero/OpenAI responses, not live providers.

The browser workflow visits 74 sections and exercises project creation, accepted quote setup, order linking, expense-driven margin warnings, local invoice upload/download and a reviewed stage draft. Stock remains unchanged by accounting actions. Mobile checks use a 390px viewport with no document-width overflow; wide tables and navigation scroll inside their containers.

## Deployment caveats

No live database migration, Xero authorisation, private storage activation, AI key configuration or scheduler activation has been performed. Shared files and protected billing require the documented setup. Stage billing uses the shared project snapshot and stops if synchronisation fails.

The financial figures are management forecasts in GBP excluding VAT, not a new statutory accounting ledger. Records based on catalogue prices remain estimates. Only explicitly approved extras increase revenue. OCR, retention accounting, complex progress valuations, cost-plus contracts, automated supplier invoice import, background email/SMS alerts, full resource scheduling and a normalised warehouse transaction model are not included. Live demo acceptance, real multi-device testing and recovery drills remain necessary.
