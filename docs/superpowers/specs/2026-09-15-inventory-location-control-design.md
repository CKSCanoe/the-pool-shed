# Inventory Location Control Design

## Goal
Make Inventory the physical-stock authority for Pool Shed, centred on location control and engineer van readiness, while reusing the existing stock, Warehouse, Project, Product Hub and Purchasing records.

## Authority boundaries
- Product Hub owns product identity and replenishment settings such as product-level reorder point, target, MOQ, order multiple and preferred supplier.
- Inventory owns physical location balances, location-level min/target/max, internal transfers, van readiness, counts, exceptions and movement traceability.
- Warehouse owns Receive -> QC -> Putaway and its FIFO allocation engine.
- Purchasing owns supplier commitments and purchase orders.
- Projects own project demand/commercial links; Project Job Bins remain Inventory locations.
- No duplicated stock ledger or shadow quantities.

## Navigation
Inventory uses: Overview, Stock, Locations, Engineer Vans, Project Stock, Transfers & Top-Ups, Cycle Counts, Missing / Damaged, Stock Movements, Exceptions & Alerts.

## Location Control
Option C is the primary operating design. Each location has KPIs for on hand, allocated/reserved, available, stock value, low lines, over-target lines, count status and open transfers. Warehouse bins, vans, Project Job Bins, quarantine, receiving and site-hold locations use the same stock source.

## Engineer Van Control
Engineer van locations support a stock profile and per-SKU Min, Target and Max. The system calculates below-min lines, quantity to reach Target, over-Max/excess return opportunities, upcoming Project/Engineer Request demand, count due state, stock accuracy trend and missing/damaged value.

Suggested internal moves always use physical stock available in an eligible Warehouse source. Creating a top-up creates an internal stock transfer/movement, never a supplier PO. If Warehouse cannot cover a shortage, Inventory links to Product Hub Replenishment rather than duplicating supplier purchasing logic.

## Smart threshold suggestions
Inventory may suggest a higher/lower van Min based on recent outbound/transfer usage and open engineer/project demand. Suggestions are advisory and require human acceptance; thresholds never self-edit.

## Seasonal profiles
Locations may use a profile name such as Standard Service Van, Installation Van, Summer Service or Winter Service. Applying a profile previews adds/reductions and never posts stock automatically.

## Alerts and reminders
Alerts are actionable and explain Problem -> Why -> Next action. Examples: core SKU below Min, Project demand due soon, count overdue, repeated variance, excess/no-movement stock, quarantine item unresolved, serial/batch exception. In-app reminders are stored as Inventory exceptions/notifications; later Automation/Azzy can deliver them externally.

## Cycle counts
Count sessions preserve existing approval mechanics: expected -> counted -> variance -> reason -> submit -> approval/recount/reject -> post movement. High-value/repeated-variance lines can be prioritised. Stock locations in an active count remain frozen where existing engine rules apply.

## Cross-module links
- Product links open Product Details, never “Product 360”.
- Project Job Bin rows open the corresponding Project where identifiable.
- PO/inbound links open Purchasing/PO Command.
- Warehouse actions link to Warehouse for Receive/QC/Putaway.
- Replenishment gaps link to Product Hub Replenishment.
- Every internal transfer or approved adjustment produces a movement/audit record.

## Visual design
Use the approved Precision/Command visual language: navy/slate/white, restrained teal, compact readable tables, no legacy dark-green hover, no oversized SaaS cards. Location Control is primary. Tables must remain readable at compressed desktop/tablet widths via controlled horizontal scrolling and sticky columns where useful.

## Terminology
Use Product Details for the full product record. Do not show Product 360 in Product Hub user-facing copy.

## Verification
New Inventory engine/workspace/visual tests must run before protected Product Hub, Project, Warehouse FIFO/booking, Purchasing/PO, Sales Order, Customer/Dashboard, CSS ownership, build and release-asset checks. Database-only tests remain subject to the existing PGlite dependency limitation.
