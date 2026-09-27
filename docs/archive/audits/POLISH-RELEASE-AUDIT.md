# Interface polish — 9 September 2026

Complete base: Sales Workspace release, including prior inventory, receiving, projects and accounting work.

Changes: public/workspace-polish.css adds system typography, soft opaque surfaces, consistent corners, quiet section navigation and a single 900ms active-section glow. No animation library or continuous animation. Reduced-motion disables the effect. Dark and print rules included. Mobile sales tabs scroll horizontally and fulfilment controls stack without clipping.

Removed the unimplemented sales-order Files tab from public/assets/js/01-legacy-01.js. Project document uploads remain available. No business records or operational commands deleted.

public/index.html loads the stylesheet. public/service-worker.js caches it and versions the shell. dist rebuilt.

Validation: all 22 regression suites passed. Browser smoke covers 74 sections plus receipt/transfer/allocation/shipment, quarantine rejection, customer editing, project billing and mobile overflow. External accounting calls are mocked; this is not a live Xero or production test. Existing setup requirements and limitations remain in the project/accounting guides. This quick review does not certify every possible workflow or eliminate all legacy code.
