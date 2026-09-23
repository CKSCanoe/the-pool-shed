# Pool Shed v1.33.0 - Process & Quote Authority

> Current release: **v1.34.0 Product & CRM Media**. Product Hub and CRM now use private reusable Supabase media libraries, with Quote Studio inheritance.


Pool Shed is the Pool Bros operational system for CRM, Quotes, Sales Orders, Projects, Product Hub, Inventory, Purchasing, Warehouse, Fulfilment, Finance, Analytics, Automation and controlled administration.

## Quotes

Use **Quotes -> New quote** or **CRM -> Customer -> New quote**.

New quote setup is deliberately simple:
- customer
- quote/job name
- work type
- Quick Quote or Project Proposal
- optional starting template

Operational controls remain under **Advanced workflow** with safe defaults.

### Quick Quote

Accept -> Sales Order -> stock allocation -> supplier shortages / draft POs -> payment as configured.

A Project is optional.

### Project Proposal

Accept -> Project -> Sales Order -> stock / purchasing -> payment milestones -> project execution.

## Customer proposals

Customer proposals are separate from the internal Pool Shed UI. Customers receive only the presentation-safe published version.

Published and Sent are separate states. Only confirmed email-provider delivery marks a quote Sent.

## Acceptance safety

v1.33.0 writes the canonical customer acceptance atomically before attempting operational conversion. If conversion fails, acceptance remains valid and one idempotent conversion job can be retried by staff.

## Build and test

```bash
npm run test:quotes
npm run test:actions
npm run test:deployment
npm run build
```

`dist/` contains the deployable static application.

## Database migrations

Apply Quote Studio migrations in order:

1. `database/007-quote-studio.sql`
2. `database/008-quote-media.sql`
3. `database/009-quote-process-authority.sql`

Read `RELEASE-NOTES-1.33.0.md`, `PROCESS-AUTHORITY-AUDIT-1.33.0.md` and `DEPLOYMENT-GUIDE-1.33.0.md` before production promotion.
