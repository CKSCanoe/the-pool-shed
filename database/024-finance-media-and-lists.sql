-- Pool Shed 024 - Operations O1/O2: private storage for supplier invoices and receipts, and the read-only lists the
-- Record a purchase and Payment runs screens use. Finance roles only (Admin, Management, Accounts).
-- Additive; no workspace data is changed.
begin;

create table if not exists public.ps_finance_media (
  id uuid primary key,
  workspace_id text not null,
  supplier_key text not null,
  asset_kind text not null check (asset_kind in ('supplier_invoice','receipt','credit_note','remittance','other')),
  storage_path text not null unique,
  file_name text not null,
  title text,
  alt_text text,
  notes text,
  mime_type text not null check (mime_type in ('image/jpeg','image/png','image/webp','application/pdf')),
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 26214400),
  sort_order integer not null default 0,
  uploaded_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists ps_finance_media_supplier on public.ps_finance_media(workspace_id, supplier_key, created_at desc);
alter table public.ps_finance_media enable row level security;
revoke all on public.ps_finance_media from anon, authenticated;

insert into storage.buckets(id, name, public) values ('finance-media', 'finance-media', false) on conflict (id) do nothing;

-- Purchases for the Accounts screens, newest first, with where each one stands.
create or replace function public.ps_purchase_list(w text, max_rows integer default 200)
returns table(document_id uuid, doc_number text, supplier text, supplier_key text, supplier_invoice_no text, doc_date date, due_date date,
              job_id text, category text, net numeric, vat numeric, gross numeric, outstanding numeric, payment_basis text,
              approval_status text, attachment_ref text, created_by_me boolean, state text, description text)
language plpgsql stable security definer set search_path=public as $$
declare me uuid := ps_ledger_require_finance(w); s ps_ledger_settings;
begin
  select * into s from ps_ledger_settings where workspace_id = w;
  return query
  select d.id, d.doc_number, d.contact_name, d.contact_key, c.supplier_invoice_no, d.doc_date, d.due_date, c.job_id, c.category,
         d.net, d.vat, d.gross, ps_document_outstanding(d.id), c.payment_basis, c.approval_status, c.attachment_ref,
         d.created_by = me,
         case when ps_document_outstanding(d.id) <= 0 then 'Paid'
              when c.approval_status = 'rejected' then 'Rejected'
              when c.approval_status = 'pending' then 'Waiting for approval'
              when c.attachment_ref is null and s.require_attachment then 'Invoice copy missing'
              when exists(select 1 from ps_payment_run_items i join ps_payment_runs r on r.id = i.run_id
                          where i.document_id = d.id and r.status in ('draft','approved')) then 'In a payment run'
              when d.due_date < current_date then 'Overdue'
              else 'Due ' || to_char(d.due_date, 'DD Mon') end,
         d.meta->>'description'
  from ps_ledger_documents d join ps_purchase_controls c on c.document_id = d.id
  where d.workspace_id = w and d.doc_type = 'purchase_invoice' and d.status = 'posted'
  order by d.created_at desc
  limit greatest(1, least(max_rows, 1000));
end $$;
revoke all on function public.ps_purchase_list(text,integer) from public, anon;
grant execute on function public.ps_purchase_list(text,integer) to authenticated;

create or replace function public.ps_payment_runs_list(w text)
returns table(run_id uuid, run_number text, status text, pay_date date, method text, total numeric, bills integer, suppliers integer,
              created_by_me boolean, created_at timestamptz, approved_at timestamptz, paid_at timestamptz)
language plpgsql stable security definer set search_path=public as $$
declare me uuid := ps_ledger_require_finance(w);
begin
  return query
  select r.id, r.run_number, r.status, r.pay_date, r.method, r.total,
         (select count(*)::integer from ps_payment_run_items i where i.run_id = r.id),
         (select count(distinct d.contact_key)::integer from ps_payment_run_items i join ps_ledger_documents d on d.id = i.document_id where i.run_id = r.id),
         r.created_by = me, r.created_at, r.approved_at, r.paid_at
  from ps_payment_runs r where r.workspace_id = w and r.status <> 'cancelled'
  order by r.created_at desc limit 50;
end $$;
revoke all on function public.ps_payment_runs_list(text) from public, anon;
grant execute on function public.ps_payment_runs_list(text) to authenticated;

-- The payment list for a run, one line per supplier (what the bank needs), with the bills it settles.
create or replace function public.ps_payment_run_lines(w text, run uuid)
returns table(supplier text, supplier_key text, amount numeric, bills text)
language plpgsql stable security definer set search_path=public as $$
begin
  perform ps_ledger_require_finance(w);
  return query
  select d.contact_name, d.contact_key, sum(i.amount), string_agg(c.supplier_invoice_no, ', ' order by d.doc_date)
  from ps_payment_run_items i
  join ps_payment_runs r on r.id = i.run_id and r.workspace_id = w
  join ps_ledger_documents d on d.id = i.document_id
  join ps_purchase_controls c on c.document_id = d.id
  where i.run_id = run
  group by d.contact_name, d.contact_key order by d.contact_name;
end $$;
revoke all on function public.ps_payment_run_lines(text,uuid) from public, anon;
grant execute on function public.ps_payment_run_lines(text,uuid) to authenticated;

create or replace function public.ps_payment_run_cancel(w text, run uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare actor uuid := ps_ledger_require_finance(w);
begin
  update ps_payment_runs set status = 'cancelled' where id = run and workspace_id = w and status in ('draft','approved');
  if not found then raise exception 'Only a draft or approved run can be cancelled'; end if;
  return jsonb_build_object('status','cancelled');
end $$;
revoke all on function public.ps_payment_run_cancel(text,uuid) from public, anon;
grant execute on function public.ps_payment_run_cancel(text,uuid) to authenticated;

create or replace function public.ps_ledger_settings_get(w text)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare me uuid := ps_ledger_require_finance(w); s ps_ledger_settings;
begin
  select * into s from ps_ledger_settings where workspace_id = w;
  return jsonb_build_object('approval_threshold', s.approval_threshold, 'require_attachment', s.require_attachment,
                            'can_approve', not coalesce((ps_user_access()->>'restricted')::boolean, true));
end $$;
revoke all on function public.ps_ledger_settings_get(text) from public, anon;
grant execute on function public.ps_ledger_settings_get(text) to authenticated;

commit;
