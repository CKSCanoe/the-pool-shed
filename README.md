# Pool Shed v1.32.1 · Elite Quote Builder

Pool Shed is the Pool Bros operational system for CRM, Quotes, Sales Orders, Projects, Product Hub, Inventory, Purchasing, Warehouse, Fulfilment, Accounting, Analytics, Automation and controlled administration.

## Where quotes live

Use **Quotes** in the left navigation, directly after **Sales Orders**, then press **New quote**. You can also use **CRM → customer → New quote** with the customer preselected.

Choose **Quick Quote** for repairs, light refurbishments, covers, plant replacements and straightforward work. Choose **Project Proposal** for new pools, major refurbishments and complex staged projects.

## Elite Quote Builder

The v1.32 builder is a visual editor with Sections, Elements, Media and Products on the left, the live customer proposal in the middle and a contextual inspector on the right. Images can be uploaded for the proposal hero, product/option cards, image blocks and galleries, and reused from the quote Media Library.

Product Hub still owns the Product ID, SKU, supplier, cost and bundle truth underneath the presentation. The customer receives only the presentation-safe published version.

## Build and test

```bash
npm run test:quotes
npm run test:deployment
npm run build
```

The deployable static app is written to `dist/`.

The complete regression suite is `npm run validate`. Database execution tests require the normal development dependency `@electric-sql/pglite`, which is not installed in the sandbox used to prepare this package.

## Release documents

Read `RELEASE-NOTES-1.32.1.md`, `ELITE-QUOTE-BUILDER-AUDIT-1.32.1.md` and `DEPLOYMENT-GUIDE-1.32.1.md` before production promotion.


## v1.32.1 secure quote media

Apply `database/007-quote-studio.sql` then `database/008-quote-media.sql` before enabling production Quote Studio publication with uploaded media. Quote media is private and resolved through temporary signed URLs.
