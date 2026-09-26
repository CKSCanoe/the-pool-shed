# Pool Shed v1.11.0 Product Hub Command Release Audit

## Release identity

- Package version: `1.11.0`
- Release name: **Product Hub Command**
- Service-worker cache: `pool-shed-v1.11.0-product-hub-command`
- Product Hub engine authority: `public/product-hub-engine.js`
- Product Hub workspace authority: `public/product-hub-workspace.js`
- Product Hub CSS authority: `public/assets/css/system/46-product-hub-command.css`
- Runtime CSS build: 19 maintained ownership modules
- Implementation baseline: Pool Shed v1.10.0 Project 360 Commercial Control

The supplied v1.10.0 release is not a Git repository, so v1.11.0 was developed in a full isolated copy at `Pool-Shed-1.11.0-Product-Hub-Command`. The v1.10.0 baseline was not modified in place.

## Product Hub architecture implemented

Product Hub now owns product identity and commercial/replenishment rules while preserving authority boundaries:

- **Product Hub:** SKU/product identity, supplier product data, pricing/cost, product groups, bundle definitions, barcode/MPN/aliases, accounting mappings and replenishment rules.
- **Inventory/Warehouse:** physical stock quantity/location truth.
- **Purchasing:** supplier commitments, Purchase Orders and inbound purchasing truth.
- **Sales/Projects:** customer/project demand. Warehouse FIFO remains the physical Sales Order allocation authority after receipt/QC.

No parallel stock ledger was introduced.

## Product Command

`Product Command` is the Product Hub landing workspace and provides exception-first catalogue control, including:

- live product count;
- products needing replenishment and suggested purchase value;
- catalogue health issues;
- bundle/component risk;
- direct paths into Catalogue, Replenishment, Product Groups, Bundle Studio and new-product setup.

## Catalogue quick-glance workspace

The catalogue is now a full-width operational list designed for rapid product finding rather than a large generic spreadsheet.

Default quick-glance information includes:

- product image/name with brand/category/group context;
- Pool Shed SKU and product type;
- preferred supplier with supplier SKU beneath it;
- **Available** as the dominant stock number, with On Hand, Allocated and Inbound beneath it;
- cost, sell price and margin;
- reorder point, target stock, MOQ, order multiple and suggested purchase quantity;
- catalogue/product health;
- quick-view and Product 360 actions.

Quick-view presets are provided for Core, Purchasing, Sales and Warehouse working contexts.

Universal product search uses product name, Pool Shed SKU, supplier SKU, barcode, MPN, aliases/old codes and related identity fields.

## Product 360

Individual products now open into Product 360 with these authority tabs:

1. Overview
2. Identity & Groups
3. Suppliers & Cost
4. Price Books
5. Stock Rules
6. Accounting
7. Media & Docs
8. Bundles & Relations
9. Movement & Audit

The Stock Rules workspace exposes the replenishment controls required for purchasing decisions:

- replenishment enabled/disabled;
- reorder point / minimum stock;
- target / restock-to quantity;
- safety stock;
- preferred supplier;
- supplier MOQ;
- order multiple;
- supplier lead time;
- default warehouse/bin/location.

These controls are also captured during **new product creation**, so a newly-created stocked SKU can be replenishment-ready without a second setup pass.

## Product Groups

Product Groups/Families are separate from bundles. They organise existing SKUs into related ranges/variants without creating duplicate products or stock.

A SKU may belong to a Product Group while also remaining sellable independently and appearing in one or more bundles.

## Bundle Studio

Bundle Studio creates sellable/operational kits from existing component SKUs.

Implemented safeguards and behaviour:

- bundle has its own Pool Shed SKU and sell price;
- components reference existing catalogue product IDs;
- component stock is never duplicated into fake bundle stock;
- buildable bundle quantity is derived from the limiting component's **Available** stock;
- bundle component cost and margin are recalculated from live component data;
- the same component SKU may be used in multiple bundles;
- nested bundles are rejected in v1.11.0;
- existing bundle and Sales/Purchasing intelligence remains preserved.

## Replenishment and reorder control

A dedicated **Replenishment** workspace now produces an explainable supplier-grouped reorder report.

The projected stock rule is:

`Projected Available = Available + Confirmed Inbound - Uncovered Demand`

When projected stock is at or below the reorder point:

1. Base requirement is calculated to reach the product's target/restock-to quantity.
2. The suggested quantity respects the product-level supplier MOQ.
3. The result rounds upward to a valid supplier order multiple/pack quantity.
4. If confirmed inbound already covers the requirement, the suggested quantity falls to zero.

The report shows product, supplier/supplier SKU, Available, Inbound, Demand, Projected Available, reorder point, target, MOQ/order multiple, suggested quantity, unit cost and suggested purchase value.

Users can filter/select lines, adjust proposed quantities, and create supplier Draft POs.

### Purchasing safeguard

Replenishment never auto-sends a Purchase Order.

`Create Draft PO` creates or safely merges into a same-supplier `Draft - Review` PO whose source is Product Hub replenishment. It does not silently merge replenishment into unrelated demand-linked POs.

## Bulk catalogue maintenance

CSV export/import/template coverage now includes the Product Hub v1.11 replenishment and supplier-buying fields:

- `mpn`
- `aliases`
- `restockTo`
- `replenishmentEnabled`
- `minimumOrderQuantity`
- `orderMultiple`
- `leadTimeDays`
- `preferredSupplier`

Numeric and boolean parsing is preserved for these fields, allowing replenishment rules to be maintained in bulk.

The dedicated legacy product creation, bulk import, pricing and Catalogue Health views remain delegated to their proven renderer so the new Product Command cannot replace those screens during a rerender.

## TDD evidence

New regressions were written and observed failing before their corresponding production behaviour existed, then rerun green after implementation.

New Product Hub regressions:

- `scripts/test-product-hub-engine-v111.mjs`
- `scripts/test-product-hub-replenishment-v111.mjs`
- `scripts/test-product-hub-command-v111.mjs`
- `scripts/test-product-hub-bundles-v111.mjs`
- `scripts/test-product-hub-product-setup-v111.mjs`
- `scripts/test-product-hub-import-replenishment-v111.mjs`
- `scripts/test-product-hub-visual-guard-v111.mjs`

## Fresh verification on final code state

### Production build

`npm run build` completed with exit code 0.

Evidence from the final build:

- app.css built from 19 maintained CSS modules;
- runtime validation passed;
- deployable `dist/` was generated.

### Full validation chain

A fresh `npm run validate` passed every application check up to the database-only stage, including:

- Product Hub engine and universal search;
- replenishment projected-stock / MOQ / order-multiple logic;
- Product Command, Catalogue and Product 360 structure;
- Bundle Studio existing-SKU contract;
- new-product replenishment setup;
- Product Hub CSV/replenishment regression;
- Product Hub visual authority/responsive guard;
- Project 360 and close-out gates;
- Purchase Order Command;
- easy Warehouse booking-in;
- supplier returns;
- Warehouse FIFO allocation and controlled reallocation;
- Sales Order command/finder/list/detail/customer picker;
- runtime validation;
- CSS architecture;
- visual consistency, contrast and readability;
- Catalogue Health;
- legacy Bundle Studio and bundle sales intelligence;
- fulfilment lifecycle;
- PO catalogue performance and picker;
- production overhaul checks;
- receiving ledger;
- workspace/sync/ledger checks;
- accounting non-database checks.

The full command then stopped at `scripts/test-accounting-database.mjs` because `@electric-sql/pglite` is not installed in the extracted release environment.

All three database-only scripts explicitly import that missing dependency:

- `scripts/test-accounting-database.mjs`
- `scripts/test-workspace-database.mjs`
- `scripts/test-project-database.mjs`

The remaining non-database tests after that breakpoint were run separately on the same final code state and all passed:

- `scripts/test-accounting-api.mjs`
- `scripts/test-project-engine.mjs`
- `scripts/test-project-ai.mjs`
- `scripts/test-bundle-system-v2.mjs`
- `scripts/test-dashboard-review.mjs`
- `scripts/test-dashboard-command.mjs`
- `scripts/test-release-assets.mjs`

`test-release-assets.mjs` confirmed all 34 referenced assets exist and all public/server/API JavaScript parses.

## Verification limitation

This release must **not** be described as having a completely green full validation suite in this environment because the three PGlite-backed database tests could not start without the development-only package.

A normal deployed-browser acceptance pass is also not claimed. Previous local/file browser verification attempts in this environment were blocked by administrator Chromium policy and Playwright is not included in the extracted release.

Deployment acceptance should therefore include one real-browser pass of:

- Product Command;
- universal Catalogue search and quick-view drawer;
- Catalogue presets and responsive table widths;
- Product 360 tabs/edit/save;
- new-product setup including MOQ/replenishment fields;
- Product Groups;
- Bundle Studio component search/buildability;
- Replenishment filters, quantity edits and supplier-grouped Draft PO creation;
- bulk import/export of replenishment fields;
- service-worker upgrade from v1.10.0 to v1.11.0.

## Result

Pool Shed v1.11.0 turns Product Hub into the product-master authority for catalogue identity, supplier buying rules, Product Groups, existing-SKU bundles, fast product discovery and controlled replenishment, while preserving Inventory/Warehouse quantity truth and Purchasing PO authority.
