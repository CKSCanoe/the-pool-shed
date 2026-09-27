# Finance Command Design

## Decision
Option C, Finance Command, is the approved accounting direction for Pool Shed.

## Goal
Create a user-friendly operational finance command centre that ensures customer money, supplier money, credits, allocations, chasing, three-way matching and Xero synchronisation are visible and actionable without duplicating Xero's general ledger.

## System authority
- Pool Shed owns operational context: Sales Orders, Goods Notes, Projects, Purchase Orders, Goods-In, customer/supplier account workflow, credit policy, chase workflow, allocation decisions and exception handling.
- Xero remains the accounting ledger and authoritative posted accounting document/payment source.
- Pool Shed links to Xero using stable external IDs, never display-name matching as the primary key.
- Financial state never changes physical stock or fulfilment state by itself.
- Conflicts never silently overwrite either side. They create a reconciliation exception.

## Finance Command navigation
Overview; Customer Accounts; Customer Invoices; Payments & Allocations; Credit Control; Supplier Accounts; Supplier Bills; Payment Runs; Credits & Returns; Three-Way Match; Invoice Ready; Xero Sync; Reconciliation; Month End; Reports.

## Overview
The Overview is exception-first and shows clickable metrics for customers owing money, overdue customer debt, due-this-week receivables, supplier bills due, supplier bills overdue, unallocated credits, invoice-ready orders and Xero exceptions. The priority queue must explain what happened, why it matters and the next action.

## Customer accounts and allocation
Each customer account shows outstanding, overdue, available credit, unapplied payments/credits, credit limit, open Sales Order exposure and projected exposure. The ledger shows invoices, payments, credits and remaining balance. Payments and credits can be allocated manually or via a suggested oldest-first allocation, but no suggestion posts without confirmation. Customer Sales Orders show Not Invoiced, Invoice Ready, Awaiting Payment, Part Paid, Paid, Overdue or Credit Balance derived from linked finance records.

## Credit control
Customer credit exposure = open A/R + uninvoiced/open Sales Order exposure. Default warning bands are watch at 70%, warning at 85%, hold at 100%, with per-customer overrides. Credit holds require a reason and audit entry. Chase workflow stores last chase, next chase, method, outcome and promise-to-pay date.

## Supplier accounts and bills
Supplier accounts surface current balance, bills due/overdue, available supplier credits and linked purchasing context. Supplier bill readiness is controlled by three-way match: Purchase Order vs Goods-In vs Supplier Bill. Missing goods, quantity mismatch or price variance must be visible before payment. Payment runs support bill selection, supplier credits and explicit review before posting/sync.

## Credits and returns
Customer credits and supplier credits remain first-class balances until allocated/refunded. Physical return status remains separate from financial credit status. Creating a credit never increases stock. Supplier credits expected from a return remain open until the credit is received/matched.

## Invoice Ready
Sales Orders/Goods Notes that are operationally complete but not yet invoiced appear in Invoice Ready. Invoice creation queues one Xero draft and stores the linked Xero InvoiceID. Existing project milestone billing rules remain protected.

## Xero integration
Existing OAuth, tenant binding, encrypted token storage, job queue, idempotent draft creation and remote status refresh remain in use. Finance Command consumes the returned remote amounts/status. The status API returns enough remote fields for allocations/reconciliation. Xero Sync owns connection/data movement. Reconciliation separately compares linked Pool Shed and Xero states. Webhooks prioritise supported linked invoice/credit changes; scheduled/manual refresh handles payment changes and other eventual updates. Live provider acceptance remains a deployment task and is not simulated as verified.

## Reconciliation
Reconciliation groups mismatches by linked Xero ID. It distinguishes value mismatch, status mismatch, payment received but unallocated operationally, credit not allocated, and sync job failure. A zero-value difference can still require an operational allocation. No conflict is resolved by silent overwrite.

## Month end
Month End is a checklist of unresolved finance exceptions: overdue A/R, unpaid A/P, unmatched bills, unallocated cash/credits, invoice-ready orders, sync/reconciliation exceptions and unresolved returns/credits. Reports contain trend/analysis views and are not the daily control surface.

## Data model
Use existing `ps_finance_documents` for linked Xero ACCREC/ACCPAY documents and remote state. Store operational finance controls in the Pool Shed workspace snapshot under `financeCommand`, including customer credit policies, chase events, allocation intents/audit, supplier payment-run state and locally acknowledged exceptions. Derived balances must prefer linked Xero document state where present, then use existing local legacy values only as a fallback.

## UX rules
- Preserve Pool Shed's approved navy/slate/white visual language and dense operational tables.
- Every KPI/flag is clickable when there is underlying work.
- Do not use generic accounting jargon without plain-English explanation.
- Do not expose annual spend on operational Overview screens.
- No dead buttons. Every visible action routes, mutates reviewed local state, opens a modal/workspace, exports data or calls the finance API.
- No em dashes in user-facing copy.

## Testing and release
TDD for finance calculations and action guards. Protect Supplier Command, Goods Note Control, Fulfilment, Inventory, Product Hub, Projects, Purchase Orders, Warehouse, Sales Orders, Dashboard and existing accounting API tests. Production build, runtime asset audit, JavaScript parse validation, full validation up to any known database-only dependency boundary, then run remaining non-database tests separately. Attempt browser smoke and report dependency limitations accurately.
