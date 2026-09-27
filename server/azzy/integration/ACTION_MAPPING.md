# Azzy action mapping

Azzy prepares actions. Pool Shed remains the executor.

| Azzy action | Pool Shed authority | Required re-check |
| --- | --- | --- |
| `draft_po` | Purchasing | supplier, SKU, quantity, cost, workspace revision |
| `draft_po_batch` | Procurement Demand / Purchasing | supplier grouping, demand source, price freshness, revision |
| `sales_order_allocation` | Warehouse / Inventory | physical free stock, existing allocations, order status |
| `stock_allocation` | Inventory | SKU, project, free stock |
| `project_extra` | Project commercial controls | project, cost, sell value, approval state |
| `internal_task` | My Work | assignee active, permission, linked record |
| `bill_review_batch` | Finance | bill identity/status only; never bank payment |
