-- Enable only after enrolling all authorised users and deploying secureWorkspaceWrites=true.
-- This replaces snapshot write policies; old clients will be unable to upload.
begin;
create table if not exists public.ps_workspace_members (
 workspace_id text not null,user_id uuid not null references auth.users(id),
 role text not null check(role in ('viewer','operator','admin')),primary key(workspace_id,user_id)
);
create table if not exists public.workspace_snapshots (
 workspace_id text primary key,data jsonb not null,updated_by uuid,updated_at timestamptz not null default now()
);
create table if not exists public.ps_workspace_revisions (
 id bigint generated always as identity primary key,workspace_id text not null,
 data jsonb not null,updated_by uuid,updated_at timestamptz not null
);
alter table public.ps_workspace_members enable row level security;
alter table public.workspace_snapshots enable row level security;
alter table public.ps_workspace_revisions enable row level security;
revoke all on public.ps_workspace_members,public.ps_workspace_revisions from anon,authenticated;
revoke all on public.workspace_snapshots from anon,authenticated;
grant select on public.workspace_snapshots to authenticated;
grant all on public.ps_workspace_members,public.ps_workspace_revisions to service_role;
grant usage,select on sequence public.ps_workspace_revisions_id_seq to service_role;
create or replace function public.ps_workspace_can_read(w text) returns boolean
language sql stable security definer set search_path=public as $$
 select exists(select 1 from ps_workspace_members where workspace_id=w and user_id=auth.uid());
$$;
revoke all on function public.ps_workspace_can_read(text) from public,anon;
grant execute on function public.ps_workspace_can_read(text) to authenticated;
do $$ declare p record; begin
 for p in select policyname from pg_policies where schemaname='public' and tablename='workspace_snapshots' loop
 execute format('drop policy %I on public.workspace_snapshots',p.policyname);
 end loop;
end $$;
create policy ps_workspace_member_read on public.workspace_snapshots for select to authenticated using(public.ps_workspace_can_read(workspace_id));
create or replace function public.ps_workspace_save(w text,expected timestamptz,snapshot jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
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
end $$;
revoke all on function public.ps_workspace_save(text,timestamptz,jsonb) from public,anon;
grant execute on function public.ps_workspace_save(text,timestamptz,jsonb) to authenticated;
commit;
