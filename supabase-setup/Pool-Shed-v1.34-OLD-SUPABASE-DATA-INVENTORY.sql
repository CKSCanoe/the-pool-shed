-- ============================================================
-- POOL SHED v1.34 - OLD SUPABASE DATA INVENTORY
-- READ ONLY. Run this in the OLD Supabase project before cutover.
-- It does not modify or delete anything.
-- ============================================================

select
  workspace_id,
  updated_at,
  updated_by,
  jsonb_array_length(coalesce(data->'products','[]'::jsonb)) as products,
  jsonb_array_length(coalesce(data->'customers','[]'::jsonb)) as customers,
  jsonb_array_length(coalesce(data->'suppliers','[]'::jsonb)) as suppliers,
  jsonb_array_length(coalesce(data->'salesOrders','[]'::jsonb)) as sales_orders,
  jsonb_array_length(coalesce(data->'purchaseOrders','[]'::jsonb)) as purchase_orders,
  jsonb_array_length(coalesce(data->'stock','[]'::jsonb)) as stock_rows,
  jsonb_array_length(coalesce(data->'jobs','[]'::jsonb)) as jobs_projects,
  jsonb_array_length(coalesce(data->'quotes','[]'::jsonb)) as workspace_quotes,
  jsonb_array_length(coalesce(data->'receiptEvents','[]'::jsonb)) as receipt_events,
  jsonb_array_length(coalesce(data->'putawayTransfers','[]'::jsonb)) as putaway_transfers
from public.workspace_snapshots
where workspace_id='pool-bros-main';

-- Optional: use the Supabase results download/export control on this second query
-- only when you are ready to produce the migration payload.
select workspace_id,data,updated_by,updated_at
from public.workspace_snapshots
where workspace_id='pool-bros-main';
