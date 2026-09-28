# Pool Shed Sales Order Safety Hotfix

## Implemented

- Sales Order list bulk `Update status` is now a controlled dropdown using configured Pool Shed statuses.
- Added bulk `Delete` with an explicit "Are you sure" confirmation.
- Sales Order deletion is blocked when allocations, Goods Notes/fulfilment, Sales Credits, invoices, payments, linked Purchase Orders or Projects exist.
- Sales Order line deletion now requires the line to be unallocated with no downstream fulfilment/accounting history, or fully covered by a completed Sales Credit.
- Fully credited stock lines may be removed while completed credit and fulfilment records remain intact; any stale allocation is released as part of the confirmed removal.
- Bundle removal now obeys the same Sales Order line safety guard so it cannot bypass allocation/credit requirements.
- Purchase Order line behaviour is intentionally unchanged.

No Supabase migration is required.
