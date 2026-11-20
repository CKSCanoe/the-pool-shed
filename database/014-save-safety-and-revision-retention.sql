-- Pool Shed 014 - Save safety, fast ledger check and revision retention (Phase 2)
-- Supersedes 013 for live use. 013 was never applied to live (checked 20 Nov 2026).
-- Keeps 013's safety rules, but does NOT re-enable realtime on workspace_snapshots:
-- v1.48.0 removed the realtime subscription to stop Supabase egress.
-- Additive: no workspace data is changed. Only old duplicate revision copies are pruned,
-- and only by ps_workspace_revisions_prune (see the retention rule below).
-- Rollback: database/014-rollback.sql restores the previous function definitions.
begin;

-- 1. Membership follows the active staff profile (from 013).
insert into public.ps_workspace_members(workspace_id,user_id,role)
select 'pool-bros-main', p.id, case when p.role='Admin' then 'admin' else 'operator' end
from public.user_profiles p
where p.active=true
  and p.role in ('Admin','Management','Accounts','Sales','Purchasing','Warehouse','Engineer','Office')
on conflict(workspace_id,user_id) do update set role=excluded.role;

delete from public.ps_workspace_members wm
where wm.workspace_id='pool-bros-main'
  and not exists(
    select 1 from public.user_profiles p
    where p.id=wm.user_id and p.active=true
      and p.role in ('Admin','Management','Accounts','Sales','Purchasing','Warehouse','Engineer','Office'));

create or replace function public.ps_workspace_can_read(w text) returns boolean
language sql stable security definer set search_path=public as $$
 select exists(
  select 1 from public.ps_workspace_members wm
  join public.user_profiles p on p.id=wm.user_id
  where wm.workspace_id=w and wm.user_id=auth.uid() and p.active=true
    and p.role in ('Admin','Management','Accounts','Sales','Purchasing','Warehouse','Engineer','Office'));
$$;
revoke all on function public.ps_workspace_can_read(text) from public,anon;
grant execute on function public.ps_workspace_can_read(text) to authenticated;

-- 2. Shared validation used by both save paths.
-- Ledger rule: every previous receipt/transfer entry must still exist unchanged.
-- Old check compared every old entry with every new one (n x m jsonb equality, under the save lock).
-- New check: hash-join on md5 of each entry (n + m); exact jsonb equality only for the rare hash misses,
-- so the rule is exactly as strict as before.
create or replace function public.ps_workspace_validate(previous jsonb, snapshot jsonb, check_duplicates boolean)
returns void language plpgsql stable set search_path=public as $$
declare
 core_key text; ledger text; item jsonb; old_count integer; new_count integer;
begin
 if jsonb_typeof(snapshot)<>'object' then raise exception 'Invalid workspace data'; end if;

 foreach core_key in array array['jobs','salesOrders','purchaseOrders','customers','products','suppliers','stock','receiptEvents','putawayTransfers'] loop
  if jsonb_typeof(snapshot->core_key) is distinct from 'array' then
   raise exception 'Invalid workspace data: % must be an array',core_key;
  end if;
  if previous is not null then
   old_count=jsonb_array_length(coalesce(previous->core_key,'[]'::jsonb));
   new_count=jsonb_array_length(snapshot->core_key);
   -- Small lists (e.g. the last 1-2 jobs) may legitimately be cleared; wiping an established list may not.
   if old_count>=3 and new_count=0 then
    raise exception 'Safety lock: refusing to erase all % from the shared workspace',core_key;
   end if;
  end if;
 end loop;

 for item in select value from jsonb_array_elements(snapshot->'stock') loop
  if jsonb_typeof(item->'qty') is distinct from 'number'
    or jsonb_typeof(item->'allocated') is distinct from 'number'
    or (item->>'qty')::numeric<0 or (item->>'allocated')::numeric<0
    or (item->>'allocated')::numeric>(item->>'qty')::numeric
  then raise exception 'Invalid stock balance or reservation'; end if;
 end loop;

 foreach ledger in array array['receiptEvents','putawayTransfers'] loop
  if exists(
   with old_e as (select e, md5(e::text) h from jsonb_array_elements(coalesce(previous->ledger,'[]'::jsonb)) e),
        new_e as (select e, md5(e::text) h from jsonb_array_elements(snapshot->ledger) e),
        missing as (select o.e from old_e o where not exists(select 1 from new_e n where n.h=o.h))
   select 1 from missing m
   where not exists(select 1 from jsonb_array_elements(snapshot->ledger) c where c=m.e)
  ) then raise exception 'Permanent receipt and transfer history cannot be changed or removed'; end if;
  if check_duplicates and exists(
   select 1 from jsonb_array_elements(snapshot->ledger) e group by e->>'id' having count(*)>1
  ) then raise exception 'Duplicate ledger event'; end if;
 end loop;
end $$;
revoke all on function public.ps_workspace_validate(jsonb,jsonb,boolean) from public,anon,authenticated;

-- 3. Revision retention.
-- Keep: the newest 20 copies always; every copy from the last 7 days;
-- the newest copy of each day for 7-90 days; the newest copy of each month after that.
-- Phase 0 exported a full backup (pg_dump, 19 Nov 2026) before any pruning.
create or replace function public.ps_workspace_revisions_prune(w text, dry_run boolean default false)
returns jsonb language plpgsql security definer set search_path=public as $$
declare removed integer; kept integer;
begin
 create temp table if not exists ps_prune_ids(id bigint) on commit drop;
 truncate ps_prune_ids;
 insert into ps_prune_ids
 select id from (
  select id, updated_at,
   row_number() over (order by updated_at desc) newest_rank,
   row_number() over (partition by date_trunc('day',updated_at) order by updated_at desc) day_rank,
   row_number() over (partition by date_trunc('month',updated_at) order by updated_at desc) month_rank
  from ps_workspace_revisions where workspace_id=w
 ) r
 where newest_rank>20
   and updated_at < now()-interval '7 days'
   and not (updated_at >= now()-interval '90 days' and day_rank=1)
   and not (updated_at <  now()-interval '90 days' and month_rank=1);
 select count(*) into removed from ps_prune_ids;
 select count(*)-removed into kept from ps_workspace_revisions where workspace_id=w;
 if not dry_run then
  delete from ps_workspace_revisions where id in (select id from ps_prune_ids);
 end if;
 return jsonb_build_object('removed',removed,'kept',kept,'dry_run',dry_run);
end $$;
revoke all on function public.ps_workspace_revisions_prune(text,boolean) from public,anon,authenticated;
grant execute on function public.ps_workspace_revisions_prune(text,boolean) to service_role;

create index if not exists ps_workspace_revisions_workspace_updated
on public.ps_workspace_revisions(workspace_id,updated_at desc);

-- 4. Staff save path.
create or replace function public.ps_workspace_save(w text,expected timestamptz,snapshot jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
 previous public.workspace_snapshots;
 stamp timestamptz;
 last_revision timestamptz;
begin
 if not exists(
  select 1 from ps_workspace_members wm join user_profiles p on p.id=wm.user_id
  where wm.workspace_id=w and wm.user_id=auth.uid() and wm.role in ('admin','operator') and p.active=true
 ) then raise exception 'Workspace write access denied'; end if;

 perform pg_advisory_xact_lock(hashtextextended(w,0));
 select * into previous from workspace_snapshots where workspace_id=w for update;
 if previous.workspace_id is not null and previous.updated_at is distinct from expected then return null; end if;
 if previous.workspace_id is null and expected is not null then return null; end if;

 perform ps_workspace_validate(previous.data, snapshot, true);

 stamp=greatest(clock_timestamp(),coalesce(previous.updated_at,'1970-01-01'::timestamptz)+interval '1 millisecond');
 if previous.workspace_id is not null then
  select max(updated_at) into last_revision from ps_workspace_revisions where workspace_id=w;
  insert into ps_workspace_revisions(workspace_id,data,updated_by,updated_at)
  values(w,previous.data,previous.updated_by,previous.updated_at);
  -- First save of a new day tidies old copies (small and quick after the first run).
  if last_revision is null or date_trunc('day',last_revision)<date_trunc('day',now()) then
   perform ps_workspace_revisions_prune(w,false);
  end if;
 end if;

 insert into workspace_snapshots(workspace_id,data,updated_by,updated_at)
 values(w,snapshot,auth.uid(),stamp)
 on conflict(workspace_id) do update
 set data=excluded.data,updated_by=excluded.updated_by,updated_at=excluded.updated_at;

 return jsonb_build_object('updated_at',stamp);
end $$;
revoke all on function public.ps_workspace_save(text,timestamptz,jsonb) from public,anon;
grant execute on function public.ps_workspace_save(text,timestamptz,jsonb) to authenticated;

-- 5. Quote Studio server save path (service role only), same validation.
-- Duplicate-id check stays off here, matching the existing quote path.
create or replace function public.ps_quote_workspace_save(w text,actor uuid,expected timestamptz,snapshot jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare previous public.workspace_snapshots; stamp timestamptz;
begin
 perform pg_advisory_xact_lock(hashtextextended(w,0));
 select * into previous from workspace_snapshots where workspace_id=w for update;
 if previous.workspace_id is null then raise exception 'Workspace does not exist'; end if;
 if previous.updated_at is distinct from expected then return null; end if;

 perform ps_workspace_validate(previous.data, snapshot, false);

 stamp=greatest(clock_timestamp(),previous.updated_at+interval '1 millisecond');
 insert into ps_workspace_revisions(workspace_id,data,updated_by,updated_at)
 values(w,previous.data,previous.updated_by,previous.updated_at);
 update workspace_snapshots set data=snapshot,updated_by=actor,updated_at=stamp where workspace_id=w;
 return jsonb_build_object('updated_at',stamp);
end $$;

commit;
