# Analytics Command Design

## Decision
Analytics Command with Reports & Data Export is approved as Pool Shed's management analytics and reporting authority.

## Goal
Turn Pool Shed's operational records into governed metrics, management attention, drill-down analysis and permission-aware exports without creating a second source of truth.

## System authority
- Analytics reads canonical records from Sales, Projects, Purchasing, Supplier Command, Inventory, Warehouse, Fulfilment and Finance Command.
- Analytics does not create duplicate operational records.
- A metric is calculated once in the Analytics engine and reused by Overview, drill-down pages, reports and future Automation/Azzy.
- If Pool Shed does not contain enough source data to calculate a metric reliably, show a data-quality warning instead of inventing a value.
- All exports use the same canonical datasets and governed field definitions.

## Navigation
Overview; Business Performance; Sales; Projects; Operations; Purchasing & Suppliers; Inventory; Finance; Customers; Products; Metric Library; Reports & Data Export.

Reports & Data Export contains Report Builder; Saved Reports; Management Reports; Data Export Centre; All System Data; Export History.

## Overview
Overview is management-first. It shows Revenue, Gross Margin, Gross Profit, Quote Conversion when qualified data exists, Overdue Debt, Stock Value, Supplier On-Time and Project Margin at Risk. Management Attention explains what changed, why it matters, impact and the next action. KPI Watchlist, Business Pulse and driver analysis support the attention queue.

## Governed metric library
Each metric defines name, description, calculation, source modules, data-quality requirements and target/comparison rules. Core metrics include Revenue, Gross Profit, Gross Margin, Quote Conversion, Overdue Debt, Stock Value, Supplier On-Time, Project Margin at Risk, Invoice Ready Value, Aged Stock and Stock-Out Risk.

## Period and filters
Support 7D, 30D, MTD, QTD and YTD period presets with comparison to prior period, prior year or target where qualified. Location, supplier, customer, category/team and status filters can be applied where the underlying dataset supports them.

## Management attention
Every attention item contains severity, title, explanation, source/driver, impact and a direct action. Initial attention rules include margin deterioration, overdue customer debt, supplier delivery deterioration, aged stock, project margin risk, stock-out risk, invoice-ready value and reconciliation/sync exceptions.

## Reporting and exports
- Report Builder selects one or more governed datasets, fields, filters, grouping and date range.
- Saved Reports persist report definitions in `data.analyticsCommand.savedReports`.
- Management Reports create clean report-ready outputs using governed metrics and summaries.
- Data Export Centre supports current view, selected records, dataset export and admin-only full system export.
- All System Data catalogues every major canonical Pool Shed dataset and exposes Preview, Choose Fields, Filter and Download.
- CSV exports are first-class. Excel-compatible export is provided as an Excel workbook download where supported by the browser implementation.
- Full System Export produces a complete authorised JSON data package plus manifest metadata rather than scraping rendered HTML.
- Export History records who, when, dataset/report, format, filters and record count.

## Dataset catalogue
At minimum: Customers; Customer Invoices; Customer Payments; Sales Orders; Projects; Products; Suppliers; Purchase Orders; Supplier Bills; Inventory Stock; Stock Movements; Warehouse & Goods-In; Goods Notes; Supplier Returns; Customer Returns & Credits; Engineer Vans; Project Purchasing; Notes & Activity; Xero Links; Audit Events.

## Cross-system reports
Support governed joins for Customer -> Sales Order -> Invoice/Payment/Credit; Supplier -> Purchase Order -> Goods-In/Bill/Payment; Project -> Materials/POs/Invoices/Margin; Product -> Stock/Sales/Supplier Cost. Joins use stable Pool Shed IDs/Xero IDs, not display-name matching as primary identity.

## Permissions and audit
Full System Export is restricted to Admin. Sensitive datasets such as finance, margin and credit fields respect Analytics/Accounting permissions and export actions are audited in workspace data. Export screens show record count and scope before download.

## UX rules
- Preserve Pool Shed navy/slate/white visual authority with restrained teal.
- Dense, useful management screens rather than generic BI tiles.
- Every KPI, insight and exception is clickable where underlying records exist.
- Plain English copy. No dead buttons.
- Reports hold trend analysis so operational pages stay action-led.
- No em dashes in user-facing copy.

## Release and testing
Use TDD. Protect Finance Command, Supplier Command, Goods Note Control, Fulfilment, Inventory, Product Hub, Projects, Purchase Orders, Warehouse, Sales Orders, Dashboard and Accounting. Validate runtime assets, CSS authority, production build and archive integrity. Attempt browser smoke and report environmental limitations accurately.
