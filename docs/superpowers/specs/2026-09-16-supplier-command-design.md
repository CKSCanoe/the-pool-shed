# Supplier Command Design

**Approved concept:** Option C Supplier Command, refined through interactive v3.

## Goal
Replace the thin supplier record with a procurement-led Supplier Command that remains connected to the existing Purchasing, Product Hub, Warehouse/Goods-In and Accounting records.

## Visual authority
Preserve the approved Option C composition:
- compact Supplier Command metrics across the top
- supplier queue/table as the primary directory
- Supplier Details directly below/inside the same command surface
- Needs Attention and Quick Actions rail on the right
- dense navy/slate/white Precision Operations styling with restrained teal accents
- no "Supplier 360" terminology; use **Supplier Details**

## Supplier Command overview
Top-level metrics must favour operational action, not reporting vanity metrics:
- Suppliers needing attention
- Outstanding supplier bills/payments
- Credit alerts
- Late/missing PO lines
- Open supplier credits/claims
- Cost changes awaiting review

Annual spend must not occupy the day-to-day Overview. Spend remains available only in Spend & Performance/reporting.

## Supplier Details tabs
1. Overview
2. Contacts
3. Products & Price Lists
4. Purchase Orders
5. Late & Backorders
6. Returns & Credits
7. Bills & Credits
8. Spend & Performance
9. Notes & Activity

## Overview requirements
The supplier Overview must show operational and account health together:
- credit limit
- current supplier account balance
- available credit
- open PO exposure
- projected exposure = current account balance + open PO exposure
- projected utilisation percentage
- graded credit warning before the supplier limit is exceeded
- overdue/outstanding supplier bills and payments
- on-time delivery percentage
- average actual lead time
- open backordered/missing units
- immediate action queue that deep-links into the correct supplier tab or underlying PO/bill/return

Credit terminology must distinguish PO exposure from actual payable balance. Never label a PO itself "unpaid".

## Credit warning rules
- no credit limit: neutral "No trade credit limit recorded"
- below 70% projected utilisation: normal
- 70% to <85%: watch
- 85% to <100%: warning
- >=100%: critical / projected over limit
- if current payable balance itself exceeds limit, critical regardless of open PO value
- warn before creating/opening a new PO when projected exposure is close to or above the limit

## PO delivery intelligence
For each supplier PO track/display:
- ordered date
- supplier-confirmed date when available
- promised/confirmed ETA or PO due date
- actual full receipt date when available
- live timer while open: ordered X days ago, Y days to promised date, or Z days late
- frozen result after full receipt: received N days early, on time, or N days late

These actuals feed supplier on-time percentage and average actual lead time.

## Smart flags
Generate actionable flags from existing transactional data where possible:
- late PO
- missing/short quantity after Goods-In
- backordered line needing chase
- supplier chase due/no response
- received PO with no supplier invoice reference
- supplier invoice requiring three-way match
- invoice/payment due soon
- overdue supplier bill/unpaid amount when Accounting/Xero or local PO payable data is available
- supplier credit expected but not received
- cost increase / supplier price change awaiting review
- projected credit exposure nearing/exceeding limit

Every flag must explain the problem and provide the next action. Alerts must deep-link rather than dead-end.

## Products & Price Lists
This is a supplier-filtered operational view of Product Hub, not a second product database.

Show only products supplied by the selected supplier, including:
- Pool Shed SKU
- supplier SKU
- product name
- current supplier cost
- RRP / margin context
- lead time
- current stock / on PO where available
- preferred supplier status
- active/discontinued/missing supplier SKU health

Actions:
- Open Product Details
- Cost History
- Add to PO / New PO
- Import Price List
- Export Supplier Products CSV
- Download Import Template CSV
- Price List History

Price list import must use review-before-commit:
Upload/paste CSV -> map/match supplier SKU or Pool Shed SKU -> preview changes -> identify increased/decreased/new/unmatched/discontinued -> explicit approval -> update supplier offer/product supplier cost. Never silently overwrite costs.

Maintain import audit/history in supplier data.

## Purchase Orders
Supplier-filtered PO list with timer, receipt progress, status, value, invoice/match status and direct Open PO/Book In/Record Chase actions.

## Late & Backorders
Supplier-specific late and missing line queue with:
- ordered/received/outstanding quantity
- promised date
- days late
- chase status / next chase
- linked Sales Order/Project when present
- Record Chase / Update ETA / Book In / Open PO

## Returns & Credits
Use existing supplier return records and expected credit state. Outstanding expected credits remain flagged until resolved/closed.

## Bills & Credits
Use existing PO supplier invoice fields plus Accounting/Xero snapshot when available. Distinguish:
- invoice missing
- needs match
- matched
- due soon
- overdue/unpaid
- paid
- credited

Do not allow finance status to mutate stock or fulfilment.

## Navigation / connections
Supplier Command actions must connect to existing authority surfaces:
- New PO -> Purchasing PO workflow, preselected supplier where practical
- Open PO -> Purchase Order Command
- Product Details -> Product Hub Product Details
- Replenishment -> Product Hub/Purchasing replenishment
- Book In -> Warehouse Goods-In for selected PO
- Returns -> existing Supplier Returns & Credits
- Invoice Matching -> existing Purchasing Invoice Matching
- Accounting -> Accounting/Xero workspace

Opening a supplier from a PO must preserve enough supplier/PO context for sensible return navigation.

## Data authority
Do not duplicate physical stock, PO, receiving, product or finance truth. Supplier Command is a derived/control workspace over existing records plus supplier-specific metadata such as contacts, credit limit, notes and price-list import audit.
