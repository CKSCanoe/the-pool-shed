# The Pool Shed v2.1.0 — Bundle Product System

## Added
- Brand-new Product Profile Bundle Builder linked to existing catalogue product IDs and SKUs.
- Product types: Standard Product, Bundle Product, Variable Product, Service and Digital Product.
- Real-time catalogue search by name, SKU, barcode, supplier SKU, brand and category.
- Live cost, component RRP, fixed/automatic/discount pricing, saving, profit, margin and weight calculations.
- Effective bundle availability driven by the lowest available component.
- Nested bundle calculation with circular-reference protection.
- Smart warnings for unavailable, archived/discontinued and below-margin components.
- Customer quotation and invoice bundle display rules.
- Stock simulation for larger bundle quantities.
- Bundle duplication workflow.
- Responsive Pool Shed branded interface with persistent save bar.

## Data safety
- No destructive SQL or Supabase migration is included or run.
- Bundle components reference existing product IDs and do not create duplicate stock records.
- Existing products, orders, stock, customers and suppliers remain untouched.
