# Pool Shed Full System Final Polish Design

## Goal
Produce one coherent full-system release from the verified v1.20.1 baseline without adding a new business subsystem.

## Authority
Existing module authority remains unchanged. This phase only standardises final navigation terminology, release identity, runtime/cache wiring, production-readiness identity, setup documentation, action/navigation integrity, and packaged release cleanliness.

## Final navigation terminology
Dashboard, CRM, Projects, Sales Orders, Engineer Requests, Product Hub, Inventory, Purchasing, Warehouse, Fulfilment, Accounting, Analytics, Automation, Settings.

## Safety constraints
- Xero remains `Ready to Connect`; no live OAuth authorisation or data sync.
- Inventory/Warehouse remain physical quantity truth.
- Finance remains operational finance with Xero as future accounting ledger.
- Assistant remains Pool Shed-only and permission-filtered.
- No business record is mutated by production-readiness diagnostics.
- Existing protected module tests must remain green.

## Release acceptance
- One runtime version and cache identity.
- No stale previous-version runtime asset references.
- Final navigation uses approved terminology.
- Production Readiness reports the current release identity.
- Xero Ready gate remains locked.
- All referenced runtime assets exist and JavaScript parses.
- Production build completes.
- Database/browser acceptance gaps remain explicit if their tooling is unavailable.
