# The Pool Shed v2.0 Performance Preview

This preview is built from v1.11.9 and preserves the existing application workflows while restructuring the browser payload for faster loading and safer caching.

## Improvements

- Reduced `index.html` from approximately 1.26 MB to a lightweight application shell.
- Extracted 14 inline style blocks into cacheable CSS assets.
- Extracted 6 inline JavaScript blocks into cacheable deferred scripts.
- Preserved script execution order using `defer`.
- Added immutable caching for versioned assets.
- Added CDN connection hints.
- Added rendering containment for large panels and tables.
- Added a performance audit command.

## Test locally

```bash
npm run validate
npm run build
npm run audit
```

Then serve the `public` directory with the existing development server or deploy the repository root to Vercel.

## Important

This is a compatibility-first v2 preview rather than a complete framework rewrite. The existing screens and data model remain intact so it can be tested without migrating production data.

## v2.0.1 fulfilment lifecycle update

- Three-stage sales order icons now calculate from quantities, not only boolean flags.
- Any part-picked, part-packed or part-shipped stage displays amber.
- Fully completed stages display green.
- Shipping deducts physical stock and releases the matching allocation while preserving the Goods Out movement history.
- Invoicing reconciles any residual allocation to zero.
- Fully shipped and invoiced orders move to Completed and retain their order, invoice, goods-note and stock-movement history.
- Invoiced orders with outstanding fulfilment remain visible as Invoiced rather than being incorrectly completed.
