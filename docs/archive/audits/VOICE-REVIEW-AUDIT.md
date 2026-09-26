# Business workflow review

Implemented: supplier catalogue bounded wheel/touch scroll and sticky headings; customer primary address/phone/email; no allocation or shipment controls on non-stock-only sales orders; Customers & Suppliers navigation with supplier shortcut; Operations Review and Xero moved to Settings; project forecast margin bar with target marker; daily review of overdue/dormant orders, missing details, project warnings and ready billing stages; quarterly order cohort CSV; expanded Training.

Daily guidance is deterministic, read-only and permission-filtered. Existing optional AI project review remains available with configured provider access; no new autonomous AI agent or automated financial action was introduced. Dormancy is inferred from dated order fields and notifications, not a complete activity ledger.

Quarterly export uses current order values grouped by order creation quarter. It is not a historical profit-and-loss statement. Estimated line costs exclude overheads and unmatched project expenses; missing/zero costs are flagged. Supplier payment reminders still require bill/payment data, not PO delivery dates.

22 existing regression suites passed after the principal changes. The updated browser test adds actual mouse-wheel catalogue scrolling and non-stock-only visibility checks, along with Settings accounting navigation and the existing inventory/project workflows. Full live external integration and an exhaustive audit of every button remain outstanding. No deployment performed. Existing setup documents apply.

Changed public sources: assets/js/01-legacy-01.js, sales-workspace.js, professional-workspace.js, accounting-workspace.js, project-workspace.js, business-review.js (new), quarterly-review.js (new), workspace-polish.css, index.html, service-worker.js. Updated scripts/test-browser-smoke.cjs and regenerated dist.
