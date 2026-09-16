# Warehouse Precision Desk Design

**Status:** Approved for implementation
**Approved concept:** Warehouse Concept C, Precision Desk
**Baseline:** Pool Shed v1.7.5 Order Command Parity

## Goal

Replace the generic Warehouse presentation and error-prone goods-in allocation flow with a dense, professional Warehouse Precision Desk backed by one auditable stock lifecycle.

## Locked stock lifecycle

Sales demand → shortage → purchase order → inbound association → physical receipt → QC → FIFO hard allocation → demand-aware putaway/cross-dock → pick → pack → ship.

Stock is not allocatable while it is only expected, in Receiving, damaged, or Quarantined.

## Stock-state definitions

- **On Hand:** physical stock in controlled locations.
- **Allocated:** accepted on-hand stock reserved against open Sales Orders/Projects.
- **Available:** On Hand minus Allocated, excluding Receiving and Quarantine.
- **Inbound:** outstanding quantity on open Purchase Orders.
- **Inbound Reserved:** inbound quantity associated with open demand. This is not hard allocation.
- **Receiving/QC:** physical arrival awaiting release. Not available.
- **Quarantine:** blocked physical stock. Not available.
- **Picked/Staged:** allocated physical stock progressing through fulfilment.
- **Shipped:** stock removed from On Hand by the definitive fulfilment movement.

## Automatic goods-in allocation

After accepted stock enters an allocatable location, Pool Shed automatically allocates the exact SKU to eligible open Sales Order shortages.

Priority is deterministic:

1. exact Pool Shed product/SKU only;
2. eligible open Sales Order shortage only;
3. oldest Sales Order `created` date first;
4. where created dates tie, earliest `due` date first;
5. where still tied, lowest Sales Order ID first.

A Purchase Order's `salesOrderId` remains a **demand-source / inbound association**, not ownership of the received physical unit. A newer Sales Order may have raised the PO, while an older Sales Order receives the first accepted stock under FIFO.

Orders in Cancelled, Completed, Shipped or Invoiced states are not eligible.

Each automatic allocation records:
- PO;
- receipt/PO line;
- product;
- Sales Order;
- quantity;
- timestamp;
- allocation method `FIFO`;
- original PO demand-source Sales Order when present.

## Manual reallocation override

Automatic allocation always runs first.

Authorised users may deliberately reallocate accepted stock afterwards when moving stock can complete another order while the source order remains blocked by other shortages.

The override must:
- specify exact SKU, source SO, destination SO and quantity;
- ensure the source currently owns enough allocation;
- ensure destination has a real shortage;
- require a non-empty reason;
- preview/return the impact on both orders;
- update stock allocation totals without changing physical On Hand;
- recalculate both order statuses;
- record an audit movement and notifications on both orders.

The system must never expose an ordinary goods-in dropdown that lets a user choose the Sales Order before the FIFO allocation has run.

## Warehouse information architecture

Warehouse uses the selected Precision Desk layout with these views:

1. **Work Queue** — single priority queue for receipts, QC, putaway, transfer, return/quarantine and count exceptions, with a selected-record inspector.
2. **Inbound** — continuous Receive → QC → Putaway workflow.
3. **Transfers** — warehouse/bin/van/project/site transfers through one movement engine.
4. **Returns & Quarantine** — restock, quarantine, supplier return, repair or write-off decisions.
5. **Counts** — cycle counts, van counts and project-close counts, with variance approval.
6. **Audit** — permanent receipt, allocation, reallocation, putaway, transfer and count history.

## Visual rules

- Match the approved Dashboard palette, typography and operational density.
- Dense information hierarchy, no decorative SaaS card sprawl.
- Desktop-first operational table with responsive horizontal containment.
- Calm blue-grey hover and active states, no legacy dark green.
- All overlays/drawers must remain within viewport and avoid z-index conflicts.
- Buttons and tabs must use real actions/routes, not prototype-only interactions.

## Acceptance criteria

- A PO linked to a newer SO cannot jump an older eligible SO in automatic allocation.
- Receiving and Quarantine stock cannot auto-allocate.
- Exact-SKU matching only.
- Partial receipts allocate only the accepted quantity.
- FIFO allocation can span multiple open Sales Orders.
- Remaining accepted quantity stays available if demand is exhausted.
- Manual reallocation cannot exceed source allocation or destination shortage.
- Manual reallocation requires a reason and creates an audit trail.
- Warehouse Work Queue, Inbound, Transfers, Returns & Quarantine, Counts and Audit are real reachable views.
- Existing Dashboard, Customer and Sales Order authority is not restyled or overridden.
- Build/runtime asset versions are release-coherent.
