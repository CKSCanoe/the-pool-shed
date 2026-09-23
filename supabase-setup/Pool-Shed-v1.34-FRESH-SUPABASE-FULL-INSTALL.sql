-- ============================================================
-- POOL SHED v1.34.0 - FRESH SUPABASE FULL INSTALL
-- ============================================================
-- Use this on a NEW / EMPTY Supabase project.
-- Recommended approach: keep the old Supabase project untouched until the
-- new project has passed Vercel Preview testing and any existing Pool Shed
-- workspace data has been migrated.
--
-- THIS SCRIPT DOES NOT CREATE AUTH USERS.
-- After this script, create the first staff user in Supabase Auth and run:
--   Pool-Shed-v1.34-ENROL-FIRST-ADMIN.sql
--
-- CURRENT DATA AUTHORITY
-- Operational Products, Customers, Suppliers, Sales Orders, Purchase Orders,
-- Stock and Projects are stored in the protected Pool Shed workspace snapshot.
-- This installer intentionally does not recreate the older duplicate relational
-- prototype tables for those records.
--
-- INSTALL ORDER
--   000 Core Auth/Profile Foundation
--   001 Finance/Xero authority
--   002 Secure workspace authority
--   003 Project documents
--   004 Project billing authority
--   005 Project AI authority
--   006 Project history protection
--   007 Quote Studio
--   008 Secure Quote Media
--   009 Quote Process Authority
--   010 Product Hub + CRM Secure Media
-- ============================================================

create extension if not exists pgcrypto;

-- ============================================================
-- 000 - CORE AUTH / PROFILE FOUNDATION
-- ============================================================
begin;

create or replace function public.ps_set_updated_at()
returns trigger
language plpgsql
set search_path=public
as $$
begin
  new.updated_at=now();
  return new;
end
$$;

create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text not null default '',
  role text not null default 'Engineer'
    check(role in ('Admin','Management','Accounts','Sales','Purchasing','Warehouse','Engineer','Office')),
  job_title text,
  phone text,
  avatar_url text,
  notes text,
  permissions jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists ps_user_profiles_set_updated_at on public.user_profiles;
create trigger ps_user_profiles_set_updated_at
before update on public.user_profiles
for each row execute function public.ps_set_updated_at();

create or replace function public.ps_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  insert into public.user_profiles(id,full_name,email,role)
  values(
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'full_name',''),nullif(new.raw_user_meta_data->>'name',''),''),
    coalesce(new.email,''),
    'Engineer'
  )
  on conflict(id) do nothing;
  return new;
end
$$;

drop trigger if exists ps_on_auth_user_created on auth.users;
create trigger ps_on_auth_user_created
after insert on auth.users
for each row execute function public.ps_handle_new_user();

create or replace function public.ps_profile_is_admin()
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select exists(
    select 1 from public.user_profiles
    where id=auth.uid() and active=true and role='Admin'
  );
$$;

alter table public.user_profiles enable row level security;
revoke all on public.user_profiles from anon,authenticated;
grant select,insert,update on public.user_profiles to authenticated;
grant all on public.user_profiles to service_role;

drop policy if exists ps_profiles_read on public.user_profiles;
drop policy if exists ps_profiles_admin_insert on public.user_profiles;
drop policy if exists ps_profiles_admin_update on public.user_profiles;

create policy ps_profiles_read
on public.user_profiles for select to authenticated
using(id=auth.uid() or public.ps_profile_is_admin());

create policy ps_profiles_admin_insert
on public.user_profiles for insert to authenticated
with check(public.ps_profile_is_admin());

create policy ps_profiles_admin_update
on public.user_profiles for update to authenticated
using(public.ps_profile_is_admin())
with check(public.ps_profile_is_admin());

revoke all on function public.ps_profile_is_admin() from public,anon;
grant execute on function public.ps_profile_is_admin() to authenticated;

commit;


-- ============================================================
-- BEGIN 001-accounting.sql
-- ============================================================
-- Run as database owner. Service role is restricted to the server runtime.
begin;
create table if not exists public.ps_finance_members (
 workspace_id text not null, user_id uuid not null references auth.users(id),
 role text not null check(role in ('viewer','accountant','admin')), primary key(workspace_id,user_id)
);
create table if not exists public.ps_finance_connections (
 workspace_id text primary key, tokens text not null, tenant_id uuid, tenant_name text,
 lease_id uuid, lease_until timestamptz, last_sync timestamptz, last_error text,
 updated_at timestamptz not null default now()
);
create table if not exists public.ps_finance_oauth (
 state_hash text primary key, workspace_id text not null, user_id uuid not null,
 expires_at timestamptz not null
);
create table if not exists public.ps_finance_documents (
 id uuid primary key, workspace_id text not null, source_id text not null,
 kind text not null check(kind in ('ACCREC','ACCPAY')), payload jsonb not null,
 xero_id uuid, xero_number text, status text not null default 'QUEUED',
 amount_due numeric, amount_paid numeric, amount_credited numeric, currency text,
 remote jsonb, checked_at timestamptz, created_by uuid not null, created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(), unique(workspace_id,kind,source_id), unique(workspace_id,xero_id)
);
create table if not exists public.ps_finance_jobs (
 id uuid primary key, workspace_id text not null, document_id uuid references public.ps_finance_documents(id),
 state text not null default 'pending' check(state in ('pending','done','review')),
 attempts integer not null default 0, failures integer not null default 0, next_attempt timestamptz not null default now(),
 last_error text, created_at timestamptz not null default now(), unique(document_id)
);
create table if not exists public.ps_finance_inbox (
 digest text primary key, payload jsonb not null, received_at timestamptz not null default now()
);
create table if not exists public.ps_finance_audit (
 id bigint generated always as identity primary key, workspace_id text not null,
 actor text not null, action text not null, detail jsonb not null, created_at timestamptz not null default now()
);
create index if not exists ps_jobs_due on public.ps_finance_jobs(workspace_id,next_attempt) where state='pending';
create index if not exists ps_documents_workspace on public.ps_finance_documents(workspace_id,created_at desc);
-- No browser access, including reads of encrypted tokens. Access only via authenticated API.
alter table public.ps_finance_members enable row level security;
alter table public.ps_finance_connections enable row level security;
alter table public.ps_finance_oauth enable row level security;
alter table public.ps_finance_documents enable row level security;
alter table public.ps_finance_jobs enable row level security;
alter table public.ps_finance_inbox enable row level security;
alter table public.ps_finance_audit enable row level security;
revoke all on public.ps_finance_members,public.ps_finance_connections,public.ps_finance_oauth,public.ps_finance_documents,public.ps_finance_jobs,public.ps_finance_inbox,public.ps_finance_audit from anon,authenticated;
create or replace function public.ps_finance_lock(w text, token uuid) returns boolean
language plpgsql security definer set search_path=public as $$
begin
 update ps_finance_connections set lease_id=token,lease_until=now()+interval '3 minutes'
 where workspace_id=w and (lease_until is null or lease_until<now());
 return found;
end $$;
create or replace function public.ps_finance_enqueue(w text, actor uuid, doc uuid, source text, kind_value text, invoice jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare existing uuid;
begin
 if not exists(select 1 from ps_finance_members where workspace_id=w and user_id=actor and role in ('admin','accountant')) then raise exception 'Access denied'; end if;
 insert into ps_finance_documents(id,workspace_id,source_id,kind,payload,created_by)
 values(doc,w,source,kind_value,invoice,actor) on conflict(workspace_id,kind,source_id) do nothing;
 select id into existing from ps_finance_documents where workspace_id=w and source_id=source and kind=kind_value;
 insert into ps_finance_jobs(id,workspace_id,document_id) values(existing,w,existing) on conflict(document_id) do nothing;
 insert into ps_finance_audit(workspace_id,actor,action,detail) values(w,actor::text,'queue_requested',jsonb_build_object('document',existing));
 return existing;
end $$;
revoke all on function public.ps_finance_lock(text,uuid),public.ps_finance_enqueue(text,uuid,uuid,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.ps_finance_lock(text,uuid),public.ps_finance_enqueue(text,uuid,uuid,text,text,jsonb) to service_role;
-- Webhook durability and prioritisation are atomic. Only linked documents are affected.
create or replace function public.ps_finance_webhook(d text, envelope jsonb) returns boolean
language plpgsql security definer set search_path=public as $$
begin
 insert into ps_finance_inbox(digest,payload) values(d,envelope) on conflict do nothing;
 if not found then return false; end if;
 update ps_finance_documents f set checked_at=null
 from ps_finance_connections c, jsonb_array_elements(envelope->'events') e
 where c.workspace_id=f.workspace_id and c.tenant_id::text=e->>'tenantId'
 and f.xero_id::text=e->>'resourceId' and e->>'eventCategory'='INVOICE';
 return true;
end $$;
revoke all on function public.ps_finance_webhook(text,jsonb) from public,anon,authenticated;
grant execute on function public.ps_finance_webhook(text,jsonb) to service_role;
grant all on public.ps_finance_members,public.ps_finance_connections,public.ps_finance_oauth,public.ps_finance_documents,public.ps_finance_jobs,public.ps_finance_inbox,public.ps_finance_audit to service_role;
grant usage,select on sequence public.ps_finance_audit_id_seq to service_role;

commit;

-- ============================================================
-- END 001-accounting.sql
-- ============================================================


-- ============================================================
-- BEGIN 002-workspace-hardening.sql
-- ============================================================
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

-- ============================================================
-- END 002-workspace-hardening.sql
-- ============================================================


-- ============================================================
-- BEGIN 003-project-documents.sql
-- ============================================================
-- Requires 002-workspace-hardening.sql and enrolled project users.
begin;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('project-documents','project-documents',false,10485760,array['application/pdf','image/png','image/jpeg'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create or replace function public.ps_project_can_write(w text) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from ps_workspace_members where workspace_id=w and user_id=auth.uid() and role in ('admin','operator'));
$$;
revoke all on function public.ps_project_can_write(text) from public,anon;
grant execute on function public.ps_project_can_write(text) to authenticated;
drop policy if exists ps_project_document_read on storage.objects;
drop policy if exists ps_project_document_insert on storage.objects;
create policy ps_project_document_read on storage.objects for select to authenticated using(bucket_id='project-documents' and ps_workspace_can_read((storage.foldername(name))[1]));
create policy ps_project_document_insert on storage.objects for insert to authenticated with check(bucket_id='project-documents' and ps_project_can_write((storage.foldername(name))[1]));
-- No browser UPDATE or DELETE policies: project evidence is append-only.
commit;

-- ============================================================
-- END 003-project-documents.sql
-- ============================================================


-- ============================================================
-- BEGIN 004-project-billing.sql
-- ============================================================
-- Requires 001 and 002. All invoice queues use the same lock and project cap rules.
begin;
create or replace function public.ps_finance_enqueue(w text, actor uuid, doc uuid, source text, kind_value text, invoice jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare existing uuid; snapshot jsonb; project_job jsonb; project jsonb; phase jsonb; linked_order jsonb;
 contract numeric; requested numeric; reserved numeric; planned numeric;
begin
 if not exists(select 1 from ps_finance_members where workspace_id=w and user_id=actor and role in ('admin','accountant')) then raise exception 'Access denied'; end if;
 perform pg_advisory_xact_lock(hashtextextended(w||':finance',0));
 select id into existing from ps_finance_documents where workspace_id=w and source_id=source and kind=kind_value;
 if existing is not null then return existing; end if;
 select data into snapshot from workspace_snapshots where workspace_id=w;
 if source like 'PROJECT:%' then
  select j into project_job from jsonb_array_elements(coalesce(snapshot->'jobs','[]'::jsonb)) j
   where exists(select 1 from jsonb_array_elements(coalesce(j->'project'->'phases','[]'::jsonb)) ph where source='PROJECT:'||(j->>'id')||':'||(ph->>'id'));
  if project_job is null or kind_value<>'ACCREC' then raise exception 'Project stage not found in shared workspace'; end if;
  project=project_job->'project';
  select ph into phase from jsonb_array_elements(project->'phases') ph where source='PROJECT:'||(project_job->>'id')||':'||(ph->>'id');
  if coalesce((project->>'quoteAccepted')::boolean,false)=false or coalesce((phase->>'ready')::boolean,false)=false or coalesce(phase->>'agreement','')='' then raise exception 'Accepted quote and agreed completed stage required'; end if;
  if exists(select 1 from jsonb_array_elements(coalesce(project->'tasks','[]'::jsonb)) t where t->>'phaseId'=phase->>'id' and t->>'status'<>'Done') then raise exception 'Stage tasks remain incomplete'; end if;
  if coalesce(phase->>'dependencyId','')<>'' and not exists(select 1 from jsonb_array_elements(project->'phases') p where p->>'id'=phase->>'dependencyId' and (p->>'ready')::boolean) then raise exception 'Preceding stage is incomplete'; end if;
  contract=round((project->>'quoteNet')::numeric*100);
  select contract+coalesce(sum(round((v->>'sellNet')::numeric*100)),0) into contract from jsonb_array_elements(coalesce(project->'variations','[]'::jsonb)) v where v->>'status'='Approved';
  select coalesce(sum(round((ph->>'amountNet')::numeric*100)),0) into planned from jsonb_array_elements(project->'phases') ph;
  select sum(round((l->>'Quantity')::numeric*(l->>'UnitAmount')::numeric*100)) into requested from jsonb_array_elements(invoice->'LineItems') l;
  if requested is null or requested<=0 or requested<>round((phase->>'amountNet')::numeric*100) or planned>contract or invoice->>'CurrencyCode'<>'GBP' then raise exception 'Invoice amount differs from agreed project stage'; end if;
  if exists(select 1 from ps_finance_documents d,jsonb_array_elements(coalesce(snapshot->'salesOrders','[]'::jsonb)) o where d.workspace_id=w and d.kind='ACCREC' and d.source_id=o->>'id' and o->>'jobId'=project_job->>'id' and d.status not in ('VOIDED','DELETED')) then raise exception 'A linked order already has an invoice. Reconcile existing billing before phase billing'; end if;
  select coalesce(sum(round((l->>'Quantity')::numeric*(l->>'UnitAmount')::numeric*100)),0) into reserved
   from ps_finance_documents d cross join lateral jsonb_array_elements(d.payload->'LineItems') l
   where d.workspace_id=w and d.kind='ACCREC' and d.status not in ('VOIDED','DELETED') and starts_with(d.source_id,'PROJECT:'||(project_job->>'id')||':');
  if reserved+requested>contract then raise exception 'Project billing would exceed the agreed contract'; end if;
 else
  select o into linked_order from jsonb_array_elements(coalesce(snapshot->'salesOrders','[]'::jsonb)) o where o->>'id'=source;
  if kind_value='ACCREC' and exists(select 1 from jsonb_array_elements(coalesce(snapshot->'jobs','[]'::jsonb)) j where j->>'id'=linked_order->>'jobId' and j->'project'->>'billingMode'='phases') then raise exception 'Use project phase billing for this order'; end if;
 end if;
 insert into ps_finance_documents(id,workspace_id,source_id,kind,payload,created_by) values(doc,w,source,kind_value,invoice,actor);
 insert into ps_finance_jobs(id,workspace_id,document_id) values(doc,w,doc);
 insert into ps_finance_audit(workspace_id,actor,action,detail) values(w,actor::text,'queue_requested',jsonb_build_object('document',doc,'source',source));
 return doc;
end $$;
revoke all on function public.ps_finance_enqueue(text,uuid,uuid,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.ps_finance_enqueue(text,uuid,uuid,text,text,jsonb) to service_role;
commit;

-- ============================================================
-- END 004-project-billing.sql
-- ============================================================


-- ============================================================
-- BEGIN 005-project-ai.sql
-- ============================================================
begin;
create table if not exists public.ps_project_ai_requests(workspace_id text not null,user_id uuid not null,requested_at timestamptz not null,primary key(workspace_id,user_id));
alter table public.ps_project_ai_requests enable row level security;
revoke all on public.ps_project_ai_requests from anon,authenticated;
grant all on public.ps_project_ai_requests to service_role;
create or replace function public.ps_project_ai_claim(w text,u uuid) returns boolean language plpgsql security definer set search_path=public as $$
begin
 insert into ps_project_ai_requests values(w,u,now()) on conflict(workspace_id,user_id) do update set requested_at=excluded.requested_at where ps_project_ai_requests.requested_at<now()-interval '1 minute';
 return found;
end $$;
revoke all on function public.ps_project_ai_claim(text,uuid) from public,anon,authenticated;
grant execute on function public.ps_project_ai_claim(text,uuid) to service_role;
commit;

-- ============================================================
-- END 005-project-ai.sql
-- ============================================================


-- ============================================================
-- BEGIN 006-project-history.sql
-- ============================================================
begin;
create or replace function public.ps_project_history_guard() returns trigger language plpgsql security definer set search_path=public as $$
declare old_job jsonb; new_job jsonb; old_item jsonb; new_item jsonb;
begin
 for old_job in select value from jsonb_array_elements(coalesce(old.data->'jobs','[]'::jsonb)) where value ? 'project' loop
  select j into new_job from jsonb_array_elements(coalesce(new.data->'jobs','[]'::jsonb)) j where j->>'id'=old_job->>'id';
  if coalesce((old_job->'project'->>'quoteAccepted')::boolean,false) then
   if new_job is null or new_job->'project'->>'quoteAccepted' is distinct from 'true' or (new_job->'project'->>'quoteNet')::numeric is distinct from (old_job->'project'->>'quoteNet')::numeric then raise exception 'Accepted project quote is immutable; use an approved variation'; end if;
  end if;
  for old_item in select value from jsonb_array_elements(coalesce(old_job->'project'->'variations','[]'::jsonb)) where value->>'status'='Approved' loop
   if not exists(select 1 from jsonb_array_elements(coalesce(new_job->'project'->'variations','[]'::jsonb)) v where v=old_item) then raise exception 'Approved extra history must be retained'; end if;
  end loop;
  for old_item in select value from jsonb_array_elements(coalesce(old_job->'project'->'costs','[]'::jsonb)) loop
   select c into new_item from jsonb_array_elements(coalesce(new_job->'project'->'costs','[]'::jsonb)) c where c->>'id'=old_item->>'id';
   if new_item is null or (new_item-'voidedAt'-'voidReason') is distinct from (old_item-'voidedAt'-'voidReason') or (old_item ? 'voidedAt' and new_item is distinct from old_item) then raise exception 'Cost history must be retained; record a reasoned correction'; end if;
   if new_item ? 'voidedAt' and coalesce(new_item->>'voidReason','')='' then raise exception 'Cost correction reason required'; end if;
  end loop;
  for old_item in select value from jsonb_array_elements(coalesce(old_job->'project'->'phases','[]'::jsonb)) loop
   if exists(select 1 from ps_finance_documents where workspace_id=old.workspace_id and source_id='PROJECT:'||(old_job->>'id')||':'||(old_item->>'id')) then
    select ph into new_item from jsonb_array_elements(coalesce(new_job->'project'->'phases','[]'::jsonb)) ph where ph->>'id'=old_item->>'id';
    if new_item is null or (new_item-'invoiceRequested'-'financeDocumentId') is distinct from (old_item-'invoiceRequested'-'financeDocumentId') then raise exception 'Queued invoice stage must remain unchanged'; end if;
   end if;
  end loop;
 end loop;
 return new;
end $$;
revoke all on function public.ps_project_history_guard() from public,anon,authenticated;
drop trigger if exists ps_project_history on public.workspace_snapshots;
create trigger ps_project_history before update of data on public.workspace_snapshots for each row execute function public.ps_project_history_guard();
commit;

-- ============================================================
-- END 006-project-history.sql
-- ============================================================


-- ============================================================
-- BEGIN 007-quote-studio.sql
-- ============================================================
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

-- ============================================================
-- END 007-quote-studio.sql
-- ============================================================


-- ============================================================
-- BEGIN 008-quote-media.sql
-- ============================================================
-- Pool Shed v1.32.1 private Quote Media storage and metadata.
-- Run after 007-quote-studio.sql. All media access is mediated by service-role API functions.
begin;

create table if not exists public.ps_quote_media (
  id uuid primary key,
  workspace_id text not null,
  quote_id text not null,
  storage_path text not null unique,
  file_name text not null,
  mime_type text not null check (mime_type in ('image/jpeg','image/png','image/webp','application/pdf')),
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 12582912),
  uploaded_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists ps_quote_media_workspace_quote on public.ps_quote_media(workspace_id, quote_id, created_at desc);
create index if not exists ps_quote_media_workspace_active on public.ps_quote_media(workspace_id, id) where deleted_at is null;

alter table public.ps_quote_media enable row level security;
revoke all on public.ps_quote_media from anon, authenticated;
grant all on public.ps_quote_media to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'quote-media',
  'quote-media',
  false,
  12582912,
  array['image/jpeg','image/png','image/webp','application/pdf']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- No anon/authenticated object policies are created. The service-role Quote API owns upload/sign operations.
commit;

-- ============================================================
-- END 008-quote-media.sql
-- ============================================================


-- ============================================================
-- BEGIN 009-quote-process-authority.sql
-- ============================================================
-- Pool Shed v1.33.0 Quote Process Authority
-- Run after 007-quote-studio.sql and 008-quote-media.sql.
-- Makes customer acceptance atomic, queues operational conversion, and supports explicit decline/conversion status.
begin;

-- Extend customer publication lifecycle without weakening immutable quote-version evidence.
alter table public.ps_quote_publications drop constraint if exists ps_quote_publications_status_check;
alter table public.ps_quote_publications
  add constraint ps_quote_publications_status_check
  check (status in ('live','accepted','declined','expired','revoked','superseded'));

create table if not exists public.ps_quote_conversion_jobs (
  id uuid primary key,
  publication_id uuid not null unique references public.ps_quote_publications(id) on delete cascade,
  acceptance_id uuid not null unique references public.ps_quote_acceptances(id) on delete cascade,
  workspace_id text not null,
  quote_id text not null,
  version_number integer not null,
  status text not null default 'pending' check (status in ('pending','processing','done','failed')),
  attempts integer not null default 0,
  last_error text,
  conversion jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);
create index if not exists ps_quote_conversion_jobs_workspace_status
  on public.ps_quote_conversion_jobs(workspace_id,status,created_at);
alter table public.ps_quote_conversion_jobs enable row level security;
revoke all on public.ps_quote_conversion_jobs from anon, authenticated;
grant all on public.ps_quote_conversion_jobs to service_role;

-- Customer acceptance is the authoritative transaction. It is persisted before any Project/SO/PO work begins.
create or replace function public.ps_quote_accept_atomic(
  p_publication uuid,
  p_signer text,
  p_terms text,
  p_selections jsonb,
  p_evidence jsonb
) returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  p public.ps_quote_publications;
  a public.ps_quote_acceptances;
  acceptance_id uuid;
  accepted_at timestamptz;
  already boolean := false;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_publication::text,0));
  select * into p from public.ps_quote_publications where id=p_publication for update;
  if p.id is null then raise exception 'Proposal publication not found'; end if;
  if p.status='superseded' then raise exception 'A newer proposal version is available'; end if;
  if p.status='revoked' then raise exception 'This proposal has been withdrawn'; end if;
  if p.status='declined' then raise exception 'This proposal was declined'; end if;
  if p.expires_at is not null and p.expires_at < now() and p.accepted_at is null then
    update public.ps_quote_publications set status='expired' where id=p.id;
    raise exception 'This proposal has expired';
  end if;
  if coalesce(p.public_payload->>'termsVersion','') <> coalesce(p_terms,'') then
    raise exception 'The Terms & Conditions version has changed';
  end if;

  select * into a from public.ps_quote_acceptances where publication_id=p.id;
  if a.id is not null then
    acceptance_id:=a.id; accepted_at:=a.accepted_at; already:=true;
  else
    acceptance_id:=gen_random_uuid(); accepted_at:=clock_timestamp();
    insert into public.ps_quote_acceptances(
      id,publication_id,quote_id,version_number,signer,terms_version,selections,evidence,accepted_at
    ) values (
      acceptance_id,p.id,p.quote_id,p.version_number,left(trim(p_signer),200),p_terms,
      coalesce(p_selections,'{}'::jsonb),coalesce(p_evidence,'{}'::jsonb),accepted_at
    );
    update public.ps_quote_publications
      set customer_state=jsonb_set(coalesce(customer_state,'{}'::jsonb),'{selections}',coalesce(p_selections,'{}'::jsonb),true),
          status='accepted',accepted_at=accepted_at
      where id=p.id;
  end if;

  insert into public.ps_quote_conversion_jobs(
    id,publication_id,acceptance_id,workspace_id,quote_id,version_number,status
  ) values (
    gen_random_uuid(),p.id,acceptance_id,p.workspace_id,p.quote_id,p.version_number,'pending'
  ) on conflict (publication_id) do nothing;

  return jsonb_build_object(
    'accepted',true,
    'acceptance_id',acceptance_id,
    'accepted_at',accepted_at,
    'already_accepted',already
  );
end $$;
revoke all on function public.ps_quote_accept_atomic(uuid,text,text,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.ps_quote_accept_atomic(uuid,text,text,jsonb,jsonb) to service_role;

-- Claim a conversion job safely. A failed job can be retried without creating a second acceptance.
create or replace function public.ps_quote_conversion_claim(p_publication uuid)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare j public.ps_quote_conversion_jobs;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_publication::text,1));
  select * into j from public.ps_quote_conversion_jobs where publication_id=p_publication for update;
  if j.id is null then return null; end if;
  if j.status='done' then return to_jsonb(j); end if;
  update public.ps_quote_conversion_jobs
    set status='processing',attempts=attempts+1,started_at=clock_timestamp(),updated_at=clock_timestamp(),last_error=null
    where id=j.id returning * into j;
  return to_jsonb(j);
end $$;
revoke all on function public.ps_quote_conversion_claim(uuid) from public,anon,authenticated;
grant execute on function public.ps_quote_conversion_claim(uuid) to service_role;

create or replace function public.ps_quote_conversion_finish(
  p_publication uuid,
  p_status text,
  p_conversion jsonb,
  p_error text default null
) returns void
language plpgsql
security definer
set search_path=public
as $$
begin
  if p_status not in ('done','failed') then raise exception 'Invalid conversion finish status'; end if;
  update public.ps_quote_conversion_jobs
    set status=p_status,
        conversion=coalesce(p_conversion,'{}'::jsonb),
        last_error=case when p_status='failed' then left(coalesce(p_error,''),4000) else null end,
        completed_at=case when p_status='done' then clock_timestamp() else completed_at end,
        updated_at=clock_timestamp()
    where publication_id=p_publication;
end $$;
revoke all on function public.ps_quote_conversion_finish(uuid,text,jsonb,text) from public,anon,authenticated;
grant execute on function public.ps_quote_conversion_finish(uuid,text,jsonb,text) to service_role;

commit;

-- ============================================================
-- END 009-quote-process-authority.sql
-- ============================================================


-- ============================================================
-- BEGIN 010-product-crm-media.sql
-- ============================================================
-- Pool Shed v1.34.0 Product Hub + CRM secure media authority
-- Run after 009-quote-process-authority.sql.
-- Product and customer master records remain in the Pool Shed workspace snapshot.
-- Files live in private Supabase Storage and are referenced by stable media IDs.
begin;

create table if not exists public.ps_product_media (
  id uuid primary key,
  workspace_id text not null,
  product_id text not null,
  asset_kind text not null check (asset_kind in (
    'main_image','gallery','brochure','datasheet','installation_guide','warranty','certificate','other'
  )),
  storage_path text not null unique,
  file_name text not null,
  title text,
  alt_text text,
  mime_type text not null check (mime_type in ('image/jpeg','image/png','image/webp','application/pdf')),
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 26214400),
  sort_order integer not null default 0,
  uploaded_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  archived_at timestamptz
);

create index if not exists ps_product_media_product
  on public.ps_product_media(workspace_id,product_id,asset_kind,sort_order,created_at desc);
create index if not exists ps_product_media_active
  on public.ps_product_media(workspace_id,id) where archived_at is null;

create table if not exists public.ps_customer_media (
  id uuid primary key,
  workspace_id text not null,
  customer_id text not null,
  site_key text,
  asset_kind text not null check (asset_kind in (
    'site_photo','drawing','survey','document','access','warranty','certificate','other'
  )),
  storage_path text not null unique,
  file_name text not null,
  title text,
  notes text,
  mime_type text not null check (mime_type in ('image/jpeg','image/png','image/webp','application/pdf')),
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 26214400),
  uploaded_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists ps_customer_media_customer
  on public.ps_customer_media(workspace_id,customer_id,created_at desc);
create index if not exists ps_customer_media_active
  on public.ps_customer_media(workspace_id,id) where deleted_at is null;

alter table public.ps_product_media enable row level security;
alter table public.ps_customer_media enable row level security;
revoke all on public.ps_product_media, public.ps_customer_media from anon,authenticated;
grant all on public.ps_product_media, public.ps_customer_media to service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values(
  'product-media','product-media',false,26214400,
  array['image/jpeg','image/png','image/webp','application/pdf']
)
on conflict(id) do update set
  public=false,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values(
  'customer-media','customer-media',false,26214400,
  array['image/jpeg','image/png','image/webp','application/pdf']
)
on conflict(id) do update set
  public=false,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

-- No anon/authenticated storage policies are created. The service-role media API owns
-- upload/sign/archive actions, just like Quote Media.
commit;

-- ============================================================
-- END 010-product-crm-media.sql
-- ============================================================


-- ============================================================
-- INSTALL COMPLETION MARKER
-- ============================================================
select 'POOL SHED v1.34 FRESH SUPABASE SCHEMA INSTALLED' as result;
