# The Pool Shed v2.0.1

## Fulfilment traffic lights

- Picking icon: grey when not started, amber when partially picked, green when fully picked.
- Packing icon: grey when not started, amber when partially packed, green when fully packed.
- Delivery icon: grey when not started, amber when partially shipped, green when fully shipped.
- Hover text now shows the exact completed quantity against the required quantity.

## Stock lifecycle correction

- Shipping now deducts physical stock and releases the matching allocated quantity.
- Each shipment remains permanently recorded as a Goods Out stock movement.
- Invoicing a fully shipped order reconciles any residual allocation to zero.
- Fully shipped and invoiced orders automatically move to Completed.
- Completed orders remain available in the Completed filter with their full order, invoice, goods-note and stock-movement history.
- Orders invoiced before all goods are shipped remain in Invoiced and keep the required allocation for outstanding fulfilment.

## Data safety

- No Supabase schema migration is included.
- No tables are dropped, renamed or recreated.
- Existing records are preserved.
