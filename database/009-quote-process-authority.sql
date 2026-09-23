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
