-- Pool Shed 034 — close the remaining direct access before staff get their real roles (with 020).
-- 1. ps_record_get: one record as this user may see it (same role rules as ps_workspace_load), so the app never needs
--    to read the raw workspace table. Used by the Pool Audit handover check.
-- 2. The tables from the first design (products, sales_orders, purchase_orders, suppliers, quotes …) are not used by
--    the app or the server: Pool Shed keeps its records in the workspace and ps_records. They are empty apart from a
--    few setting rows, yet any signed-in user could read and change them. Signed-in and anonymous access is removed.
--    Nothing is dropped and no row is changed; the service role (server code) keeps access.
-- user_profiles is in use and stays as 018 left it. workspace_snapshots is closed by 020 (apply 020 after the app
-- release that uses ps_record_get).
-- Rollback: see 034-rollback.sql.

create or replace function public.ps_record_get(w text, section text, record_id text)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare acc jsonb; item jsonb; ids text[]; restricted boolean;
begin
  if not ps_workspace_can_read(w) then raise exception 'Workspace read access denied'; end if;
  acc := ps_user_access();
  restricted := coalesce((acc->>'restricted')::boolean, false);
  if ps_section_hidden(section, acc) then return null; end if;
  select r.data into item from ps_records r
   where r.workspace_id = w and r.section = ps_record_get.section and r.key = 'id:' || record_id and r.deleted_at is null;
  if item is null then return null; end if;
  if restricted then
    ids := case when coalesce((acc->>'engineer')::boolean, false) then ps_engineer_job_ids(w, acc) else '{}' end;
    if not ps_record_visible(section, item, acc, ids) then return null; end if;
    item := ps_redact_item(section, item, acc, ids);
  end if;
  return jsonb_build_object('data', item, 'updated_at', (select updated_at from workspace_snapshots where workspace_id = w));
end $$;
revoke all on function public.ps_record_get(text,text,text) from public, anon;
grant execute on function public.ps_record_get(text,text,text) to authenticated;

do $$
declare t text;
begin
  foreach t in array array['activity_log','app_settings','attachments','customer_addresses','customers','document_sequences','entity_comments',
    'goods_out_note_items','goods_out_notes','location_restock_requirements','location_restock_rules','location_stock_values','locations',
    'notification_events','product_audit_events','product_batches','product_import_batches','product_import_changes','product_parents',
    'product_serials','product_variant_stock_summary','products','projects','purchase_order_items','purchase_orders','quote_items','quotes',
    'return_items','returns','sales_order_items','sales_order_margin_summary','sales_orders','stock_allocations','stock_balances',
    'stock_count_items','stock_counts','stock_movements','supplier_product_prices','suppliers','sync_audit','tasks'] loop
    if to_regclass('public.' || t) is not null then
      execute format('revoke all on public.%I from anon, authenticated', t);
    end if;
  end loop;
end $$;
