-- Pool Shed 014 rollback: the live definitions captured on 20 Nov 2026 before 014.
begin;
CREATE OR REPLACE FUNCTION public.ps_workspace_save(w text, expected timestamp with time zone, snapshot jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare previous public.workspace_snapshots; stamp timestamptz; ledger text; item jsonb;
begin
 if not exists(select 1 from ps_workspace_members where workspace_id=w and user_id=auth.uid() and role in ('admin','operator')) then raise exception 'Workspace write access denied'; end if;
 -- Covers first insert as well as updates. All clients use the same lock.
 perform pg_advisory_xact_lock(hashtextextended(w,0));
 select * into previous from workspace_snapshots where workspace_id=w for update;
 if previous.workspace_id is not null and previous.updated_at is distinct from expected then return null; end if;
 if previous.workspace_id is null and expected is not null then return null; end if;
 if jsonb_typeof(snapshot)<>'object' or jsonb_typeof(snapshot->'stock') is distinct from 'array' then raise exception 'Invalid workspace data'; end if;
 for item in select value from jsonb_array_elements(snapshot->'stock') loop
  if jsonb_typeof(item->'qty') is distinct from 'number' or jsonb_typeof(item->'allocated') is distinct from 'number'
   or (item->>'qty')::numeric<0 or (item->>'allocated')::numeric<0 or (item->>'allocated')::numeric>(item->>'qty')::numeric then raise exception 'Invalid stock balance or reservation'; end if;
 end loop;
 foreach ledger in array array['receiptEvents','putawayTransfers'] loop
  if jsonb_typeof(coalesce(snapshot->ledger,'[]'::jsonb))<>'array' then raise exception 'Invalid ledger'; end if;
  if exists(select 1 from jsonb_array_elements(coalesce(previous.data->ledger,'[]'::jsonb)) old
   where not exists(select 1 from jsonb_array_elements(coalesce(snapshot->ledger,'[]'::jsonb)) current where current=old)) then raise exception 'Permanent receipt and transfer history cannot be changed or removed'; end if;
  if exists(select 1 from jsonb_array_elements(coalesce(snapshot->ledger,'[]'::jsonb)) e group by e->>'id' having count(*)>1) then raise exception 'Duplicate ledger event'; end if;
 end loop;
 stamp=greatest(clock_timestamp(),coalesce(previous.updated_at,'1970-01-01'::timestamptz)+interval '1 millisecond');
 if previous.workspace_id is not null then
  insert into ps_workspace_revisions(workspace_id,data,updated_by,updated_at) values(w,previous.data,previous.updated_by,previous.updated_at);
 end if;
 insert into workspace_snapshots(workspace_id,data,updated_by,updated_at) values(w,snapshot,auth.uid(),stamp)
 on conflict(workspace_id) do update set data=excluded.data,updated_by=excluded.updated_by,updated_at=excluded.updated_at;
 return jsonb_build_object('updated_at',stamp);
end $function$
;

CREATE OR REPLACE FUNCTION public.ps_quote_workspace_save(w text, actor uuid, expected timestamp with time zone, snapshot jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare previous public.workspace_snapshots; stamp timestamptz; item jsonb; ledger text;
begin
 perform pg_advisory_xact_lock(hashtextextended(w,0));
 select * into previous from workspace_snapshots where workspace_id=w for update;
 if previous.workspace_id is null then raise exception 'Workspace does not exist'; end if;
 if previous.updated_at is distinct from expected then return null; end if;
 if jsonb_typeof(snapshot)<>'object' or jsonb_typeof(snapshot->'stock') is distinct from 'array' then raise exception 'Invalid workspace data'; end if;
 for item in select value from jsonb_array_elements(snapshot->'stock') loop
  if jsonb_typeof(item->'qty') is distinct from 'number' or jsonb_typeof(item->'allocated') is distinct from 'number' or (item->>'qty')::numeric<0 or (item->>'allocated')::numeric<0 or (item->>'allocated')::numeric>(item->>'qty')::numeric then raise exception 'Invalid stock balance or reservation'; end if;
 end loop;
 foreach ledger in array array['receiptEvents','putawayTransfers'] loop
  if jsonb_typeof(coalesce(snapshot->ledger,'[]'::jsonb))<>'array' then raise exception 'Invalid ledger'; end if;
  if exists(select 1 from jsonb_array_elements(coalesce(previous.data->ledger,'[]'::jsonb)) old where not exists(select 1 from jsonb_array_elements(coalesce(snapshot->ledger,'[]'::jsonb)) current where current=old)) then raise exception 'Permanent receipt and transfer history cannot be changed or removed'; end if;
 end loop;
 stamp=greatest(clock_timestamp(),previous.updated_at+interval '1 millisecond');
 insert into ps_workspace_revisions(workspace_id,data,updated_by,updated_at) values(w,previous.data,previous.updated_by,previous.updated_at);
 update workspace_snapshots set data=snapshot,updated_by=actor,updated_at=stamp where workspace_id=w;
 return jsonb_build_object('updated_at',stamp);
end $function$
;

CREATE OR REPLACE FUNCTION public.ps_workspace_can_read(w text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
 select exists(select 1 from ps_workspace_members where workspace_id=w and user_id=auth.uid());
$function$
;
drop function if exists public.ps_workspace_validate(jsonb,jsonb,boolean);
drop function if exists public.ps_workspace_revisions_prune(text,boolean);
-- The revisions index is harmless and is kept. Pruned revisions are restored only from the Phase 0 backup.
commit;
