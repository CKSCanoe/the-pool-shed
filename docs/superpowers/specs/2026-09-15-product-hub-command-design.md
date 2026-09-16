# Product Hub Command Design

## Goal
Make Product Hub the authoritative product master for Pool Shed, with fast catalogue discovery, deep Product 360 records, existing-SKU Product Groups, existing-SKU Bundles/Kits, supplier commercial data and an explainable replenishment engine that creates reviewed Draft POs rather than automatic supplier orders.

## Authority boundaries
- Product Hub owns product identity, aliases, product/group/bundle relationships, supplier product data, cost/sell rules, barcode/MPN, accounting mappings and replenishment settings.
- Inventory/Warehouse remains the physical stock truth: On Hand, Allocated, Available, Quarantine and location movements.
- Purchasing remains the supplier commitment truth: Draft/Sent/Confirmed POs and inbound quantities.
- Sales Orders and Projects remain demand sources. Product Hub may summarise their uncovered exact-SKU demand but must not allocate stock.

## Product Hub navigation
Product Command, Catalogue, Replenishment, Product Groups, Bundle Studio, Imports, Catalogue Health.

## Catalogue
Default dense table uses high-value stacked columns rather than an oversized spreadsheet: Product, SKU/type, Supplier/Supplier SKU, Stock (Available prominent; On Hand/Allocated/Inbound secondary), Cost/Sell/Margin, Replenishment, Health and action. Search covers name, Pool Shed SKU, supplier SKU, barcode/EAN/UPC, MPN, aliases, brand, category and product group. Quick views: Core, Purchasing, Sales, Warehouse. Product quick-view opens in a drawer; Product 360 is one click away.

## Product 360
Tabs: Overview, Identity & Groups, Suppliers & Cost, Price Books, Stock Rules, Accounting, Media & Docs, Bundles & Relations, Movement & Audit. Stock Rules stores replenishment-enabled, reorder point, target stock, preferred supplier, supplier MOQ, supplier order multiple/pack quantity, lead time, safety stock and default location/bin. Existing per-location restock rules remain supported.

## Product Groups
A Product Group/Family organises existing SKUs/variants without creating stock. One SKU may belong to a group and also appear in multiple bundles.

## Bundles/Kits
A Bundle has its own sellable Pool Shed SKU but no independent physical stock. Components must be existing non-bundle product SKUs. Nested bundles are rejected. Buildable quantity is the minimum component Available quantity divided by quantity-per-bundle. Bundle cost and margin are live from component costs. Sales may add the bundle as one commercial line while fulfilment tracks component lines. Purchasing explodes bundle shortages into real component supplier SKUs.

## Replenishment model
For each replenishment-enabled stocked product:
- Available = physical On Hand minus hard Allocated from Inventory.
- Inbound = open PO quantity minus physically received quantity, excluding cancelled/closed lines.
- Uncovered demand = open exact-SKU Sales Order shortage not already allocated/shipped, plus approved Project/Engineer demand not already covered by its linked PO where the underlying source data is available.
- Projected Available = Available + Inbound - Uncovered demand.
- A product needs replenishment when Projected Available <= Reorder Point.
- Base requirement = max(0, Target Stock - Projected Available).
- Suggested quantity respects Supplier MOQ and Order Multiple: quantity is at least MOQ when ordering, and rounded upward to the next valid order multiple.
- Existing inbound is never counted twice.
- Every recommendation exposes its calculation: Available, Inbound, Demand, Reorder Point, Target, MOQ, Order Multiple, Suggested Qty and Suggested Cost.

## Replenishment workspace
Supplier-grouped report with filters for Needs Ordering, Below Minimum, Low Soon, Supplier, Category, Brand, Warehouse/location, High Value and Missing Rules. Columns: Product, Supplier/Supplier SKU, Available, Inbound, Demand, Projected, Reorder At, Target, MOQ/Multiple, Suggested Qty, Unit Cost, Suggested Value, Reason. Users select lines and choose Create Draft PO. Draft creation merges into an existing Draft PO for the supplier when safe; otherwise creates a new Draft - Review PO. It never sends a PO automatically.

## Health and exceptions
Product Command surfaces missing supplier SKU, missing barcode/MPN where required, no default bin, no accounting mapping, cost/margin movement, duplicate SKU/identity risk, import conflicts, low/replenishment risk and bundle component/margin issues.

## Migration and compatibility
Existing `reorder`, `restockRules`, `supplierProducts.minQty`, `supplierProducts.packQty`, grouped variant fields and bundle component records are preserved and normalised. New fields are additive. Existing Sales Order, PO, Warehouse and Project authority layers must remain untouched visually and retain their current regression contracts.
