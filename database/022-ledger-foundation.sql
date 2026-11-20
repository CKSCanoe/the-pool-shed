-- Pool Shed 022 - Operations O1: ledger foundation (owner decision 20 Nov 2026: Pool Shed is the ledger,
-- Brightpearl-style; posted documents are pushed to Xero later).
-- Additive: new tables only. No workspace data is changed.
-- Rules enforced by the database, not just the screens:
--   * every posted document balances (debits = credits, more than zero);
--   * posted documents and their lines can never be edited or deleted (only Xero sync fields may change);
--   * corrections are new documents that reverse or credit the original;
--   * nothing can post into a closed month;
--   * only roles that see payments and finance (Admin, Management, Accounts) can post, reverse or close months.
-- Staff never read these tables directly; they use the functions below.
-- Rollback (only while no real postings exist): drop the ps_ledger_* tables and functions.
begin;

create table if not exists public.ps_ledger_accounts (
  workspace_id text not null,
  code text not null,
  name text not null,
  account_type text not null check (account_type in ('asset','liability','equity','income','expense')),
  system_role text,
  xero_code text,
  active boolean not null default true,
  primary key (workspace_id, code)
);
create unique index if not exists ps_ledger_accounts_role on public.ps_ledger_accounts(workspace_id, system_role) where system_role is not null;

create table if not exists public.ps_ledger_periods (
  workspace_id text not null,
  period date not null check (period = date_trunc('month', period)::date),
  status text not null default 'open' check (status in ('open','closed')),
  closed_at timestamptz,
  closed_by uuid,
  primary key (workspace_id, period)
);

create table if not exists public.ps_ledger_documents (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null,
  doc_type text not null check (doc_type in ('stock_receipt','purchase_invoice','purchase_credit','supplier_payment',
                                             'sales_invoice','sales_credit','customer_receipt','stock_issue',
                                             'stock_adjustment','job_cost','manual_journal','reversal')),
  doc_number text not null,
  status text not null default 'draft' check (status in ('draft','posted')),
  doc_date date not null,
  period date not null,
  due_date date,
  contact_type text check (contact_type in ('supplier','customer')),
  contact_key text,
  contact_name text,
  reference text,
  source_type text,
  source_id text,
  reverses uuid references public.ps_ledger_documents(id),
  net numeric(14,2) not null default 0,
  vat numeric(14,2) not null default 0,
  gross numeric(14,2) not null default 0,
  reason text,
  meta jsonb not null default '{}'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now(),
  posted_by uuid,
  posted_at timestamptz,
  xero_status text not null default 'not_sent' check (xero_status in ('not_sent','queued','in_xero','needs_attention','not_required')),
  xero_id text,
  xero_message text,
  unique (workspace_id, doc_type, doc_number)
);
create index if not exists ps_ledger_documents_contact on public.ps_ledger_documents(workspace_id, contact_type, contact_key, doc_date);
create index if not exists ps_ledger_documents_source on public.ps_ledger_documents(workspace_id, source_type, source_id);
create index if not exists ps_ledger_documents_period on public.ps_ledger_documents(workspace_id, period, doc_type);

create table if not exists public.ps_ledger_lines (
  id bigserial primary key,
  document_id uuid not null references public.ps_ledger_documents(id),
  line_no integer not null,
  account_code text not null,
  debit numeric(14,2) not null default 0 check (debit >= 0),
  credit numeric(14,2) not null default 0 check (credit >= 0),
  description text,
  product_id text,
  qty numeric(14,4),
  source_line_id text,
  check (not (debit > 0 and credit > 0)),
  check (debit > 0 or credit > 0)
);
create index if not exists ps_ledger_lines_doc on public.ps_ledger_lines(document_id);
create index if not exists ps_ledger_lines_account on public.ps_ledger_lines(account_code);

-- Payments allocated against invoices or bills (and credits against what they correct).
create table if not exists public.ps_ledger_allocations (
  id bigserial primary key,
  workspace_id text not null,
  from_document uuid not null references public.ps_ledger_documents(id),
  to_document uuid not null references public.ps_ledger_documents(id),
  amount numeric(14,2) not null check (amount > 0),
  created_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists ps_ledger_allocations_to on public.ps_ledger_allocations(to_document);

create table if not exists public.ps_ledger_counters (
  workspace_id text not null,
  doc_type text not null,
  next_value bigint not null default 1,
  primary key (workspace_id, doc_type)
);

alter table public.ps_ledger_accounts enable row level security;
alter table public.ps_ledger_periods enable row level security;
alter table public.ps_ledger_documents enable row level security;
alter table public.ps_ledger_lines enable row level security;
alter table public.ps_ledger_allocations enable row level security;
alter table public.ps_ledger_counters enable row level security;
revoke all on public.ps_ledger_accounts, public.ps_ledger_periods, public.ps_ledger_documents, public.ps_ledger_lines,
              public.ps_ledger_allocations, public.ps_ledger_counters from anon, authenticated;

-- Default chart (UK, VAT-registered). Xero codes are mapped before go-live.
insert into public.ps_ledger_accounts(workspace_id, code, name, account_type, system_role) values
  ('pool-bros-main','1001','Stock','asset','stock'),
  ('pool-bros-main','1100','Trade debtors','asset','debtors'),
  ('pool-bros-main','1200','Bank current account','asset','bank'),
  ('pool-bros-main','1400','Job work in progress','asset','wip'),
  ('pool-bros-main','2100','Trade creditors','liability','creditors'),
  ('pool-bros-main','2105','Goods received not invoiced','liability','grni'),
  ('pool-bros-main','2110','Subcontractor accruals','liability','sub_accruals'),
  ('pool-bros-main','2200','VAT on sales','liability','vat_output'),
  ('pool-bros-main','2201','VAT on purchases','asset','vat_input'),
  ('pool-bros-main','4000','Sales','income','sales'),
  ('pool-bros-main','5000','Cost of sales','expense','cost_of_sales'),
  ('pool-bros-main','5010','Purchase price variance','expense','price_variance'),
  ('pool-bros-main','5020','Stock adjustments','expense','stock_adjust'),
  ('pool-bros-main','5030','Direct purchases (non-stock)','expense','direct_purchases')
on conflict do nothing;

-- Who may post: roles that see payments and finance.
create or replace function public.ps_ledger_require_finance(w text)
returns uuid language plpgsql stable security definer set search_path=public as $$
declare acc jsonb;
begin
  if not ps_workspace_can_read(w) then raise exception 'Ledger access denied'; end if;
  acc := ps_user_access();
  if coalesce((acc->>'restricted')::boolean, true) and not coalesce((acc->>'finance')::boolean, false) then
    raise exception 'Only Admin, Management or Accounts can make ledger entries';
  end if;
  return auth.uid();
end $$;
revoke all on function public.ps_ledger_require_finance(text) from public, anon, authenticated;

-- Safety: posted documents are permanent (only the Xero sync fields may change); posting must balance and be in an open month.
create or replace function public.ps_ledger_document_guard()
returns trigger language plpgsql set search_path=public as $$
declare d numeric; c numeric; closed boolean;
begin
  if tg_op = 'DELETE' then
    if old.status = 'posted' then raise exception 'Posted ledger documents cannot be deleted; reverse them instead'; end if;
    return old;
  end if;
  if tg_op = 'UPDATE' and old.status = 'posted' then
    if (to_jsonb(new) - array['xero_status','xero_id','xero_message']) is distinct from (to_jsonb(old) - array['xero_status','xero_id','xero_message']) then
      raise exception 'Posted ledger documents cannot be changed; raise a credit note or reversal';
    end if;
    return new;
  end if;
  if new.status = 'posted' and (tg_op = 'INSERT' or old.status <> 'posted') then
    select coalesce(sum(debit),0), coalesce(sum(credit),0) into d, c from ps_ledger_lines where document_id = new.id;
    if d <> c or d = 0 then raise exception 'Ledger document % does not balance (debits %, credits %)', new.doc_number, d, c; end if;
    select status = 'closed' into closed from ps_ledger_periods where workspace_id = new.workspace_id and period = new.period;
    if coalesce(closed, false) then raise exception 'The month % is closed; post into an open month', to_char(new.period, 'Mon YYYY'); end if;
    new.posted_at := coalesce(new.posted_at, now());
  end if;
  return new;
end $$;
drop trigger if exists ps_ledger_document_guard on public.ps_ledger_documents;
create trigger ps_ledger_document_guard before insert or update or delete on public.ps_ledger_documents
for each row execute function public.ps_ledger_document_guard();

create or replace function public.ps_ledger_line_guard()
returns trigger language plpgsql set search_path=public as $$
declare st text;
begin
  select status into st from ps_ledger_documents where id = coalesce(new.document_id, old.document_id);
  if st = 'posted' then raise exception 'Lines of a posted ledger document cannot be changed'; end if;
  return coalesce(new, old);
end $$;
drop trigger if exists ps_ledger_line_guard on public.ps_ledger_lines;
create trigger ps_ledger_line_guard before insert or update or delete on public.ps_ledger_lines
for each row execute function public.ps_ledger_line_guard();

create or replace function public.ps_ledger_next_number(w text, t text)
returns text language plpgsql security definer set search_path=public as $$
declare n bigint; prefix text;
begin
  insert into ps_ledger_counters(workspace_id, doc_type) values (w, t) on conflict do nothing;
  update ps_ledger_counters set next_value = next_value + 1 where workspace_id = w and doc_type = t returning next_value - 1 into n;
  prefix := case t when 'stock_receipt' then 'GRN' when 'purchase_invoice' then 'PINV' when 'purchase_credit' then 'PCRN'
                   when 'supplier_payment' then 'SPAY' when 'sales_invoice' then 'INV' when 'sales_credit' then 'CRN'
                   when 'customer_receipt' then 'RCPT' when 'stock_issue' then 'ISS' when 'stock_adjustment' then 'ADJ'
                   when 'job_cost' then 'JOB' when 'reversal' then 'REV' else 'JNL' end;
  return prefix || '-' || lpad(n::text, 6, '0');
end $$;
revoke all on function public.ps_ledger_next_number(text,text) from public, anon, authenticated;

-- Post one document with its lines in one step. lines: [{account_role|account_code, debit, credit, description, product_id, qty, source_line_id}]
create or replace function public.ps_ledger_post(w text, doc jsonb, lines jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare actor uuid := ps_ledger_require_finance(w); doc_uuid uuid; num text; d date; i integer := 0; l jsonb; acct text;
begin
  d := coalesce((doc->>'doc_date')::date, current_date);
  num := ps_ledger_next_number(w, doc->>'doc_type');
  insert into ps_ledger_documents(workspace_id, doc_type, doc_number, status, doc_date, period, due_date, contact_type, contact_key,
                                  contact_name, reference, source_type, source_id, reverses, net, vat, gross, reason, meta, created_by)
  values (w, doc->>'doc_type', num, 'draft', d, date_trunc('month', d)::date, (doc->>'due_date')::date, doc->>'contact_type',
          doc->>'contact_key', doc->>'contact_name', doc->>'reference', doc->>'source_type', doc->>'source_id',
          (doc->>'reverses')::uuid, coalesce((doc->>'net')::numeric,0), coalesce((doc->>'vat')::numeric,0),
          coalesce((doc->>'gross')::numeric,0), doc->>'reason', coalesce(doc->'meta','{}'::jsonb), actor)
  returning ps_ledger_documents.id into doc_uuid;
  for l in select value from jsonb_array_elements(lines) loop
    i := i + 1;
    acct := coalesce(l->>'account_code', (select a.code from ps_ledger_accounts a where a.workspace_id = w and a.system_role = l->>'account_role'));
    if acct is null or not exists(select 1 from ps_ledger_accounts a where a.workspace_id = w and a.code = acct and a.active) then
      raise exception 'Unknown ledger account %', coalesce(l->>'account_code', l->>'account_role');
    end if;
    insert into ps_ledger_lines(document_id, line_no, account_code, debit, credit, description, product_id, qty, source_line_id)
    values (doc_uuid, i, acct, round(coalesce((l->>'debit')::numeric,0),2), round(coalesce((l->>'credit')::numeric,0),2),
            l->>'description', l->>'product_id', (l->>'qty')::numeric, l->>'source_line_id');
  end loop;
  update ps_ledger_documents set status = 'posted', posted_by = actor where ps_ledger_documents.id = doc_uuid;
  return jsonb_build_object('id', doc_uuid, 'doc_number', num);
end $$;
revoke all on function public.ps_ledger_post(text,jsonb,jsonb) from public, anon, authenticated;

-- Reverse a posted document (the correction for anything that is not a credit note), into an open month.
create or replace function public.ps_ledger_reverse(w text, doc_id uuid, reason text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare actor uuid := ps_ledger_require_finance(w); o ps_ledger_documents; lines jsonb;
begin
  if coalesce(trim(reason), '') = '' then raise exception 'A reason is required to reverse a ledger document'; end if;
  select * into o from ps_ledger_documents where id = doc_id and workspace_id = w and status = 'posted';
  if o.id is null then raise exception 'Posted document not found'; end if;
  if exists(select 1 from ps_ledger_documents where reverses = doc_id) then raise exception 'Document % is already reversed', o.doc_number; end if;
  select jsonb_agg(jsonb_build_object('account_code', account_code, 'debit', credit, 'credit', debit,
                                      'description', 'Reversal: ' || coalesce(description,''), 'product_id', product_id,
                                      'qty', -qty, 'source_line_id', source_line_id) order by line_no)
    into lines from ps_ledger_lines where document_id = doc_id;
  return ps_ledger_post(w, jsonb_build_object('doc_type','reversal','doc_date', current_date, 'contact_type', o.contact_type,
    'contact_key', o.contact_key, 'contact_name', o.contact_name, 'reference', 'Reverses ' || o.doc_number,
    'source_type', o.source_type, 'source_id', o.source_id, 'reverses', o.id, 'net', -o.net, 'vat', -o.vat, 'gross', -o.gross,
    'reason', reason), lines);
end $$;
revoke all on function public.ps_ledger_reverse(text,uuid,text) from public, anon;
grant execute on function public.ps_ledger_reverse(text,uuid,text) to authenticated;

create or replace function public.ps_ledger_close_period(w text, p date)
returns jsonb language plpgsql security definer set search_path=public as $$
declare actor uuid := ps_ledger_require_finance(w);
begin
  insert into ps_ledger_periods(workspace_id, period, status, closed_at, closed_by)
  values (w, date_trunc('month', p)::date, 'closed', now(), actor)
  on conflict (workspace_id, period) do update set status='closed', closed_at=now(), closed_by=actor;
  return jsonb_build_object('closed', to_char(date_trunc('month', p), 'YYYY-MM'));
end $$;
revoke all on function public.ps_ledger_close_period(text,date) from public, anon;
grant execute on function public.ps_ledger_close_period(text,date) to authenticated;

-- Trial balance (must always sum to zero).
create or replace function public.ps_ledger_trial_balance(w text, to_date date default current_date)
returns table(code text, name text, account_type text, debit numeric, credit numeric, balance numeric)
language sql stable security definer set search_path=public as $$
  with posted as (
    select l.account_code, l.debit, l.credit
    from ps_ledger_lines l join ps_ledger_documents d on d.id = l.document_id
    where d.workspace_id = w and d.status = 'posted' and d.doc_date <= to_date
  )
  select a.code, a.name, a.account_type, coalesce(sum(p.debit),0), coalesce(sum(p.credit),0), coalesce(sum(p.debit - p.credit),0)
  from ps_ledger_accounts a left join posted p on p.account_code = a.code
  where a.workspace_id = w
  group by a.code, a.name, a.account_type
  order by a.code;
$$;
revoke all on function public.ps_ledger_trial_balance(text,date) from public, anon, authenticated;

commit;
