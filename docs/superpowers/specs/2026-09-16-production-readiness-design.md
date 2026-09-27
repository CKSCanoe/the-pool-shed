# Pool Shed v1.20.0 Production Readiness Design

## Goal
Turn the v1.19.0 feature-complete application into a release candidate whose critical business workflows are verified end to end, whose shared states and navigation are consistent, and whose production risks are visible rather than hidden.

## Scope
This phase does not introduce another major business module. It validates and hardens the existing CRM, Sales Orders, Projects, Purchasing, Supplier Command, Inventory, Warehouse, Fulfilment, Finance, Analytics, Automation/Assistant and Settings/Permissions capabilities.

## Acceptance journeys
1. Order to cash: customer/Sales Order -> allocation -> Goods Note -> pick/pack/ship -> invoice ready -> invoice/payment -> customer account allocation and reconciliation.
2. Procure to pay: supplier/PO -> supplier confirmation -> Goods-In/QC -> short/damaged exceptions -> supplier bill -> three-way match -> credit/payment status.
3. Project commercial lifecycle: project demand -> purchasing/stock -> stock consumption -> variations -> margin/commercial review -> invoice readiness -> close-out gates.
4. Returns and credits: shipped item -> return/credit -> Goods-In/QC -> restock/quarantine -> financial credit, with no stock increase from credit alone.
5. Engineer stock: van min/target/max -> transfer/top-up -> allocation protection -> cycle count -> movement history.
6. Automation and assistant safety: permission-scoped retrieval/actions, simulation/approval gates, no external-data answers.
7. Reporting/export integrity: governed metrics and exports source canonical records; full-system export remains Admin-only and auditable.

## Production-readiness controls
- Add a Production Readiness diagnostics surface under Settings showing system version, build/runtime asset health, connection/configuration checks, permissions health, unresolved operational exceptions, and environment limitations.
- Add an end-to-end acceptance engine that derives readiness findings from canonical workspace data and does not mutate business records.
- Add cross-module route/action checks so every critical alert can open the underlying authority surface.
- Add shared status terminology tests for Paid/Part Paid/Overdue, Received/Short, Shipped/Collected, and approval/hold states.
- Add release guards that use the current application version rather than freezing older release numbers.

## Non-negotiable invariants
- Inventory/Warehouse remain the physical quantity truth.
- PO/SO links are demand traceability, not stock ownership.
- Shipment is atomic and permanently locked once shipped.
- Credits do not increase physical stock until Goods-In/QC accepts a return.
- Supplier payments are governed by matched bills/credits, not PO status alone.
- Xero remains accounting ledger authority while Pool Shed owns operational finance workflow.
- Assistant and Automation cannot exceed the signed-in user's permissions.
- Full System Export is Admin-only and audit logged.
- No silent substitution, negative stock, silent accounting overwrite, or silent approval bypass.

## Release evidence
A release may be called production-ready only when the new end-to-end acceptance suite, all protected module suites, runtime validation, CSS/readability checks and production build pass. Database-only and browser-automation limitations must be reported explicitly if the extracted environment cannot run them.
