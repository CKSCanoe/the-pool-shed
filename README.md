# The Pool Shed - Version 1

Production-clean application package for Vercel + Supabase.

## Deployment

1. Upload the contents of this folder to the root of the GitHub repository.
2. Keep Vercel Root Directory blank.
3. Build command: `npm run build`
4. Output directory: `dist`
5. Keep the existing Supabase environment variables configured in Vercel.

## Data safety

This release does not run destructive SQL and does not recreate existing products, customers, stock, sales orders, purchase orders, suppliers or locations.

Bundle component sales-order lines are operational stock lines only. Their sales value and sales-order margin cost are zero; the priced/costed bundle head remains the commercial line. The underlying component product records retain their own true supplier cost for purchasing and stock reporting.

## Main production cleanup

- Large Sales Order bundle-intelligence panel removed from the page while the stock/transfer/PO engine remains available behind the linked component lines.
- Bundle components remain linked to real catalogue product IDs and stock SKUs.
- Bundle component cost is excluded from Sales Order margin totals to prevent double-counting.
- Sales Order controls are compact and kept at the top of the order.
- Product and Sales Order tabs are more visibly interactive.
- Non-stock/custom/delivery lines are collapsed behind a compact + control.
- Fulfilment uses the Print -> Pick -> Pack -> Ship sequence.
- Sales Order product smart search retains live/offline catalogue behaviour.
- Purchase Order catalogue search uses a cached token index for large catalogues.
- Old user-facing version labels are removed.
- A clean branded boot screen prevents legacy screens flashing during application startup.
- Light/dark and responsive layout refinements are applied by the production UI layer.

## Validation

Run:

```bash
npm run validate
npm run build
npm run audit
```

## Sales Order Smart Customer Picker

Sales Orders now use a live CRM customer picker rather than the browser datalist / Apply workflow. Staff can search by name, company, email, phone or customer code, choose a suggested CRM customer with mouse or keyboard, or create a new customer in an on-page drawer. New customers are saved to the existing CRM data store and attached to the Sales Order immediately, including pricing and master delivery-address population. Duplicate email/phone detection offers the existing CRM record instead of creating a second profile. The picker and its assets are included in the offline service-worker cache.
