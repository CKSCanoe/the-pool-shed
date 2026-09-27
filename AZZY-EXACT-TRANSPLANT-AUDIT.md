# Azzy Exact Transplant Audit

## Source of truth

- Pool Shed baseline: `Pool-Shed-1.45.1-Accessibility-Hardened.zip`
- Azzy visual/behavioural source: `azzy-poolshed-ready(1).zip`
- Integration guidance: `AZZY-START-HERE(1).md` and `AZZY-POOL-SHED-APPLY(1).md`

This release is a replacement, not a compatibility layer. Pool Shed remains the authority for authentication, permissions, canonical workspace data, Product Hub, Inventory/Warehouse, Sales Orders, Purchase Orders, Projects, Finance, approvals, audit and routing. The uploaded Azzy package is the authority for the assistant engine, UI and visual identity.

## Retired assistant removed

The following old front-facing assistant assets are physically absent from both source and built output:

- `public/assistant-engine.js`
- `public/azzy-live.js`
- `public/azzy-live.css`
- old floating assistant renderer/state
- old Ask / Find Anything / Guide Me / Training assistant UI
- preview-only assistant shell and read-only preview wording
- `PoolShedAssistantEngine`
- `PoolShedAzzyLive` compatibility alias

A recursive production scan over `public/`, `api/`, `server/` and `dist/` found no retired runtime identifiers or preview strings.

## Exact uploaded Azzy visual foundation

The uploaded `public/styles.css` is used as the Azzy visual authority. The only stylesheet transformation is:

- `:root` -> `:host{display:block;`

This is required because Azzy is mounted in an open Shadow DOM so Pool Shed global CSS cannot restyle or override the assistant. Every other byte of the uploaded stylesheet is retained.

Uploaded stylesheet SHA-256:
`9a741678d88b5c59a5ec24caed66cec6358b7665ea5e86159908544381b60079`

Shadow-DOM-scoped production stylesheet SHA-256:
`4720322244dcb3c0647a444419e787cd8ef96b4e78a849d3d659eca3d0bc52d3`

The final UI keeps the uploaded design language: dog launcher, red Azzy accent, rounded white panel, dark user bubbles, clean assistant bubbles, `Woof woof`, multi-record `Talking about`, Chat / Needs you / History, record links, actions and evidence.

## New single assistant runtime

Front end:

- `public/azzy-jarvis-host.js`
- `public/azzy-jarvis.css`
- `public/assets/img/azzy-jarvis.png`
- `public/assets/img/azzy-jarvis-64.png`
- `public/assets/img/azzy-jarvis-192.png`

Server/intelligence:

- `server/azzy/`
- `server/azzy-pool-shed.js`
- `api/azzy.js`

The production browser exposes only `window.PoolShedAzzyJarvis` as the assistant API.

## Pool Shed authority retained

Azzy does not create a shadow ERP. It receives the authenticated user's live, permission-filtered Pool Shed workspace for each request. Existing Pool Shed action authorities remain responsible for operational writes.

Prepared actions are permission checked and bounded. Purchasing, stock allocation, projects and finance each require their corresponding Pool Shed permissions. Financial review remains separate from payment execution.

## Capability regression

The uploaded Pool Shed-ready intelligence suite is now part of the normal Azzy/deployment checks. It covers:

- procurement demand from shortages/free stock/incoming stock/reorder floor
- exact/equivalent supplier-price comparison
- broad pipework comparison without mixing unlike fittings
- bin-sorted warehouse picking lists
- bounded Sales Order allocation
- grouped review-only draft Purchase Orders with carriage
- supplier performance
- three-way PO / receipt / invoice matching
- cycle-count prioritisation
- permission-filtered exception inbox
- chemical safety answers from stored Pool Shed documents only
- canonical workspace normalisation without source mutation
- user-scoped live snapshots and request-local runtime
- approved-action handoff to Pool Shed's action executor

Result: `15 passed, 0 failed`.

## Final verification

- `npm run test:azzy-ui` PASS
- `npm run build` PASS
- CSS architecture PASS
- visual consistency PASS
- contrast/text rhythm PASS
- colour contrast PASS
- readability hardening PASS
- release asset / JavaScript parse audit PASS (`65` referenced assets)
- retired runtime scan PASS

No test conversation/action memory is included in the packaged release.
