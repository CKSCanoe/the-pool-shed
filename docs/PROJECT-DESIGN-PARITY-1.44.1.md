# Project Design Parity 1.44.1

Implements the approved Option A layout in the existing application. Project detail uses the main left navigation, four summary cards, margin status, lifecycle strip, clearer tables, correspondence timeline and entry dialogs. Settings fields render only on Settings. Dashboard quick actions record conversations, labour and extras without adding a second section menu.

All project sections use the new scoped styling, including orders, extras, costs, invoices, correspondence, scope/tasks, materials, purchasing, stock, tools, files, activity and settings. Existing transactions, permissions, immutable quote revenue, approved-extra allocation and invoice review remain authoritative. Cost and selling values are read from linked sales orders. Purchase costs retain their existing forecast treatment.

Validation: npm run build passed, including the updated project navigation and form transaction checks. Failed labour entry keeps its dialog open; a valid entry persists once and closes the dialog. Existing margin, purchasing, quote, signature and email mock checks passed. No customer email was sent. No database migration is required. No deployment was performed.

Limitations: authenticated browser visual verification has not been completed. This is an implementation based on the Design Lab source, not a claim of verified pixel equivalence. The database integration suite requires the unavailable @electric-sql/pglite dependency. Before production release, visually review a real populated project at desktop, tablet and phone widths and complete a dialog, invoice-review and file-upload walkthrough.
