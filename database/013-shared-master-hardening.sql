-- Pool Shed 013 - Shared master hardening
-- Safe additive migration. Does not replace or reset workspace data.
begin;

-- Every active recognised staff profile belongs to the single Pool Bros workspace.
insert into public.ps_workspace_members(workspace_id,user_id,role)
select
  'pool-bros-main',
  p.id,
  case when p.role='Admin' then 'admin' else 'operator' end
from public.user_profiles p
where p.active=true
  and p.role in ('Admin','Management','Accounts','Sales','Purchasing','Warehouse','Engineer','Office')
on conflict(workspace_id,user_id) do update set role=excluded.role;

delete from public.ps_workspace_members wm
where wm.workspace_id='pool-bros-main'
  and not exists(
    select 1 from public.user_profiles p
    where p.id=wm.user_id
      and p.active=true
      and p.role in ('Admin','Management','Accounts','Sales','Purchasing','Warehouse','Engineer','Office')
  );

-- A workspace membership is only valid while the underlying Pool Shed profile is active.
create or replace function public.ps_workspace_can_read(w text) returns boolean
language sql stable security definer set search_path=public as $$
 select exists(
  select 1
  from public.ps_workspace_members wm
  join public.user_profiles p on p.id=wm.user_id
  where wm.workspace_id=w
    and wm.user_id=auth.uid()
    and p.active=true
    and p.role in ('Admin','Management','Accounts','Sales','Purchasing','Warehouse','Engineer','Office')
 );
$$;
revoke all on function public.ps_workspace_can_read(text) from public,anon;
grant execute on function public.ps_workspace_can_read(text) to authenticated;

-- Protect the whole-snapshot authority from malformed or catastrophic empty-array saves.
create or replace function public.ps_workspace_save(w text,expected timestamptz,snapshot jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
 previous public.workspace_snapshots;
 stamp timestamptz;
 ledger text;
 core_key text;
 item jsonb;
 old_count integer;
 new_count integer;
begin
 if not exists(
  select 1
  from ps_workspace_members wm
  join user_profiles p on p.id=wm.user_id
  where wm.workspace_id=w
    and wm.user_id=auth.uid()
    and wm.role in ('admin','operator')
    and p.active=true
 ) then raise exception 'Workspace write access denied'; end if;

 perform pg_advisory_xact_lock(hashtextextended(w,0));
 select * into previous from workspace_snapshots where workspace_id=w for update;

 if previous.workspace_id is not null and previous.updated_at is distinct from expected then return null; end if;
 if previous.workspace_id is null and expected is not null then return null; end if;
 if jsonb_typeof(snapshot)<>'object' then raise exception 'Invalid workspace data'; end if;

 foreach core_key in array array['jobs','salesOrders','purchaseOrders','customers','products','suppliers','stock','receiptEvents','putawayTransfers'] loop
  if jsonb_typeof(snapshot->core_key) is distinct from 'array' then
   raise exception 'Invalid workspace data: % must be an array',core_key;
  end if;
  if previous.workspace_id is not null then
   old_count=jsonb_array_length(coalesce(previous.data->core_key,'[]'::jsonb));
   new_count=jsonb_array_length(snapshot->core_key);
   if old_count>0 and new_count=0 then
    raise exception 'Safety lock: refusing to erase all % from the shared workspace',core_key;
   end if;
  end if;
 end loop;

 for item in select value from jsonb_array_elements(snapshot->'stock') loop
  if jsonb_typeof(item->'qty') is distinct from 'number'
    or jsonb_typeof(item->'allocated') is distinct from 'number'
    or (item->>'qty')::numeric<0
    or (item->>'allocated')::numeric<0
    or (item->>'allocated')::numeric>(item->>'qty')::numeric
  then raise exception 'Invalid stock balance or reservation'; end if;
 end loop;

 foreach ledger in array array['receiptEvents','putawayTransfers'] loop
  if exists(
   select 1 from jsonb_array_elements(coalesce(previous.data->ledger,'[]'::jsonb)) old
   where not exists(
    select 1 from jsonb_array_elements(snapshot->ledger) current where current=old
   )
  ) then raise exception 'Permanent receipt and transfer history cannot be changed or removed'; end if;
  if exists(
   select 1 from jsonb_array_elements(snapshot->ledger) e
   group by e->>'id' having count(*)>1
  ) then raise exception 'Duplicate ledger event'; end if;
 end loop;

 stamp=greatest(clock_timestamp(),coalesce(previous.updated_at,'1970-01-01'::timestamptz)+interval '1 millisecond');
 if previous.workspace_id is not null then
  insert into ps_workspace_revisions(workspace_id,data,updated_by,updated_at)
  values(w,previous.data,previous.updated_by,previous.updated_at);
 end if;

 insert into workspace_snapshots(workspace_id,data,updated_by,updated_at)
 values(w,snapshot,auth.uid(),stamp)
 on conflict(workspace_id) do update
 set data=excluded.data,updated_by=excluded.updated_by,updated_at=excluded.updated_at;

 return jsonb_build_object('updated_at',stamp);
end $$;
revoke all on function public.ps_workspace_save(text,timestamptz,jsonb) from public,anon;
grant execute on function public.ps_workspace_save(text,timestamptz,jsonb) to authenticated;

create index if not exists ps_workspace_revisions_workspace_updated
on public.ps_workspace_revisions(workspace_id,updated_at desc);

-- Realtime is an acceleration only; clients retain a polling fallback.
alter table public.workspace_snapshots replica identity full;
do $$
begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime')
    and not exists(
      select 1
      from pg_publication_tables
      where pubname='supabase_realtime'
        and schemaname='public'
        and tablename='workspace_snapshots'
    )
 then
  alter publication supabase_realtime add table public.workspace_snapshots;
 end if;
end $$;

commit;
