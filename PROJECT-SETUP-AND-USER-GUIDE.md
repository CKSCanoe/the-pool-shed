# Pool Shed projects

This build includes the connected-accounting work and a project workspace under **Jobs / Projects → Projects**. It extends the existing job record, so orders, tools and purchasing keep the same job reference.

## Start a project

1. Create a project or open an existing job.
2. In Settings, enter the quote total **excluding VAT**, its acceptance reference and the additional cost still needed to finish. The default target is **30% margin**; the default near-loss warning is 5%.
3. Record the quote as accepted when appropriate. Its amount becomes locked. Later selling-price changes use approved extras.
4. Link the customer’s sales orders in Orders & items. An order can belong to only one project. Existing invoice references require reconciliation before linking.
5. Record labour and other expenses in Costs. Match actual supplier bills to their PO, or stock-material costs to the uncovered sales-order estimate. Enter the amount of the estimate replaced by that cost. This amount may differ from the actual bill if the supplier charged more or less.
6. Review the remaining-cost figure at least weekly. Include future labour, overheads and hire not already represented in orders, POs, expenses or tool costs. Saving Settings activates project phase billing for the job.

## Read the financial picture

The main figures are agreed contract value, forecast final cost, expected profit and headroom before missing the target. Sales-order selling values are not added to the quote. PO commitments, received-goods estimates, actual bills and uncommitted work are shown separately.

A 30% margin on a £10,000 contract means a £7,000 forecast cost allowance. At £7,500 forecast cost, the job is still profitable but has missed its target. A stronger warning appears near break-even; a negative forecast profit produces a loss warning.

These are management estimates, not statutory profit-and-loss accounts. Product costs are taken from the order/PO when recorded, otherwise from current catalogue cost. Zero/missing costs generate a warning. Tools use their stored assignment rate and accrue to date; forecast remaining hire must be included in the remaining-cost field. Inventory movements themselves do not add another expense.

## Extras, tasks and invoicing

Proposed extras do not increase agreed revenue. Record the approval reference to include them. An extra’s additional cost estimate should exclude amounts already in linked orders/POs. Actual costs can be associated with the extra to replace its remaining estimate.

Create invoice stages with fixed net amounts, an agreed condition, an optional due date and optional preceding stage. Add tasks and responsible people. Tasks must be complete before their stage can be confirmed. The app warns about unassigned contract value; a project cannot be marked fully invoiced unless the contract is fully assigned and its stage invoices are approved in the visible accounting data.

A deposit is part of the stage total, not an extra charge. Review invoice opens customer/account/tax choices from Xero. Queuing a stage requires the project to be successfully synchronised. The database checks stage readiness, the agreed value, duplicate submissions, existing whole-order invoices and the total contract limit. Xero drafts still require approval/send in Xero.

Paid and due balances return through the accounting integration. Project billing labels refresh while the app is open and signed in. Amounts paid/due include VAT; project margin figures exclude VAT. The accounting screen currently returns the latest 250 documents, so older records outside that view require further retrieval/reconciliation. Unavailable status does not mean unpaid or unbilled.

## Documents

PDF, PNG and JPEG files up to 10 MB are supported. Select a related cost record if relevant. Files save locally first; when the private storage connection is available they can be shared. The screen distinguishes shared files from files only on this device.

Uploading an invoice does **not** automatically create a cost. There is no OCR or automatic invoice-field extraction in this build. Enter and match the reviewed cost separately. Files are stored outside the workspace snapshot to avoid slowing every save. Local-only file bytes are not included in a JSON backup; download or sync them before moving devices.

## Enable server features

Follow `ACCOUNTING-SETUP.md` for the Xero credentials and connection. For this project release:

- Apply database migrations `001` through `006` in order in a staging environment first. If the accounting migration is already installed, apply the remaining migrations. The migrations add project storage, protected phase billing, an optional AI throttle and project-history guards.
- Enrol authorised users in both `ps_workspace_members` and, for accounting access, `ps_finance_members`. These permissions are controlled in the database, not by the browser’s Admin label.
- Set `SECURE_WORKSPACE_WRITES=true` and deploy the updated whole project. Migration 002 removes legacy direct snapshot-write access, so coordinate the update and preserve offline work first.
- Verify that existing generic Supabase Storage policies do not grant wider access to the new private `project-documents` bucket. Test uploads/downloads with an authorised user and a user from another workspace.
- Configure the Xero webhook and scheduled worker. No production connection or schedule is enabled by the ZIP alone.
- For optional AI, set server-only `OPENAI_API_KEY` and `PROJECT_AI_MODEL` to an available Responses API model. The AI feature is initiated by clicking Request AI review. It sends totals, alerts and stage descriptions, not invoice files or structured customer/supplier records. It is advisory and cannot send invoices or alter the project. One request per user/workspace/minute is allowed; provider usage charges and policies apply.

The built-in margin, overdue-task and stage-readiness checks work without AI. Alerts are in-app; background email/SMS reminders and autonomous billing are not configured.

## Verification and remaining limits

The included tests cover project arithmetic, duplicate/matched costs, approvals, stage caps, private-storage policy isolation, immutable history, simulated Xero/AI requests and browser workflows. They do not substitute for live Xero demo acceptance, a restored-backup drill or concurrent testing with real devices.

This release supports fixed-price GBP projects and fixed-amount stages. Formal retention accounting, complex percentage progress valuations, cost-plus contracts, automatic supplier bill import, full resource/Gantt scheduling and transaction-level warehouse persistence remain future work. Material costs and matching still need manager review. No claim of a flawless or market-leading production system is made.
