# Sales workspace update

Base: the completed Projects and Accounting release. All previous project, receipt, inventory and accounting files are included.

## Changes
- `public/sales-workspace.js` and `.css`: focused order layout, less repeated customer information, direct customer-profile edit, linked PO and credit-note tab, collapsible selected-item actions, optional accounting/pick/pack columns, mobile scroll containment, removes duplicate sales navigation. Existing order and stock commands remain authoritative.
- `public/sales-order-customer-picker.js`: invalidate the search index after edits to any customer, including name, contact or address changes.
- `public/assets/js/01-legacy-01.js`: clear tab names, invoice-review wording, VAT total label no longer assumes every line is 20%.
- `public/index.html`, `public/service-worker.js`: load and cache the new workspace, invalidate previous offline shell.
- `scripts/test-browser-smoke.cjs`: linked PO visibility, customer-edit routing, search after customer edit, populated sales screenshots and mobile overflow regression.
- `dist/`: regenerated deployable app. Full changed-file manifest is SALES-CHANGED-FILES.json.

## Validation
All 22 existing validation suites passed, covering receipts, partial fulfilment, transfers, no double counting, workspace conflicts, project calculations and accounting/database APIs. Browser checks visit 74 sections and exercise receipt to allocation to shipment, quarantine rejection, project billing and customer editing. Tests use local fixtures and mocked external services.

## Scope and caveats
This release improves the existing sales workspace; it is not a replacement for every sales or accounting subsystem. It retains existing customer creation and master-profile editing. Editing opens CRM; return through Sales Orders. Credit creation and receipt commands retain their existing validation. Sales-order Files remains the existing placeholder; uploaded project documents are available in Projects. No live Xero or production deployment was performed. Shared storage, Xero and optional AI still require the setup documented in PROJECT-SETUP-AND-USER-GUIDE.md. This is not a claim of Brightpearl feature parity or a guarantee of flawless operation. Test your real order types in a staging workspace before production rollout.

Design reference: https://www.brightpearl.com/order-management-software (linked purchasing, allocation and returns).
