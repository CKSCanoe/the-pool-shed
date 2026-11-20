-- Pool Shed 025 - Xero hand-off, READY BUT NOT LINKED (owner, 20 Nov 2026: "get everything set up ready ... I don't want
-- to link it yet due to the risk").
-- Builds exactly what each posted bill and supplier payment would look like in Xero, checks it for problems, and holds it
-- in an outbox. Nothing is sent: sending needs (1) the ps_feature_flags row 'xero_push' switched on, AND (2) the server's
-- existing Xero live lock (XERO_INTEGRATION_MODE=live with all Xero keys), AND (3) an authorised Xero connection.
-- None of these is set. Also: opening balances from Xero, recorded in the ledger and never sent back to Xero.
-- Additive; no workspace data is changed.
begin;

insert into public.ps_feature_flags(name, enabled, note)
values ('xero_push', false, 'Send posted ledger documents to Xero. OFF until the owner decides to link Xero.')
on conflict (name) do nothing;

-- Ledger account -> Xero account code (suggested codes are Xero's UK defaults: confirm against your Xero chart).
alter table public.ps_ledger_accounts add column if not exists xero_confirmed boolean not null default false;
update public.ps_ledger_accounts a set xero_code = m.code
from (values ('stock','630'),('debtors','610'),('bank','090'),('wip','630'),('creditors','800'),('grni','800'),
             ('vat_output','820'),('vat_input','820'),('sales','200'),('cost_of_sales','310'),('price_variance','310'),
             ('stock_adjust','310'),('direct_purchases','300'),('sub_accruals','800')) m(role, code)
where a.workspace_id = 'pool-bros-main' and a.system_role = m.role and a.xero_code is null;

-- VAT -> Xero tax type (UK).
create table if not exists public.ps_xero_tax_map (
  workspace_id text not null,
  vat_rate numeric(5,2) not null,
  direction text not null check (direction in ('purchase','sale')),
  tax_type text not null,
  primary key (workspace_id, vat_rate, direction)
);
insert into public.ps_xero_tax_map values
  ('pool-bros-main', 20, 'purchase', 'INPUT2'), ('pool-bros-main', 5, 'purchase', 'RRINPUT'), ('pool-bros-main', 0, 'purchase', 'NONE'),
  ('pool-bros-main', 20, 'sale', 'OUTPUT2'), ('pool-bros-main', 5, 'sale', 'RROUTPUT'), ('pool-bros-main', 0, 'sale', 'NONE')
on conflict do nothing;

-- Pool Shed supplier/customer -> Xero contact (filled when Xero is linked: matched by name, confirmed by Accounts).
create table if not exists public.ps_xero_contact_map (
  workspace_id text not null,
  contact_type text not null check (contact_type in ('supplier','customer')),
  contact_key text not null,
  xero_contact_id uuid,
  xero_name text,
  confirmed_by uuid,
  confirmed_at timestamptz,
  primary key (workspace_id, contact_type, contact_key)
);

-- The outbox: one row per posted document that Xero should receive, with the exact payload and any problems.
create table if not exists public.ps_xero_outbox (
  document_id uuid primary key references public.ps_ledger_documents(id),
  workspace_id text not null,
  kind text not null check (kind in ('bill','supplier_payment','supplier_credit','invoice','customer_payment','customer_credit','journal')),
  payload jsonb not null,
  problems text[] not null default '{}',
  depends_on uuid references public.ps_ledger_documents(id),
  state text not null default 'held' check (state in ('held','ready','sending','sent','needs_attention')),
  xero_id text,
  last_error text,
  attempts integer not null default 0,
  prepared_at timestamptz not null default now(),
  sent_at timestamptz
);
create index if not exists ps_xero_outbox_state on public.ps_xero_outbox(workspace_id, state);

alter table public.ps_xero_tax_map enable row level security;
alter table public.ps_xero_contact_map enable row level security;
alter table public.ps_xero_outbox enable row level security;
revoke all on public.ps_xero_tax_map, public.ps_xero_contact_map, public.ps_xero_outbox from anon, authenticated;

create or replace function public.ps_xero_account(w text, ledger_code text)
returns text language sql stable security definer set search_path=public as $$
  select xero_code from ps_ledger_accounts where workspace_id = w and code = ledger_code;
$$;
revoke all on function public.ps_xero_account(text,text) from public, anon, authenticated;

-- Build (or rebuild) the Xero payload for one posted document and record its problems. Sends nothing.
create or replace function public.ps_xero_prepare_document(w text, doc_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare d ps_ledger_documents; c ps_purchase_controls; contact ps_xero_contact_map; problems text[] := '{}'; payload jsonb;
        kind text; dep uuid; cost_line ps_ledger_lines; bank_line ps_ledger_lines; rate numeric; tax text; acct text; bank_acct text; bill ps_ledger_documents;
begin
  select * into d from ps_ledger_documents where id = doc_id and workspace_id = w and status = 'posted';
  if d.id is null then raise exception 'Posted document not found'; end if;
  if coalesce((d.meta->>'opening')::boolean, false) then
    update ps_ledger_documents set xero_status = 'not_required' where id = d.id and xero_status <> 'not_required';
    return jsonb_build_object('skipped', 'opening balance: already in Xero');
  end if;
  select * into contact from ps_xero_contact_map where workspace_id = w and contact_type = coalesce(d.contact_type,'supplier') and contact_key = d.contact_key;
  if contact.xero_contact_id is null then problems := array_append(problems, (('Match "' || coalesce(d.contact_name,'?') || '" to a Xero contact (done when Xero is linked)'))::text); end if;

  if d.doc_type = 'purchase_invoice' then
    kind := 'bill';
    select * into c from ps_purchase_controls where document_id = d.id;
    select * into cost_line from ps_ledger_lines where document_id = d.id and debit > 0 and account_code not in
      (select code from ps_ledger_accounts where workspace_id = w and system_role = 'vat_input') order by line_no limit 1;
    acct := ps_xero_account(w, cost_line.account_code);
    if acct is null then problems := array_append(problems, (('No Xero account code for ledger account ' || cost_line.account_code))::text); end if;
    if not exists(select 1 from ps_ledger_accounts where workspace_id = w and code = cost_line.account_code and xero_confirmed) then
      problems := array_append(problems, (('Confirm the Xero account code for ledger account ' || cost_line.account_code))::text);
    end if;
    rate := case when d.net = 0 then 0 else round(d.vat / d.net * 100, 0) end;
    select tax_type into tax from ps_xero_tax_map where workspace_id = w and direction = 'purchase' and vat_rate = rate;
    if tax is null then problems := array_append(problems, (('VAT of ' || rate || '% has no Xero tax type'))::text); end if;
    payload := jsonb_build_object('Type','ACCPAY',
      'Contact', case when contact.xero_contact_id is not null then jsonb_build_object('ContactID', contact.xero_contact_id) else jsonb_build_object('Name', d.contact_name) end,
      'Date', to_char(d.doc_date,'YYYY-MM-DD'), 'DueDate', to_char(coalesce(d.due_date, d.doc_date),'YYYY-MM-DD'),
      'InvoiceNumber', c.supplier_invoice_no, 'Reference', 'PS-' || d.doc_number, 'LineAmountTypes', 'Exclusive', 'Status', 'AUTHORISED',
      'CurrencyCode', 'GBP',
      'LineItems', jsonb_build_array(jsonb_build_object('Description', left(coalesce(d.meta->>'description', d.contact_name, 'Purchase') ||
                   case when c.job_id is not null then ' (job ' || c.job_id || ')' else '' end, 4000),
        'Quantity', 1, 'UnitAmount', d.net, 'AccountCode', acct, 'TaxType', tax, 'TaxAmount', d.vat)));
  elsif d.doc_type = 'supplier_payment' then
    kind := 'supplier_payment';
    select * into bank_line from ps_ledger_lines where document_id = d.id and credit > 0 order by line_no limit 1;
    bank_acct := ps_xero_account(w, bank_line.account_code);
    if bank_acct is null or not exists(select 1 from ps_ledger_accounts where workspace_id = w and code = bank_line.account_code and xero_confirmed) then
      problems := array_append(problems, ('Confirm the Xero bank account code')::text);
    end if;
    -- One Xero payment per bill it settles; each must wait until its bill is in Xero.
    select b.* into bill from ps_ledger_allocations a join ps_ledger_documents b on b.id = a.to_document where a.from_document = d.id order by b.doc_date limit 1;
    dep := bill.id;
    payload := jsonb_build_object('Payments', (select jsonb_agg(jsonb_build_object(
        'Invoice', jsonb_build_object('PSDocument', b.doc_number, 'InvoiceID', (select o.xero_id from ps_xero_outbox o where o.document_id = b.id)),
        'Account', jsonb_build_object('Code', bank_acct), 'Date', to_char(d.doc_date,'YYYY-MM-DD'), 'Amount', a.amount,
        'Reference', left(coalesce(d.reference, d.doc_number), 255)) order by b.doc_date)
      from ps_ledger_allocations a join ps_ledger_documents b on b.id = a.to_document where a.from_document = d.id));
    if exists(select 1 from ps_ledger_allocations a left join ps_xero_outbox o on o.document_id = a.to_document
              where a.from_document = d.id and (o.state is distinct from 'sent')) then
      problems := array_append(problems, ('Waits until the bill it pays is in Xero')::text);
    end if;
  else
    return jsonb_build_object('skipped', d.doc_type || ' is sent to Xero in a later step');
  end if;

  insert into ps_xero_outbox(document_id, workspace_id, kind, payload, problems, depends_on, state, prepared_at)
  values (d.id, w, kind, payload, problems, dep, case when cardinality(problems) = 0 then 'ready' else 'held' end, now())
  on conflict (document_id) do update
    set payload = excluded.payload, problems = excluded.problems, depends_on = excluded.depends_on, prepared_at = now(),
        state = case when ps_xero_outbox.state in ('sent','sending') then ps_xero_outbox.state
                     when cardinality(excluded.problems) = 0 then 'ready' else 'held' end;
  update ps_ledger_documents set xero_status = case when cardinality(problems) = 0 then 'queued' else 'needs_attention' end,
         xero_message = array_to_string(problems, '; ')
   where id = d.id and xero_status not in ('in_xero','not_required');
  return jsonb_build_object('kind', kind, 'problems', to_jsonb(problems), 'payload', payload);
end $$;
revoke all on function public.ps_xero_prepare_document(text,uuid) from public, anon, authenticated;
grant execute on function public.ps_xero_prepare_document(text,uuid) to service_role;  -- the locked sender only

-- Prepare everything posted and not yet sent (finance roles; safe to run any time; sends nothing).
create or replace function public.ps_xero_prepare_all(w text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare me uuid := ps_ledger_require_finance(w); d record; n integer := 0;
begin
  for d in select id from ps_ledger_documents where workspace_id = w and status = 'posted'
             and doc_type in ('purchase_invoice','supplier_payment') and xero_status not in ('in_xero','not_required')
           order by doc_date, created_at loop
    perform ps_xero_prepare_document(w, d.id); n := n + 1;
  end loop;
  return jsonb_build_object('prepared', n,
    'ready', (select count(*) from ps_xero_outbox where workspace_id = w and state = 'ready'),
    'held', (select count(*) from ps_xero_outbox where workspace_id = w and state = 'held'),
    'linked', coalesce((select enabled from ps_feature_flags where name = 'xero_push'), false));
end $$;
revoke all on function public.ps_xero_prepare_all(text) from public, anon;
grant execute on function public.ps_xero_prepare_all(text) to authenticated;

-- The outbox for the Xero page.
create or replace function public.ps_xero_outbox_list(w text)
returns table(document_id uuid, doc_number text, kind text, contact text, doc_date date, amount numeric, state text, problems text[], payload jsonb)
language plpgsql stable security definer set search_path=public as $$
begin
  perform ps_ledger_require_finance(w);
  return query select o.document_id, d.doc_number, o.kind, d.contact_name, d.doc_date, d.gross, o.state, o.problems, o.payload
    from ps_xero_outbox o join ps_ledger_documents d on d.id = o.document_id
    where o.workspace_id = w order by d.doc_date desc, d.doc_number desc limit 300;
end $$;
revoke all on function public.ps_xero_outbox_list(text) from public, anon;
grant execute on function public.ps_xero_outbox_list(text) to authenticated;

-- Account-code mapping for the Xero page (read and confirm).
create or replace function public.ps_xero_accounts_list(w text)
returns table(code text, name text, system_role text, xero_code text, xero_confirmed boolean)
language plpgsql stable security definer set search_path=public as $$
begin
  perform ps_ledger_require_finance(w);
  return query select a.code, a.name, a.system_role, a.xero_code, a.xero_confirmed from ps_ledger_accounts a where a.workspace_id = w order by a.code;
end $$;
revoke all on function public.ps_xero_accounts_list(text) from public, anon;
grant execute on function public.ps_xero_accounts_list(text) to authenticated;

create or replace function public.ps_xero_account_confirm(w text, ledger_code text, xero_code text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare me uuid := ps_ledger_require_finance(w);
begin
  if coalesce(trim(xero_code),'') !~ '^[A-Za-z0-9.-]{1,10}$' then raise exception 'Enter the account code exactly as it appears in Xero'; end if;
  update ps_ledger_accounts a set xero_code = trim(ps_xero_account_confirm.xero_code), xero_confirmed = true
   where a.workspace_id = w and a.code = ledger_code;
  if not found then raise exception 'Ledger account not found'; end if;
  return jsonb_build_object('code', ledger_code, 'xero_code', trim(xero_code), 'confirmed', true);
end $$;
revoke all on function public.ps_xero_account_confirm(text,text,text) from public, anon;
grant execute on function public.ps_xero_account_confirm(text,text,text) to authenticated;

-- Opening balances (open supplier bills on the go-live date, as exported from Xero's Aged Payables).
-- Recorded in the ledger so Pool Shed knows what is owed and can pay it in payment runs; marked as opening so they are
-- NEVER sent back to Xero (they are already there). rows: [{supplier_key, supplier_invoice_no, invoice_date, due_date, outstanding_gross}]
create or replace function public.ps_opening_supplier_bills(w text, as_of date, rows jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare me uuid := ps_ledger_require_finance(w); r jsonb; t jsonb; doc jsonb; n integer := 0; total numeric := 0; problems text[] := '{}';
begin
  if coalesce((ps_user_access()->>'restricted')::boolean, true) then raise exception 'Only Admin or Management can load opening balances'; end if;
  for r in select value from jsonb_array_elements(rows) loop
    t := ps_supplier_terms(w, r->>'supplier_key');
    if t is null then problems := array_append(problems, (('Unknown supplier ' || coalesce(r->>'supplier_key','?')))::text); continue; end if;
    if coalesce((r->>'outstanding_gross')::numeric, 0) <= 0 then problems := array_append(problems, (('No amount for ' || coalesce(r->>'supplier_invoice_no','?')))::text); continue; end if;
    if exists(select 1 from ps_purchase_controls c join ps_ledger_documents d on d.id = c.document_id
              where c.workspace_id = w and d.contact_key = t->>'key' and lower(trim(c.supplier_invoice_no)) = lower(trim(r->>'supplier_invoice_no'))) then
      problems := array_append(problems, (('Already recorded: ' || (r->>'supplier_invoice_no')))::text); continue;
    end if;
    doc := ps_ledger_post(w, jsonb_build_object('doc_type','purchase_invoice','doc_date', as_of, 'due_date', coalesce((r->>'due_date')::date, as_of),
        'contact_type','supplier','contact_key',t->>'key','contact_name',t->>'name','reference',r->>'supplier_invoice_no',
        'source_type','opening','source_id', r->>'supplier_invoice_no', 'net', (r->>'outstanding_gross')::numeric, 'vat', 0,
        'gross', (r->>'outstanding_gross')::numeric,
        'meta', jsonb_build_object('opening', true, 'original_invoice_date', r->>'invoice_date', 'description', 'Opening balance from Xero')),
      jsonb_build_array(jsonb_build_object('account_role','creditors','credit',(r->>'outstanding_gross')::numeric,'description','Opening balance'),
                        jsonb_build_object('account_code','3999','debit',(r->>'outstanding_gross')::numeric,'description','Opening balance')));
    insert into ps_purchase_controls(document_id, workspace_id, supplier_invoice_no, category, payment_basis, attachment_ref, approval_status)
    values ((doc->>'id')::uuid, w, trim(r->>'supplier_invoice_no'), 'Opening balance', t->>'basis', 'opening-balance:xero', 'not_required');
    update ps_ledger_documents set xero_status = 'not_required' where id = (doc->>'id')::uuid;
    n := n + 1; total := total + (r->>'outstanding_gross')::numeric;
  end loop;
  return jsonb_build_object('loaded', n, 'total', total, 'problems', to_jsonb(problems));
end $$;
revoke all on function public.ps_opening_supplier_bills(text,date,jsonb) from public, anon;
grant execute on function public.ps_opening_supplier_bills(text,date,jsonb) to authenticated;

insert into public.ps_ledger_accounts(workspace_id, code, name, account_type, system_role, xero_code)
values ('pool-bros-main', '3999', 'Opening balances (suspense)', 'equity', 'opening', null)
on conflict do nothing;

commit;
