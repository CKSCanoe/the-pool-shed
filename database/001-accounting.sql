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
