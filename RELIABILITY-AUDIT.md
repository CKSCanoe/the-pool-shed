# Reliability review

This complete release includes all prior Business Review work.

Confirmed and corrected:
- Sales Order Save changes only displayed a toast. It now writes through the normal local/offline persistence path, records updatedAt, and does not claim success if saving fails. Shared sync remains asynchronous and subject to connection/conflict handling.
- Customer reassignment could contradict a linked project or existing goods notes, credits, payments or invoice reference. Reassignment now explains why it is blocked where that history exists. New customer creation no longer falsely claims attachment when the order was retained.
- Dashboard dormancy checks repeatedly scanned notifications for every order. A single last-activity index now serves all orders.
- Offline shell version updated; deployable dist regenerated.

Verification: all 22 validation suites passed. Updated browser checks exercise real Save-button persistence and historical customer protection, and visit 76 sections. Existing receipt, transfer, quarantine, shipment, customer, project, billing and mobile checks pass. External accounting responses are mocked.

Limitations: this is not an exhaustive certification of every control, real-world data migration, live Xero or provider delivery. A full button-by-button audit, company profit-and-loss reporting and dashboard-wide AI remain incomplete. No production deployment or external communication performed. Retain original data backups and review the existing setup guides.

Files changed in this pass: public/assets/js/01-legacy-01.js, public/sales-order-customer-picker.js, public/business-review.js, public/service-worker.js, scripts/test-browser-smoke.cjs, regenerated dist and this report.
