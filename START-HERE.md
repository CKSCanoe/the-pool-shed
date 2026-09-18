# Start Here · Pool Shed v1.31.0

## Where to create quotes

Use **Quotes** in the main left navigation, directly after **Sales Orders**, then press **New quote**.

You can also use **CRM → open customer → New quote**. The customer is preselected automatically.

Choose:

- **Quick Quote** for light refurbishments, repairs, covers, plant replacements and straightforward work. Acceptance goes directly to a Sales Order unless you choose to create a Project too.
- **Project Proposal** for new pools, major refurbishments and complex staged work. Acceptance creates the Project and linked Sales Order.

## Operational authority

- CRM owns customer master data.
- Quotes owns proposal/version/customer acceptance truth.
- Sales Orders own accepted customer item demand.
- Product Hub owns SKU/product/bundle definitions.
- Inventory/Warehouse own physical stock.
- Purchase Orders own supplier commitments.
- Projects link accepted work, Sales Orders, POs, Job Bin stock, costs, tasks, variations and billing without duplicating material ledgers.
- Accounting/Xero integration remains controlled separately.

## Customer security

The customer proposal is a separate presentation route. It does not expose Pool Shed navigation, supplier costs, margin, stock, Sales Orders, Purchase Orders, Projects or internal notes.

## Build

```bash
npm run build
```

## Deploy

Read `DEPLOYMENT-GUIDE-1.31.0.md` before changing the live Vercel/Supabase environment.
