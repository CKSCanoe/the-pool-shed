# Goods Note Control Design

## Goal
Make Fulfilment Goods Note-led, easy to operate and irreversible after Ship, while preserving existing Sales Order, Warehouse, Inventory and Sales Credit authority.

## Workflow
Fully allocated Sales Order / Goods Note → Pick Run → actual pick confirmation → Pack & Dispatch Details → Parcel Goods Note print → Ship Gate → Ship & Lock.

After Ship there is no Unship, Unpick, Unpack or quantity edit. Returns use Shipped Goods Note → Sales Credit / Return → Goods-In → QC → Restock or Quarantine.

## Pick Runs
Only unshipped, unheld Goods Notes whose complete quantities remain allocated are eligible. A Pick Run consolidates eligible notes by physical location + SKU and preserves a breakdown by Goods Note and Sales Order. Printing the run must show location, SKU, product, total pick and per-order breakdown.

## Parcel Goods Note
A customer-facing document for the parcel. It contains Pool Bros identity, Goods Note, Sales Order, delivery details, parcel number, SKU/product/quantity and return/contact information. It must not contain internal cost, margin, stock-location or allocation data.

## Pack / Dispatch
Dispatch modes are Courier, Post, Pool Bros Delivery and Collection.
Courier records carrier, service, parcel count, per-parcel tracking, weight and dimensions.
Post records postal service, tracked/untracked and reference/tracking where applicable.
Pool Bros Delivery records driver, vehicle/reference, delivery date and loaded confirmation.
Collection records ready/notified/collected controls and never invents courier tracking.
Packing can be saved before all dispatch data exists, but Ship remains blocked until the mode-specific requirements are complete.

## Ship Gate
Ship requires full pick, full pack, valid quantities, allocation, physical stock and mode-specific dispatch details. Stock mutation is atomic. If any line fails immediately before Ship, nothing is deducted.

## Immutable shipment
Ship sets a permanent shipment lock and records shippedAt/shippedBy. All mutation APIs must reject changes to shipped Goods Notes. Reprint and read-only tracking/history remain allowed.

## Returns
A shipped Goods Note exposes Create Return / Credit. This creates a Sales Credit linked to both original Sales Order and Goods Note, with zero stock impact. Stock only returns through the existing Sales Credit receipt / Goods-In process and is then restocked or quarantined.

## UI
Keep Fulfilment Command Option A as home. Add Print Pick Run and Print Parcel Goods Notes. Goods Note detail shows immutable status after shipment, Pack & Dispatch editor before shipment, Ship Gate, and Create Return / Credit after shipment.
