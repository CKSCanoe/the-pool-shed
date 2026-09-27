# Project 360 Commercial Control Design

## Status
Approved by Aaron for implementation on 2026-09-15.

## Goal
Turn Projects into the authoritative job, stock and commercial-control workspace without creating a parallel stock, purchasing or accounting system.

## Core rule
A Project owns the commercial and operational context for a job. Warehouse remains physical stock truth, Purchasing remains supplier commitment truth, Sales Orders remain customer-order truth, and Accounting/Xero remains invoice/payment truth. Projects reconcile those records into one live view and add project-specific planning controls.

## Project navigation
Projects home has two views:
- Precision Desk: dense exception-first list of projects with health, stage, materials readiness, projected margin, invoicing exposure and next action.
- Stage Board: optional planning view by lifecycle stage.

Opening a Project enters Project 360 with tabs:
1. Overview
2. Scope & Tasks
3. Materials
4. Procurement
5. Stock & Job Bin
6. Project Purchasing
7. Tools
8. Costing & Margin
9. Billing & Variations
10. Site Notes & Files
11. Activity
12. Settings

## Lifecycle
Planning → Approved → Procurement → Ready for Site → In Progress → Commercial Review → Ready to Invoice → Completed, with On Hold and Cancelled exceptions.

## Commercial bar
Always visible on Project 360 detail:
- Quoted / contract value
- Approved variations
- Forecast final cost
- Projected profit
- Projected margin
- Invoiced/queued amount
- Remaining to invoice

All values are GBP excluding VAT and are labelled as management forecast values rather than statutory profit.

## Margin model
Forecast revenue = accepted quote + approved variations.

Forecast final cost = actual recorded costs + received PO estimates not yet replaced by bills + outstanding committed PO costs + remaining/uncommitted forecast + active tool/hire cost.

Projected profit = forecast revenue - forecast final cost.

Projected margin = projected profit / forecast revenue.

Projects store configurable:
- targetMargin
- minimumMargin
- lossWarningMargin

Default target margin remains compatible with existing project records. New minimum margin defaults to five percentage points below target, never below zero.

## Margin movement
Project 360 shows explainable margin movement rather than only a final percentage. Categories include:
- baseline quote/material forecast
- approved variations
- PO cost/commitment changes
- actual recorded costs
- remaining forecast
- tool/hire exposure
- material plan variance

Alerts must explain the cause of risk in pounds and, where practical, percentage points.

## Project health
Derived, never manually set.

Healthy:
- margin at/above target
- no serious material blockers
- no overdue invoice exposure alert
- no critical open task/tool/PO exception

Attention:
- margin below target but above minimum
- overdue tasks, stale forecast review, late/unconfirmed PO or invoice exposure approaching threshold

At Risk:
- projected margin below minimum
- significant unplanned cost/material variance
- large uninvoiced exposure
- critical material/PO blocker

Critical:
- forecast loss or near-loss threshold reached
- unresolved commercial blocker that prevents safe continuation/closure

## Material plan
Project planning adds a material budget, not a second stock ledger. Each material-plan line stores:
- id
- productId
- plannedQty
- budgetUnitCost
- note

The Project compares planned quantities/costs with live stock/purchasing records.

## Project stock view
For each product the Project derives:
- Planned
- Allocated to Project from `data.allocations`
- Inbound on linked Purchase Order lines
- Job Bin on hand from the Project's actual stock location
- Used from Project-use stock movements recorded through shared stock functions
- Return Pending where stock is moved/requested out of the Project context
- Damaged/Lost from explicit Project stock disposition movements
- Budget cost
- Forecast/actual material cost
- Cost variance

The Project does not directly rewrite warehouse quantities. Project stock actions must call shared stock/movement functions and create auditable movements.

## Project stock actions
From Stock & Job Bin an authorised manager can:
- Create/link the Project Job Bin using the existing job-bin function.
- Record Project Use from free Job Bin stock. This deducts physical stock through the shared stock function and writes a `Project Use` movement tied to the Project.
- Send unused stock to Warehouse transfer workflow rather than silently deleting it.
- Flag damaged/lost stock with quantity and reason, using shared stock mutation/movement functions.

No action may consume allocated stock belonging to another demand.

## Procurement
Project Procurement shows every linked PO and line, including:
- supplier
- ordered value
- received value estimate
- still committed
- ETA / status
- material/demand source

Opening the PO uses the approved Supplier Order Command. Physical receipt remains Warehouse-owned.

## Project Purchasing
Every Project Purchase Demand linked to the Project is visible with requested quantity/value, urgency, PO linkage and real fulfilment state. New Project material demand must prefer available stock before purchase.

## Costing
Separate:
- Estimated / material budget
- Committed
- Received estimate
- Actual
- Remaining forecast
- Tools/hire
- Returned/credited effects where present
- Forecast final cost
- Projected profit
- Projected margin
- Variance from target cost envelope

## Variations
Proposed variations include sell value and cost value. Their cost risk remains visible, but proposed sell value is excluded from agreed revenue until approved. Approved variations increase agreed revenue and retain their own cost/approval reference.

## Invoice thresholds
Project settings support:
- milestone stage billing
- cost-exposure threshold
- optional percentage-completion advisory

Required fields:
- invoiceExposureThresholdPct, default 40
- invoiceExposureThresholdNet, default 0 (disabled until set)

Exposure alert triggers when actual/received/committed cost exposure materially exceeds invoiced or queued project value according to the configured threshold. Alerts recommend invoice review but never create or send an invoice automatically.

## Billing
Existing project phases and Xero draft workflow remain authoritative. Project 360 shows:
- phase value
- readiness
- queued status
- accounting status when the live finance snapshot is available
- total invoiced/queued amount
- remaining agreed value

## Close-out gate
A Project cannot close while any of these remain unresolved:
- open Project tasks
- open linked PO quantities or unresolved supplier exceptions
- stock still in Project Job Bin unless dispositioned
- open Project Purchasing
- outstanding Project tools/hire
- proposed variations requiring decision
- billable/invoice stages not reconciled
- critical commercial/margin warning requiring review

## UX
Use the approved Precision Operations language:
- navy navigation
- white/cool-grey work canvas
- aqua/teal accent
- compact metrics
- dense but readable tables
- no dark-green legacy hover state
- no decorative gradient cards

Project home uses Precision Desk as default with Stage Board as a secondary view. Project detail uses Project 360 Command.

## Responsive and accessibility requirements
- no horizontal page overflow; tables may scroll inside dedicated regions
- sticky commercial bar/inspector only where it does not obscure content
- minimum readable supporting text consistent with existing readability tests
- keyboard-focusable tabs and actions
- clear warning/critical states without relying on colour alone

## Regression constraints
Do not redesign or mutate the approved Dashboard, Customer, Sales Order, Purchase Order Command or Warehouse Precision Desk.

Warehouse FIFO allocation remains unchanged.
Purchasing demand-source links remain traceability and do not override FIFO.
Existing project billing/Xero workflow remains intact.
Existing offline/local save and workspace sync remain intact.
