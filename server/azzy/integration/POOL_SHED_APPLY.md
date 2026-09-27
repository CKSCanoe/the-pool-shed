# Apply finished Azzy to Pool Shed

Azzy is now packaged as an intelligence layer that can sit on the real Pool Shed workspace without creating a second operational database.

## 1. Keep Pool Shed as the authority

Do not replace or duplicate Pool Shed's existing:

- login/session authority;
- canonical workspace and Supabase save path;
- Product Hub and supplier-product catalogue;
- Inventory/Warehouse stock authority;
- Sales Orders and allocations;
- Purchase Orders, Procurement Demand and Goods-In;
- Projects/quotes/extras;
- Finance/Xero and supplier-bill controls;
- permissions, approvals and audit log.

Azzy reads those systems, reasons over them and prepares controlled actions. Pool Shed remains the executor.

## 2. Remove the superseded assistant, not the data bridges

Once the new assistant passes Preview acceptance testing, remove the old Azzy answer/router/render implementation so two assistants are not active behind the same launcher.

Keep Pool Shed's canonical browser contracts:

```js
window.__POOL_SHED_GET_DATA__()
window.__POOL_SHED_CAN_ACCESS__(moduleName)
```

The integration kit can reuse those for page context/read-only browser awareness, but **server-side permissions remain authoritative**.

## 3. Server-side live runtime

Use:

```text
integration/pool-shed-normalizer.js
integration/pool-shed-server-runtime.js
integration/POOL_SHED_API_EXAMPLE.mjs
```

The important rule is that the Pool Shed server must obtain these itself from the authenticated request:

```text
current user
permissions/role
canonical workspace snapshot
workspace revision
```

Do not accept `permissions`, `role` or an arbitrary workspace snapshot from an untrusted browser request.

Example:

```js
import { askAzzyFromPoolShed } from './integration/pool-shed-server-runtime.js';

const answer = await askAzzyFromPoolShed({
  workspace: canonicalWorkspace,
  user: authenticatedUser,
  permissions: serverDerivedPermissions,
  revision: workspaceRevision,
  message: body.message,
  context: body.context,
  contexts: body.contexts,
  actionExecutor: executeExistingPoolShedAction
});
```

The live snapshot is request-scoped. Multiple staff can use Azzy simultaneously without one user's workspace/user context replacing another's.

## 4. Page context

Use `integration/pool-shed-page-context.js` whenever the user opens or changes a record:

```js
import { setAzzyPageContext } from './integration/pool-shed-page-context.js';

setAzzyPageContext({
  type: 'project',
  id: project.id,
  name: project.name,
  page: 'Projects / Project Details / Costs'
});
```

Other examples:

```js
{ type:'sales_order', id:salesOrder.id }
{ type:'po', id:purchaseOrder.id }
{ type:'stock', id:product.sku }
{ type:'supplier', id:supplier.id }
{ type:'customer', id:customer.id }
{ type:'bill', id:bill.id }
{ type:'finance', id:'finance' }
```

Page context is only the immediate record. Azzy's `Talking about` working set can still contain up to five records for comparisons and follow-ups.

## 5. Replace standalone routes with Pool Shed routes

The standalone sandbox uses paths such as:

```text
/projects/:id
/purchase-orders/:id
/products/:sku
/sales-orders/:id
```

When embedding Azzy, map `recordHref(...)` to the real Pool Shed routes once. All conversational deep links then follow that one mapping.

## 6. Warehouse actions

Map:

```text
sales_order_allocation -> existing Warehouse/Inventory allocation authority
```

Before execution re-check:

```text
sales order status
current line quantities
current physical/free stock
existing allocations
workspace revision
current user's permission
```

Picking lists can use the existing Pool Shed print/document system. The standalone HTML print route is only a working reference renderer.

## 7. Procurement actions

Map:

```text
draft_po       -> existing Purchasing draft-PO authority
draft_po_batch -> Procurement Demand / grouped draft-PO authority
```

The proposal contains supplier, supplier SKU, quantity, demand source, price, carriage and recorded price date where available. Revalidate price and demand before creating the real draft PO.

Supplier comparison must use Pool Shed supplier-product equivalence. Exact and approved-equivalent products may be compared; ambiguous/unapproved matches should remain review-only.

## 8. Finance actions

Azzy can explain bills, duplicates, timing risks and three-way matching. It may prepare a review batch.

It must never call a bank-payment operation.

## 9. Action executor contract

Pass an executor to the server runtime:

```js
async function executeExistingPoolShedAction({ action, user }) {
  // Re-check permission + current workspace revision here.
  // Call the existing authoritative Pool Shed module.
  // Return only after the real module confirms success.
  return {
    ok: true,
    result: { id: 'real-record-id', status: 'created' }
  };
}
```

If no executor is configured, Azzy leaves an approved live action in `approved_pending_execution`. It never claims the operational write happened.

## 10. Local AI

The office Ollama service can remain the £0 conversational brain:

```bash
ollama pull qwen3:8b
AZZY_OLLAMA_MODEL="qwen3:8b" node server.js
```

Do not expose the raw Ollama port directly to the public internet. Staff should reach Azzy through Pool Shed's authenticated application/network boundary.

## 11. Role acceptance test

Test at least manager, operations, engineer and warehouse accounts.

Confirm that restricted data cannot leak through:

- normal answers;
- fuzzy/closest-match search;
- evidence drawer;
- `Talking about` context;
- direct links;
- alerts;
- action proposals.

## 12. Production sequence

1. Add the integration modules.
2. Wire server-authenticated workspace/user/permissions.
3. Map real record routes.
4. Run Azzy read-only in Preview.
5. Test all role boundaries.
6. Enable Warehouse allocation/picking actions.
7. Enable draft-PO actions.
8. Enable internal tasks/project extras as desired.
9. Keep finance review-only initially.
10. Switch the Pool Shed floating launcher to the new Azzy.
11. Delete the superseded old assistant runtime.
12. Run the full Pool Shed build/deployment/regression suite before Production.

## Acceptance prompts

```text
Hello Azzy
What do I need to order today?
Why do I need those quantities?
Create draft POs for everything urgent
Who is cheapest for 10 units of 1.5 inch pressure pipe?
Who is cheapest for 1.5 inch pipework?
Show supplier performance
Print the picking list for SO-...
Allocate available stock to SO-...
Match BILL-... to the PO and received goods
What should warehouse cycle count today?
What does the SDS say for PB-...?
Compare these two projects
What am I missing?
What changed today?
```
