# Pool Shed v1.38.0 Quote Studio Command Audit

## Release gates

- v1.38 Quote Studio authority test: PASS
- Design Lab parity: PASS
- acceptance automation: PASS
- Quote Media: PASS
- Product & CRM Media: PASS
- customer portal isolation: PASS
- Quick Quote workflow: PASS
- Project Proposal workflow: PASS
- My Work / Action Authority: PASS
- Warehouse regression: PASS
- Supplier Command regression: PASS
- Project 360 application logic: PASS
- Product Hub regression: PASS
- Finance Command regression: PASS
- Azzy readability/panel guards: PASS
- responsive workspace guard: PASS
- production build/runtime validation: PASS

## Browser QA

1920px Quote command header: PASS

1366px Quote command header: PASS

Commercial Control Centre: PASS

Build Quote live canvas width: 1060px

Settings permanent Quote Studio navigation: PASS

Pool Shed exit action: PASS

Customer portal per-quote theme: PASS

Customer portal fixed deposit rendering: PASS

Desktop customer portal: PASS

Mobile customer portal: PASS

Runtime JavaScript errors in Quote Studio browser QA: 0

Runtime JavaScript errors in customer portal browser QA: 0

## Environment limitation

The optional database-execution tests that import `@electric-sql/pglite` cannot run in this extracted environment because that development dependency is not installed. Application-level Project, Product Hub, Finance, Warehouse, Supplier and release tests were run separately and passed.
