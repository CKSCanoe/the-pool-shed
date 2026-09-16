# Pool Shed v1.12.1 Transfer Guard Audit

## Change
Inventory van top-up transfers now preflight the complete requested quantity against eligible Warehouse free stock before any movement is attempted.

- Free stock means On Hand minus Allocated.
- If combined Warehouse free stock is below the requested transfer quantity, the transfer is blocked before any stock movement is written.
- No partial top-up is created in that insufficient-stock case.
- The shortage remains visible and can be routed to Product Hub Replenishment.
- The underlying shared `moveStockBetweenLocations` safeguard remains in force for each physical movement and still blocks allocated-stock breaches, negative stock and stock-count freezes.

## Verification
Fresh checks on the final source state:
- `node scripts/test-inventory-control-engine-v112.mjs` PASS, including the new insufficient-stock/no-partial-transfer regression.
- `node scripts/test-inventory-release-wiring-v112.mjs` PASS.
- `node scripts/test-inventory-connections-v112.mjs` PASS.
- `node scripts/test-warehouse-fifo-allocation-v180.mjs` PASS.
- `node scripts/test-warehouse-booking-v190.mjs` PASS.
- `npm run build` PASS.

This is a bounded safety patch over v1.12.0. No Product Hub, Project, PO or Warehouse allocation model was redesigned.
