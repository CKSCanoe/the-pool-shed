-- Pool Shed v1.31.0 Quote Studio schema (compatible extension of v1.29 operational handover)
-- Pool Shed v1.29.0 Quote Studio secure publication, engagement and acceptance.
-- Run as database owner after 001-006. Public clients never receive direct table access.
begin;
create table if not exists public.ps_quote_publications (
 id uuid primary key,
 workspace_id text not null,
 quote_id text not null,
 version_number integer not null check(version_number>0),
 version_hash text not null,
 token_hash text not null unique,
 public_payload jsonb not null,
 commercial_payload jsonb not null,
 customer_state jsonb not null default '{}'::jsonb,
 published_by uuid not null references auth.users(id),
 recipient_name text,
 recipient_email text,
 permissions text not null default 'standard',
 status text not null default 'live' check(status in ('live','accepted','expired','revoked','superseded')),
 expires_at timestamptz,
 accepted_at timestamptz,
 created_at timestamptz not null default now(),
 unique(workspace_id,quote_id,version_number)
);
create table if not exists public.ps_quote_events (
 id bigint generated always as identity primary key,
 publication_id uuid not null references public.ps_quote_publications(id) on delete cascade,
 event_type text not null,
 detail jsonb not null default '{}'::jsonb,
 ip_hash text,
 user_agent_hash text,
 created_at timestamptz not null default now()
);
create table if not exists public.ps_quote_messages (
 id uuid primary key,
 publication_id uuid not null references public.ps_quote_publications(id) on delete cascade,
 section_id text,
 option_id text,
 body text not null,
 status text not null default 'open' check(status in ('open','resolved')),
 created_at timestamptz not null default now(),
 resolved_at timestamptz
);
create table if not exists public.ps_quote_acceptances (
 id uuid primary key,
 publication_id uuid not null unique references public.ps_quote_publications(id),
 quote_id text not null,
 version_number integer not null,
 signer text not null,
 terms_version text not null,
 selections jsonb not null default '{}'::jsonb,
 evidence jsonb not null default '{}'::jsonb,
 accepted_at timestamptz not null default now()
);
create index if not exists ps_quote_publications_workspace on public.ps_quote_publications(workspace_id,created_at desc);
create index if not exists ps_quote_events_publication on public.ps_quote_events(publication_id,created_at desc);
create index if not exists ps_quote_messages_publication on public.ps_quote_messages(publication_id,status,created_at desc);
alter table public.ps_quote_publications enable row level security;
alter table public.ps_quote_events enable row level security;
alter table public.ps_quote_messages enable row level security;
alter table public.ps_quote_acceptances enable row level security;
revoke all on public.ps_quote_publications,public.ps_quote_events,public.ps_quote_messages,public.ps_quote_acceptances from anon,authenticated;
grant all on public.ps_quote_publications,public.ps_quote_events,public.ps_quote_messages,public.ps_quote_acceptances to service_role;
grant usage,select on sequence public.ps_quote_events_id_seq to service_role;

-- Immutable published quote versions and acceptance evidence, regardless of which workspace writer is used.
create or replace function public.ps_quote_history_guard() returns trigger
language plpgsql set search_path=public as $$
declare old_quote jsonb; old_version jsonb; current_quote jsonb;
begin
 if old.data is null then return new; end if;
 for old_quote in select value from jsonb_array_elements(coalesce(old.data->'quotes','[]'::jsonb)) loop
  select value into current_quote from jsonb_array_elements(coalesce(new.data->'quotes','[]'::jsonb)) where value->>'id'=old_quote->>'id' limit 1;
  if current_quote is null and (jsonb_array_length(coalesce(old_quote->'versions','[]'::jsonb))>0 or old_quote->'acceptance' is not null) then raise exception 'Published or accepted quote history cannot be removed'; end if;
  if current_quote is not null then
   for old_version in select value from jsonb_array_elements(coalesce(old_quote->'versions','[]'::jsonb)) loop
    if coalesce(old_version->>'status','') in ('Published','Sent','Accepted') and not exists(select 1 from jsonb_array_elements(coalesce(current_quote->'versions','[]'::jsonb)) v where v=old_version) then raise exception 'Published quote versions are immutable'; end if;
   end loop;
   if old_quote->'acceptance' is not null and current_quote->'acceptance' is distinct from old_quote->'acceptance' then raise exception 'Accepted quote evidence is immutable'; end if;
  end if;
 end loop;
 return new;
end $$;
drop trigger if exists ps_quote_history_guard_trigger on public.workspace_snapshots;
create trigger ps_quote_history_guard_trigger before update on public.workspace_snapshots for each row execute function public.ps_quote_history_guard();

-- Service-role-only CAS writer used by public acceptance. It retains workspace revision and stock invariants.
create or replace function public.ps_quote_workspace_save(w text, actor uuid, expected timestamptz, snapshot jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
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
end $$;
revoke all on function public.ps_quote_workspace_save(text,uuid,timestamptz,jsonb) from public,anon,authenticated;
grant execute on function public.ps_quote_workspace_save(text,uuid,timestamptz,jsonb) to service_role;
commit;
