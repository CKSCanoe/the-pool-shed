# Fulfilment Command Design

## Goal
Make Fulfilment a clear outbound work queue while preserving Goods Notes as the physical execution record and Sales Orders as the commercial record.

## Authority model
- Sales Order owns commercial demand, customer and order value.
- Goods Note owns outbound execution: print, pick, pack, ship/collect and dispatch history.
- Inventory/Warehouse remain physical stock authority.
- Ship is the stock-out event. Pick and Pack never reduce On Hand.

## Fulfilment home
Use approved Option A as the default screen with Overview, Goods Notes, Pick Queue, Pack Bench, Dispatch, Collections, Delivery Exceptions and History.
The Overview must show Ready to Pick, Due Today, Awaiting Pack, Ready to Ship, Collections, Blocked and Shipped Today plus an exception-first work queue.

## Work queue
Each row shows Goods Note, customer/order, due date, method, warehouse, lifecycle progress, line readiness, carrier/tracking, exception and a deterministic next action.
Universal search covers Goods Note, Sales Order, customer, SKU/product, postcode/address and tracking.
Filters include all open, priority, due today, blocked, collection and partial.

## Operational controls
- Put on Hold / Release Hold is auditable and blocks print/pick/pack/ship progression.
- Print queue prints eligible picking lists only.
- Batch Pick marks eligible notes picked through the existing lifecycle engine.
- New Shipment routes to the Sales Order fulfilment workflow because a shipment must originate from allocated commercial demand.
- Collection ready notification is recorded and the customer-facing status is explicit.
- Address/carrier/stock exceptions route to the owning record/action rather than being silently overridden.

## Ship gate
A Goods Note cannot ship when held, not packed, line quantities are invalid, eligible physical stock is insufficient, or required dispatch information is missing.
Courier shipments require courier and a real tracking/label reference, not a placeholder.
Pool Bros van deliveries require packed stock; tracking is not required.
Collections are not treated as courier shipments. They must be packed/staged and customer-ready before collection completion.

## Stock deduction
Shipment deduction must be atomic at the Goods Note level. Preflight all lines first. If any line cannot be covered by eligible source stock, move no stock and do not set shipped. When valid, deduct across eligible source rows as required, release matching allocation, write movement records, then mark shipped.

## Compatibility
Preserve partial Goods Notes, legacy print/delivery-note functions, Sales Order status synchronisation, customer notifications, CSV/export, Warehouse FIFO allocation, Product Hub, Projects and Inventory.

## Visual rules
Dense Pool Shed navy/slate/white command language. No oversized SaaS cards. Minimum readable microcopy. Full-width queue with horizontal containment. Responsive stacking below desktop. Scoped CSS must prevent legacy Fulfilment decorators from overriding the command surface.
