-- Pool Shed 029 - Operations O3: sales invoicing in the Pool Shed ledger (owner decisions 21 Nov 2026).
--   * Invoice numbers carry on from the last one recorded (INV-2049 onwards), never reusing a number already on an order.
--   * Ready to invoice: orders once delivered (Shipped, Invoice Ready or completed); projects billed by stage, plus deposit
--     invoices raised up front. Orders already invoiced before the ledger are shown as such and never invoiced again.
--   * Payment terms: the customer's own terms if set, otherwise due on receipt.
--   * Prices are worked out by the database exactly as the app does (special price, line price, price list, customer
--     discount, VAT by tax code), so an invoice always matches the order the customer agreed.
--   * Corrections are credit notes (never edits); customer payments are allocated to invoices; refunds of credit.
--   * Invoice emails (PDF from Pool Shed) start OFF: switch 'invoice_emails', and the invoice details (VAT number, bank).
-- Sales documents are prepared for Xero in a later step (Xero stays unlinked). Requires 015, 019, 022-025. Additive.
begin;

insert into public.ps_feature_flags(name, enabled, note)
values ('invoice_emails', false, 'Email sales invoices (PDF) to customers from Pool Shed. OFF until the owner approves.')
on conflict (name) do nothing;

-- What goes on every invoice (legal and payment details). Edited by Admin or Management.
alter table public.ps_ledger_settings add column if not exists invoice_profile jsonb not null default '{}'::jsonb;

-- Each time an invoice is emailed (posted documents themselves never change).
create table if not exists public.ps_sales_invoice_sends (
  id bigserial primary key,
  workspace_id text not null,
  document_id uuid not null references public.ps_ledger_documents(id),
  sent_to text not null,
  sent_by uuid,
  sent_at timestamptz not null default now(),
  provider_id text
);
create index if not exists ps_sales_invoice_sends_doc on public.ps_sales_invoice_sends(document_id, sent_at desc);
alter table public.ps_sales_invoice_sends enable row level security;
revoke all on public.ps_sales_invoice_sends from anon, authenticated;

-- Invoice numbers: INV-<n> without padding, carrying on the existing series.
create or replace function public.ps_ledger_next_number(w text, t text)
returns text language plpgsql security definer set search_path=public as $$
declare n bigint; prefix text;
begin
  insert into ps_ledger_counters(workspace_id, doc_type) values (w, t) on conflict do nothing;
  update ps_ledger_counters set next_value = next_value + 1 where workspace_id = w and doc_type = t returning next_value - 1 into n;
  if t = 'sales_invoice' then return 'INV-' || n; end if;
  prefix := case t when 'stock_receipt' then 'GRN' when 'purchase_invoice' then 'PINV' when 'purchase_credit' then 'PCRN'
                   when 'supplier_payment' then 'SPAY' when 'sales_credit' then 'CRN'
                   when 'customer_receipt' then 'RCPT' when 'stock_issue' then 'ISS' when 'stock_adjustment' then 'ADJ'
                   when 'job_cost' then 'JOB' when 'reversal' then 'REV' else 'JNL' end;
  return prefix || '-' || lpad(n::text, 6, '0');
end $$;
revoke all on function public.ps_ledger_next_number(text,text) from public, anon, authenticated;

insert into public.ps_ledger_counters(workspace_id, doc_type, next_value)
select 'pool-bros-main', 'sales_invoice', greatest(2049, coalesce(max(substring(data->>'xeroRef' from '^INV-(\d+)$')::bigint), 0) + 1)
from public.ps_records where workspace_id = 'pool-bros-main' and section = 'salesOrders'
on conflict (workspace_id, doc_type) do nothing;

-- ---------- Helpers ----------
create or replace function public.ps_num(v jsonb)
returns numeric language sql immutable as $$
  select case jsonb_typeof(v) when 'number' then (v #>> '{}')::numeric
              when 'string' then case when trim(v #>> '{}') ~ '^-?[0-9]+(\.[0-9]+)?$' then trim(v #>> '{}')::numeric end end;
$$;

-- VAT rate for a tax code, exactly as the app's vatRateForLine.
create or replace function public.ps_vat_rate(code text)
returns numeric language plpgsql immutable as $$
declare c text := lower(trim(coalesce(nullif(code, ''), '20% VAT'))); m text[];
begin
  if c in ('0%','t0','zero rated','zero-rated','not rated','not-rated') or c like '%zero rated%' or c like '%not rated%' then return 0; end if;
  if c in ('20%','20% vat','t20') or c like '%20\%%' then return 0.2; end if;
  m := regexp_match(c, '(\d+(?:\.\d+)?)\s*%');
  if m is not null then return greatest(0, m[1]::numeric / 100); end if;
  return 0.2;
end $$;

create or replace function public.ps_customer_info(w text, customer_id text)
returns jsonb language sql stable security definer set search_path=public as $$
  select jsonb_build_object('key', r.key, 'id', r.data->>'id',
    'name', coalesce(nullif(trim(r.data->>'companyName'),''), nullif(trim(r.data->>'name'),''),
                     nullif(trim(concat_ws(' ', r.data->>'firstName', r.data->>'lastName')),''), r.data->>'id'),
    'email', nullif(trim(r.data->>'email'),''), 'vat_number', r.data->>'vatNumber',
    'basis', case when lower(coalesce(r.data->>'creditTermType','')) like 'pro%forma%' then 'pro_forma' else 'on_account' end,
    'days', greatest(0, coalesce(ps_num(r.data->'creditDays'), 0))::integer,
    'credit_limit', ps_num(r.data->'creditLimit'),
    'address', (select a from jsonb_array_elements(case when jsonb_typeof(r.data->'addresses') = 'array' then r.data->'addresses' else '[]'::jsonb end) a
                order by (lower(coalesce(a->>'type','')) like '%bill%' or lower(coalesce(a->>'type','')) like '%invoice%') desc limit 1))
  from ps_records r
  where r.workspace_id = w and r.section = 'customers' and r.deleted_at is null and r.key = 'id:' || customer_id;
$$;
revoke all on function public.ps_customer_info(text,text) from public, anon, authenticated;

-- An order priced exactly as the app prices it (salesOrderTotals): lines, VAT groups and totals.
create or replace function public.ps_sales_order_pricing(w text, order_id text)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare o jsonb; cust jsonb; list text; disc numeric; l jsonb; p jsonb; base numeric; price numeric; qty numeric; rate numeric; ln_net numeric;
        out_lines jsonb := '[]'::jsonb; g jsonb := '{}'::jsonb; k text; groups jsonb := '[]'::jsonb; tnet numeric := 0; tvat numeric := 0;
begin
  select data into o from ps_records where workspace_id = w and section = 'salesOrders' and deleted_at is null and key = 'id:' || order_id;
  if o is null then return null; end if;
  select data into cust from ps_records where workspace_id = w and section = 'customers' and deleted_at is null and key = 'id:' || (o->>'customerId');
  list := coalesce(nullif(o->>'priceList',''), cust->>'priceList');
  disc := case when lower(coalesce(o->>'priceList','')) = 'accepted quote snapshot' then 0
               when jsonb_typeof(o->'customerDiscountRate') = 'number' then (o->>'customerDiscountRate')::numeric
               else coalesce(ps_num(cust->'discount'), 0) end;
  disc := greatest(0, least(100, coalesce(disc, 0)));
  for l in select value from jsonb_array_elements(case when jsonb_typeof(o->'lines') = 'array' then o->'lines' else '[]'::jsonb end) loop
    select data into p from ps_records where workspace_id = w and section = 'products' and deleted_at is null and key = 'id:' || (l->>'productId');
    base := case when jsonb_typeof(l->'specialPrice') = 'number' and (l->>'specialPrice')::numeric >= 0 then (l->>'specialPrice')::numeric
                 when jsonb_typeof(l->'unitPrice') = 'number' then (l->>'unitPrice')::numeric
                 else coalesce(case when list is not null and coalesce(ps_num(p->list), 0) <> 0 then ps_num(p->list) end,
                               nullif(ps_num(p->'rrp'), 0), 0) end;
    base := greatest(0, coalesce(base, 0));
    price := case when disc = 0 or coalesce((l->>'customerDiscountExempt')::boolean, false) or lower(coalesce(l->>'lineType','')) = 'shipping'
                  then base else round(base * (1 - disc / 100), 2) end;
    qty := coalesce(ps_num(l->'qty'), 0);
    rate := ps_vat_rate(l->>'taxCode');
    ln_net := price * qty;
    out_lines := out_lines || jsonb_build_object('description',
        coalesce(nullif(trim(l->>'customProductName'),''), nullif(trim(p->>'name'),''), nullif(trim(l->>'description'),''), l->>'productId', 'Item')
          || coalesce(' - ' || nullif(trim(coalesce(l->>'customVariant', l->>'variantDescription')),''), ''),
        'sku', coalesce(p->>'sku', l->>'sourceSku'), 'product_id', l->>'productId', 'qty', qty, 'unit_net', price,
        'net', round(ln_net, 2), 'vat_rate', rate * 100, 'vat', round(ln_net * rate, 2));
    k := (rate * 100)::text;
    g := jsonb_set(g, array[k], jsonb_build_object('net', coalesce((g->k->>'net')::numeric, 0) + ln_net,
                                                   'vat', coalesce((g->k->>'vat')::numeric, 0) + ln_net * rate));
  end loop;
  for k in select jsonb_object_keys(g) loop
    groups := groups || jsonb_build_object('rate', k::numeric, 'net', round((g->k->>'net')::numeric, 2), 'vat', round((g->k->>'vat')::numeric, 2));
    tnet := tnet + round((g->k->>'net')::numeric, 2); tvat := tvat + round((g->k->>'vat')::numeric, 2);
  end loop;
  return jsonb_build_object('order_id', order_id, 'customer_id', o->>'customerId', 'customer_po', o->>'customerPo',
    'lines', out_lines, 'groups', groups, 'net', tnet, 'vat', tvat, 'gross', tnet + tvat);
end $$;
revoke all on function public.ps_sales_order_pricing(text,text) from public, anon, authenticated;

-- Net/VAT already invoiced for an order or job, by VAT rate, after credit notes (a credited invoice no longer counts).
create or replace function public.ps_sales_billed(w text, src_type text, src_id text)
returns jsonb language sql stable security definer set search_path=public as $$
  with g as (
    select (x->>'rate')::numeric rate, sum(case when d.doc_type = 'sales_invoice' then 1 else -1 end * (x->>'net')::numeric) net,
           sum(case when d.doc_type = 'sales_invoice' then 1 else -1 end * (x->>'vat')::numeric) vat
      from ps_ledger_documents d, jsonb_array_elements(coalesce(d.meta->'groups','[]'::jsonb)) x
     where d.workspace_id = w and d.status = 'posted' and d.doc_type in ('sales_invoice','sales_credit')
       and d.source_type = src_type and d.source_id = src_id
     group by 1)
  select jsonb_build_object('net', coalesce(sum(net),0), 'vat', coalesce(sum(vat),0),
           'groups', coalesce(jsonb_agg(jsonb_build_object('rate', rate, 'net', net, 'vat', vat)) filter (where net <> 0 or vat <> 0), '[]'::jsonb),
           'documents', (select coalesce(jsonb_agg(d.doc_number order by d.doc_date, d.doc_number), '[]'::jsonb) from ps_ledger_documents d
                          where d.workspace_id = w and d.status = 'posted' and d.doc_type = 'sales_invoice' and d.source_type = src_type and d.source_id = src_id))
  from g;
$$;
revoke all on function public.ps_sales_billed(text,text,text) from public, anon, authenticated;

-- Contract value of a project billed by stage: accepted quote plus approved extras (as the project screens count it).
create or replace function public.ps_job_contract(w text, job_id text)
returns jsonb language sql stable security definer set search_path=public as $$
  select jsonb_build_object('job_id', r.data->>'id', 'name', r.data->>'name', 'customer_id', r.data->>'customerId',
    'billing_mode', coalesce(r.data->'project'->>'billingMode', 'orders'),
    'contract_net', coalesce(ps_num(r.data->'project'->'quoteNet'), 0)
       + coalesce((select sum(coalesce(ps_num(v->'sellNet'), 0)) from jsonb_array_elements(case when jsonb_typeof(r.data->'project'->'variations') = 'array'
                    then r.data->'project'->'variations' else '[]'::jsonb end) v where v->>'status' = 'Approved'), 0),
    'phases', coalesce((select jsonb_agg(jsonb_build_object('id', ph->>'id', 'name', ph->>'name', 'amount_net', ps_num(ph->'amountNet'), 'status', ph->>'status'))
                 from jsonb_array_elements(case when jsonb_typeof(r.data->'project'->'phases') = 'array' then r.data->'project'->'phases' else '[]'::jsonb end) ph), '[]'::jsonb))
  from ps_records r where r.workspace_id = w and r.section = 'jobs' and r.deleted_at is null and r.key = 'id:' || job_id;
$$;
revoke all on function public.ps_job_contract(text,text) from public, anon, authenticated;

-- ---------- What needs invoicing ----------
create or replace function public.ps_invoicing_queue(w text)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare me uuid := ps_ledger_require_finance(w); orders jsonb := '[]'::jsonb; jobs jsonb := '[]'::jsonb; r record; pr jsonb; billed jsonb;
        state text; c jsonb; stage_jobs text[];
begin
  select coalesce(array_agg(data->>'id'), '{}') into stage_jobs from ps_records
   where workspace_id = w and section = 'jobs' and deleted_at is null and data->'project'->>'billingMode' = 'phases';
  for r in select data from ps_records where workspace_id = w and section = 'salesOrders' and deleted_at is null
              and coalesce(data->>'status','') not in ('Quote') order by data->>'id' loop
    pr := ps_sales_order_pricing(w, r.data->>'id');
    billed := ps_sales_billed(w, 'sales_order', r.data->>'id');
    state := case
      when coalesce(r.data->>'jobId', r.data->>'projectId') = any(stage_jobs) then 'project_stages'
      when jsonb_array_length(billed->'documents') > 0 and (pr->>'net')::numeric - coalesce((billed->>'net')::numeric, 0) <= 0.004 then 'invoiced'
      when jsonb_array_length(billed->'documents') = 0 and (r.data->>'status' = 'Invoiced' or coalesce(r.data->>'xeroRef','') ~ '^INV-') then 'before_ledger'
      when r.data->>'status' in ('Shipped','Invoice Ready') or coalesce((r.data->>'isCompleted')::boolean, false) then 'ready'
      when r.data->>'status' = 'On Hold' then 'on_hold'
      else 'in_progress' end;
    c := ps_customer_info(w, r.data->>'customerId');
    orders := orders || jsonb_build_object('order_id', r.data->>'id', 'status', r.data->>'status', 'state', state,
      'customer', c->>'name', 'customer_key', c->>'key', 'customer_po', r.data->>'customerPo', 'job_id', coalesce(r.data->>'jobId', r.data->>'projectId'),
      'legacy_ref', case when coalesce(r.data->>'xeroRef','') ~ '^INV-' and jsonb_array_length(billed->'documents') = 0 then r.data->>'xeroRef' end,
      'net', pr->'net', 'vat', pr->'vat', 'gross', pr->'gross',
      'billed_net', coalesce((billed->>'net')::numeric, 0), 'billed_vat', coalesce((billed->>'vat')::numeric, 0), 'invoices', billed->'documents',
      'remaining_gross', round((pr->>'gross')::numeric - coalesce((billed->>'net')::numeric, 0) - coalesce((billed->>'vat')::numeric, 0), 2),
      'updated_at', r.data->>'statusUpdatedAt');
  end loop;
  for r in select data from ps_records where workspace_id = w and section = 'jobs' and deleted_at is null
              and data->'project'->>'billingMode' = 'phases' order by data->>'name' loop
    pr := ps_job_contract(w, r.data->>'id');
    billed := ps_sales_billed(w, 'job', r.data->>'id');
    c := ps_customer_info(w, r.data->>'customerId');
    jobs := jobs || (pr || jsonb_build_object('customer', c->>'name', 'customer_key', c->>'key', 'status', r.data->>'status',
      'billed_net', coalesce((billed->>'net')::numeric, 0), 'invoices', billed->'documents',
      'remaining_net', round((pr->>'contract_net')::numeric - coalesce((billed->>'net')::numeric, 0), 2)));
  end loop;
  return jsonb_build_object('orders', orders, 'jobs', jobs);
end $$;
revoke all on function public.ps_invoicing_queue(text) from public, anon;
grant execute on function public.ps_invoicing_queue(text) to authenticated;

-- What the invoice for an order will look like before it is posted (finance roles).
create or replace function public.ps_sales_order_preview(w text, order_id text)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare me uuid := ps_ledger_require_finance(w); pr jsonb; cust jsonb; billed jsonb; q jsonb;
begin
  pr := ps_sales_order_pricing(w, order_id);
  if pr is null then raise exception 'Order % not found', order_id; end if;
  cust := ps_customer_info(w, pr->>'customer_id');
  billed := ps_sales_billed(w, 'sales_order', order_id);
  select x into q from jsonb_array_elements(ps_invoicing_queue(w)->'orders') x where x->>'order_id' = order_id;
  return pr || jsonb_build_object('customer', cust, 'billed', billed, 'state', q->>'state', 'status', q->>'status',
    'remaining_net', round((pr->>'net')::numeric - coalesce((billed->>'net')::numeric, 0), 2),
    'remaining_gross', round((pr->>'gross')::numeric - coalesce((billed->>'net')::numeric, 0) - coalesce((billed->>'vat')::numeric, 0), 2),
    'terms', case when cust is null then null when (cust->>'basis') = 'pro_forma' then 'Pro forma: due on receipt'
                  when coalesce((cust->>'days')::integer, 0) = 0 then 'Due on receipt' else 'Due in ' || (cust->>'days') || ' days' end,
    'next_number', (select 'INV-' || next_value from ps_ledger_counters where workspace_id = w and doc_type = 'sales_invoice'));
end $$;
revoke all on function public.ps_sales_order_preview(text,text) from public, anon;
grant execute on function public.ps_sales_order_preview(text,text) to authenticated;

-- ---------- Raise an invoice ----------
-- p: {source: 'sales_order'|'job', id, kind: 'final'|'deposit'|'stage', invoice_date?, expected_gross? (final),
--     net?, vat_rate? (deposit/stage, default 20), description? (deposit/stage), phase_id?, customer_po?}
create or replace function public.ps_sales_invoice_create(w text, p jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare actor uuid := ps_ledger_require_finance(w); src text := p->>'source'; sid text := p->>'id'; kind text := coalesce(p->>'kind','final');
        o jsonb; pr jsonb; billed jsonb; jc jsonb; cust jsonb; inv_date date; due date; lines jsonb := '[]'::jsonb; groups jsonb := '[]'::jsonb;
        g jsonb; b jsonb; net numeric := 0; vat numeric := 0; gnet numeric; gvat numeric; rate numeric; amt numeric; cap numeric;
        posting jsonb := '[]'::jsonb; doc jsonb; num text; q jsonb;
begin
  inv_date := coalesce((p->>'invoice_date')::date, current_date);
  if inv_date > current_date then raise exception 'The invoice date cannot be in the future'; end if;
  if src = 'sales_order' then
    q := ps_invoicing_queue(w);
    select x into o from jsonb_array_elements(q->'orders') x where x->>'order_id' = sid;
    if o is null then raise exception 'Order % not found', sid; end if;
    if o->>'state' = 'before_ledger' then raise exception 'Order % was invoiced before the ledger (%); it cannot be invoiced again', sid, coalesce(o->>'legacy_ref', 'marked Invoiced'); end if;
    if o->>'state' = 'invoiced' then raise exception 'Order % is already fully invoiced (%)', sid, (select string_agg(v, ', ') from jsonb_array_elements_text(o->'invoices') v); end if;
    if o->>'state' = 'project_stages' then raise exception 'Order % belongs to a project billed by stage; invoice the project stage instead', sid; end if;
    pr := ps_sales_order_pricing(w, sid);
    billed := ps_sales_billed(w, 'sales_order', sid);
    cust := ps_customer_info(w, pr->>'customer_id');
    cap := (pr->>'net')::numeric;
  elsif src = 'job' then
    jc := ps_job_contract(w, sid);
    if jc is null then raise exception 'Project % not found', sid; end if;
    if kind = 'final' then kind := 'stage'; end if;
    billed := ps_sales_billed(w, 'job', sid);
    cust := ps_customer_info(w, jc->>'customer_id');
    cap := (jc->>'contract_net')::numeric;
  else
    raise exception 'Choose an order or a project to invoice';
  end if;
  if cust is null then raise exception 'The customer on this % is missing; fix the customer first', case when src = 'job' then 'project' else 'order' end; end if;

  if kind = 'final' then
    if o->>'state' not in ('ready') then
      raise exception 'Order % is not delivered yet (status %). Raise a deposit invoice, or invoice it once delivered', sid, coalesce(o->>'status','?');
    end if;
    lines := pr->'lines';
    -- Each VAT rate: order total less what was already invoiced (deposits) at that rate.
    for g in select value from jsonb_array_elements(pr->'groups') union all
             select jsonb_build_object('rate', x->>'rate', 'net', 0, 'vat', 0) from jsonb_array_elements(billed->'groups') x
              where not exists(select 1 from jsonb_array_elements(pr->'groups') y where (y->>'rate')::numeric = (x->>'rate')::numeric) loop
      rate := (g->>'rate')::numeric;
      select coalesce(sum((x->>'net')::numeric),0), coalesce(sum((x->>'vat')::numeric),0) into gnet, gvat
        from jsonb_array_elements(billed->'groups') x where (x->>'rate')::numeric = rate;
      if gnet <> 0 or gvat <> 0 then
        lines := lines || jsonb_build_object('description', 'Less already invoiced (' ||
                   (select string_agg(v, ', ') from jsonb_array_elements_text(billed->'documents') v) || ')',
                   'qty', 1, 'unit_net', -gnet, 'net', -gnet, 'vat_rate', rate, 'vat', -gvat, 'deduction', true);
      end if;
      groups := groups || jsonb_build_object('rate', rate, 'net', (g->>'net')::numeric - gnet, 'vat', (g->>'vat')::numeric - gvat);
    end loop;
  else
    amt := round(coalesce((p->>'net')::numeric, 0), 2);
    if amt <= 0 then raise exception 'Enter the amount to invoice (before VAT)'; end if;
    rate := coalesce((p->>'vat_rate')::numeric, 20);
    if rate not in (0, 5, 20) then raise exception 'VAT rate must be 0%%, 5%% or 20%%'; end if;
    if coalesce(trim(p->>'description'),'') = '' then raise exception 'Describe what this invoice is for (e.g. "30%% deposit" or the stage name)'; end if;
    gvat := round(amt * rate / 100, 2);
    lines := jsonb_build_array(jsonb_build_object('description', trim(p->>'description'), 'qty', 1, 'unit_net', amt, 'net', amt, 'vat_rate', rate, 'vat', gvat));
    groups := jsonb_build_array(jsonb_build_object('rate', rate, 'net', amt, 'vat', gvat));
  end if;

  select coalesce(sum((x->>'net')::numeric),0), coalesce(sum((x->>'vat')::numeric),0) into net, vat from jsonb_array_elements(groups) x;
  net := round(net, 2); vat := round(vat, 2);
  if net <= 0 then raise exception 'Nothing left to invoice on %', sid; end if;
  if round(coalesce((billed->>'net')::numeric, 0) + net, 2) > round(cap, 2) + 0.004 then
    raise exception 'This would invoice % net in total, more than the % agreed (% left to invoice)',
      round(coalesce((billed->>'net')::numeric, 0) + net, 2), round(cap, 2), round(cap - coalesce((billed->>'net')::numeric, 0), 2);
  end if;
  if kind = 'final' and p ? 'expected_gross' and abs((p->>'expected_gross')::numeric - (net + vat)) > 0.009 then
    raise exception 'Order % changed since you opened it (now % to invoice); refresh and check it again', sid, net + vat;
  end if;

  due := case when (cust->>'basis') = 'pro_forma' or coalesce((cust->>'days')::integer, 0) = 0 then inv_date else inv_date + (cust->>'days')::integer end;

  posting := jsonb_build_array(jsonb_build_object('account_role','debtors','debit',net + vat,'description',cust->>'name'));
  for g in select value from jsonb_array_elements(groups) loop
    gnet := round((g->>'net')::numeric, 2);
    if gnet > 0 then posting := posting || jsonb_build_object('account_role','sales','credit',gnet,'description','Sales at ' || (g->>'rate') || '% VAT');
    elsif gnet < 0 then posting := posting || jsonb_build_object('account_role','sales','debit',-gnet,'description','Sales at ' || (g->>'rate') || '% VAT (less deposits)'); end if;
  end loop;
  if vat > 0 then posting := posting || jsonb_build_object('account_role','vat_output','credit',vat,'description','VAT');
  elsif vat < 0 then posting := posting || jsonb_build_object('account_role','vat_output','debit',-vat,'description','VAT'); end if;

  doc := ps_ledger_post(w, jsonb_build_object('doc_type','sales_invoice','doc_date',inv_date,'due_date',due,
      'contact_type','customer','contact_key',cust->>'key','contact_name',cust->>'name',
      'reference', coalesce(nullif(p->>'customer_po',''), pr->>'customer_po', sid),
      'source_type', src, 'source_id', sid, 'net', net, 'vat', vat, 'gross', net + vat,
      'meta', jsonb_build_object('kind', kind, 'lines', lines, 'groups', groups, 'phase_id', p->>'phase_id',
                                 'customer', cust, 'customer_po', coalesce(nullif(p->>'customer_po',''), pr->>'customer_po'),
                                 'source_label', case when src = 'job' then coalesce(jc->>'name', sid) else sid end)),
    posting);
  return jsonb_build_object('id', doc->>'id', 'doc_number', doc->>'doc_number', 'net', net, 'vat', vat, 'gross', net + vat, 'due_date', due);
end $$;
revoke all on function public.ps_sales_invoice_create(text,jsonb) from public, anon;
grant execute on function public.ps_sales_invoice_create(text,jsonb) to authenticated;

-- Money a document still has open: invoices (gross - receipts/credits applied to them);
-- receipts and credit notes (gross - what has been applied or refunded from them).
create or replace function public.ps_sales_open(doc_id uuid)
returns numeric language sql stable security definer set search_path=public as $$
  select round(d.gross - case when d.doc_type = 'sales_invoice'
           then coalesce((select sum(a.amount) from ps_ledger_allocations a where a.to_document = d.id), 0)
           else coalesce((select sum(a.amount) from ps_ledger_allocations a where a.from_document = d.id), 0) end, 2)
  from ps_ledger_documents d where d.id = doc_id;
$$;
revoke all on function public.ps_sales_open(uuid) from public, anon, authenticated;

-- ---------- Credit note (returns, price corrections, cancelled work) ----------
-- p: {invoice_id, full?: true, net?, vat_rate?, reason (required), credit_date?}
create or replace function public.ps_sales_credit_create(w text, p jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare actor uuid := ps_ledger_require_finance(w); inv ps_ledger_documents; credited numeric; groups jsonb; net numeric; vat numeric;
        rate numeric; d date := coalesce((p->>'credit_date')::date, current_date); doc jsonb; apply numeric; posting jsonb; g jsonb;
begin
  select * into inv from ps_ledger_documents where id = (p->>'invoice_id')::uuid and workspace_id = w and doc_type = 'sales_invoice' and status = 'posted';
  if inv.id is null then raise exception 'Invoice not found'; end if;
  if coalesce(trim(p->>'reason'),'') = '' then raise exception 'Give the reason for the credit (e.g. returned items, price correction)'; end if;
  if d > current_date then raise exception 'The credit date cannot be in the future'; end if;
  select coalesce(sum(gross), 0) into credited from ps_ledger_documents
   where workspace_id = w and doc_type = 'sales_credit' and status = 'posted' and (meta->>'credits')::uuid = inv.id;
  if coalesce((p->>'full')::boolean, false) then
    if credited > 0 then raise exception 'Part of % is already credited; credit the rest as an amount', inv.doc_number; end if;
    groups := inv.meta->'groups';
  else
    net := round(coalesce((p->>'net')::numeric, 0), 2); rate := coalesce((p->>'vat_rate')::numeric, 20);
    if net <= 0 then raise exception 'Enter the amount to credit (before VAT)'; end if;
    if rate not in (0, 5, 20) then raise exception 'VAT rate must be 0%%, 5%% or 20%%'; end if;
    groups := jsonb_build_array(jsonb_build_object('rate', rate, 'net', net, 'vat', round(net * rate / 100, 2)));
  end if;
  select round(sum((x->>'net')::numeric), 2), round(sum((x->>'vat')::numeric), 2) into net, vat from jsonb_array_elements(groups) x;
  if credited + net + vat > inv.gross + 0.004 then
    raise exception 'Credit of % is more than is left on % (% of % already credited)', net + vat, inv.doc_number, credited, inv.gross;
  end if;
  posting := '[]'::jsonb;
  for g in select value from jsonb_array_elements(groups) loop
    if (g->>'net')::numeric > 0 then posting := posting || jsonb_build_object('account_role','sales','debit',round((g->>'net')::numeric,2),'description','Credit at ' || (g->>'rate') || '% VAT');
    elsif (g->>'net')::numeric < 0 then posting := posting || jsonb_build_object('account_role','sales','credit',-round((g->>'net')::numeric,2),'description','Credit at ' || (g->>'rate') || '% VAT'); end if;
  end loop;
  if vat > 0 then posting := posting || jsonb_build_object('account_role','vat_output','debit',vat,'description','VAT'); end if;
  posting := posting || jsonb_build_object('account_role','debtors','credit',net + vat,'description',inv.contact_name);
  doc := ps_ledger_post(w, jsonb_build_object('doc_type','sales_credit','doc_date',d,'contact_type','customer','contact_key',inv.contact_key,
      'contact_name',inv.contact_name,'reference',inv.doc_number,'source_type',inv.source_type,'source_id',inv.source_id,
      'net',net,'vat',vat,'gross',net + vat,'reason',trim(p->>'reason'),
      'meta', jsonb_build_object('credits', inv.id, 'groups', groups, 'customer', inv.meta->'customer',
                                 'lines', case when coalesce((p->>'full')::boolean, false) then inv.meta->'lines'
                                   else jsonb_build_array(jsonb_build_object('description', 'Credit against ' || inv.doc_number || ': ' || trim(p->>'reason'),
                                   'qty', 1, 'unit_net', net, 'net', net, 'vat_rate', rate, 'vat', vat)) end)),
    posting);
  apply := least(net + vat, ps_sales_open(inv.id));
  if apply > 0 then
    insert into ps_ledger_allocations(workspace_id, from_document, to_document, amount, created_by) values (w, (doc->>'id')::uuid, inv.id, apply, actor);
  end if;
  return jsonb_build_object('id', doc->>'id', 'doc_number', doc->>'doc_number', 'gross', net + vat, 'applied', apply,
                            'customer_credit', net + vat - apply);
end $$;
revoke all on function public.ps_sales_credit_create(text,jsonb) from public, anon;
grant execute on function public.ps_sales_credit_create(text,jsonb) to authenticated;

-- ---------- Customer payment ----------
-- p: {customer_key, amount, date?, method, reference?, allocations: [{document_id, amount}]}
-- Anything not allocated stays on the customer's account as credit (e.g. paid before the invoice).
create or replace function public.ps_customer_receipt_record(w text, p jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare actor uuid := ps_ledger_require_finance(w); cust record; amt numeric := round(coalesce((p->>'amount')::numeric, 0), 2);
        d date := coalesce((p->>'date')::date, current_date); doc jsonb; a jsonb; inv ps_ledger_documents; used numeric := 0; x numeric;
begin
  select r.key, ps_customer_info(w, r.data->>'id') info into cust from ps_records r
   where r.workspace_id = w and r.section = 'customers' and r.deleted_at is null and r.key = p->>'customer_key';
  if cust.key is null then raise exception 'Choose the customer'; end if;
  if amt <= 0 then raise exception 'Enter the amount received'; end if;
  if d > current_date then raise exception 'The payment date cannot be in the future'; end if;
  if coalesce(p->>'method','') not in ('bank_transfer','card','cash','cheque','other') then raise exception 'Choose how it was paid'; end if;
  doc := ps_ledger_post(w, jsonb_build_object('doc_type','customer_receipt','doc_date',d,'contact_type','customer','contact_key',cust.key,
      'contact_name',cust.info->>'name','reference',nullif(trim(p->>'reference'),''),'gross',amt,
      'meta', jsonb_build_object('method', p->>'method')),
    jsonb_build_array(jsonb_build_object('account_role','bank','debit',amt,'description',cust.info->>'name'),
                      jsonb_build_object('account_role','debtors','credit',amt,'description','Payment received')));
  for a in select value from jsonb_array_elements(coalesce(p->'allocations','[]'::jsonb)) loop
    x := round(coalesce((a->>'amount')::numeric, 0), 2);
    continue when x <= 0;
    select * into inv from ps_ledger_documents where id = (a->>'document_id')::uuid and workspace_id = w and doc_type = 'sales_invoice' and status = 'posted';
    if inv.id is null or inv.contact_key <> cust.key then raise exception 'That invoice is not one of this customer''s'; end if;
    if x > ps_sales_open(inv.id) then raise exception '% has only % left to pay', inv.doc_number, ps_sales_open(inv.id); end if;
    used := used + x;
    if used > amt then raise exception 'The amounts applied (%) are more than the payment (%)', used, amt; end if;
    insert into ps_ledger_allocations(workspace_id, from_document, to_document, amount, created_by) values (w, (doc->>'id')::uuid, inv.id, x, actor);
  end loop;
  return jsonb_build_object('id', doc->>'id', 'doc_number', doc->>'doc_number', 'applied', used, 'on_account', amt - used);
end $$;
revoke all on function public.ps_customer_receipt_record(text,jsonb) from public, anon;
grant execute on function public.ps_customer_receipt_record(text,jsonb) to authenticated;

-- Apply money already on a customer's account (an earlier payment or a credit note) to one of their invoices.
create or replace function public.ps_customer_apply_credit(w text, from_doc uuid, to_doc uuid, amount numeric)
returns jsonb language plpgsql security definer set search_path=public as $$
declare actor uuid := ps_ledger_require_finance(w); f ps_ledger_documents; t ps_ledger_documents; x numeric := round(coalesce(amount,0), 2);
begin
  select * into f from ps_ledger_documents where id = from_doc and workspace_id = w and doc_type in ('customer_receipt','sales_credit') and status = 'posted';
  select * into t from ps_ledger_documents where id = to_doc and workspace_id = w and doc_type = 'sales_invoice' and status = 'posted';
  if f.id is null or t.id is null or f.contact_key is distinct from t.contact_key then raise exception 'Choose a payment or credit and an invoice for the same customer'; end if;
  if x <= 0 or x > ps_sales_open(f.id) or x > ps_sales_open(t.id) then
    raise exception 'You can apply up to % (% has % unused; % has % to pay)', least(ps_sales_open(f.id), ps_sales_open(t.id)), f.doc_number, ps_sales_open(f.id), t.doc_number, ps_sales_open(t.id);
  end if;
  insert into ps_ledger_allocations(workspace_id, from_document, to_document, amount, created_by) values (w, f.id, t.id, x, actor);
  return jsonb_build_object('applied', x, 'invoice_left', ps_sales_open(t.id));
end $$;
revoke all on function public.ps_customer_apply_credit(text,uuid,uuid,numeric) from public, anon;
grant execute on function public.ps_customer_apply_credit(text,uuid,uuid,numeric) to authenticated;

-- Refund money a customer has on account (unused payment or credit note) back to them.
create or replace function public.ps_customer_refund(w text, from_doc uuid, amount numeric, method text, reference text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare actor uuid := ps_ledger_require_finance(w); f ps_ledger_documents; x numeric := round(coalesce(amount,0), 2); doc jsonb;
begin
  if coalesce((ps_user_access()->>'restricted')::boolean, true) then raise exception 'Only Admin or Management can refund customers'; end if;
  select * into f from ps_ledger_documents where id = from_doc and workspace_id = w and doc_type in ('customer_receipt','sales_credit') and status = 'posted';
  if f.id is null then raise exception 'Choose the payment or credit note to refund'; end if;
  if x <= 0 or x > ps_sales_open(f.id) then raise exception 'You can refund up to % from %', ps_sales_open(f.id), f.doc_number; end if;
  if coalesce(method,'') not in ('bank_transfer','card','cash','cheque','other') then raise exception 'Choose how the refund was paid'; end if;
  doc := ps_ledger_post(w, jsonb_build_object('doc_type','manual_journal','doc_date',current_date,'contact_type','customer','contact_key',f.contact_key,
      'contact_name',f.contact_name,'reference','Refund of ' || f.doc_number,'source_type','customer_refund','source_id',f.id::text,'gross',x,
      'reason','Customer refund','meta',jsonb_build_object('method',method,'refund_reference',reference,'refunds',f.id)),
    jsonb_build_array(jsonb_build_object('account_role','debtors','debit',x,'description','Refund of ' || f.doc_number),
                      jsonb_build_object('account_role','bank','credit',x,'description',f.contact_name)));
  insert into ps_ledger_allocations(workspace_id, from_document, to_document, amount, created_by) values (w, f.id, (doc->>'id')::uuid, x, actor);
  return jsonb_build_object('id', doc->>'id', 'doc_number', doc->>'doc_number', 'refunded', x);
end $$;
revoke all on function public.ps_customer_refund(text,uuid,numeric,text,text) from public, anon;
grant execute on function public.ps_customer_refund(text,uuid,numeric,text,text) to authenticated;

-- ---------- Lists and reports ----------
create or replace function public.ps_sales_documents_list(w text, max_rows integer default 300)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare me uuid := ps_ledger_require_finance(w);
begin
  return coalesce((select jsonb_agg(x order by x->>'doc_date' desc, x->>'doc_number' desc) from (
    select jsonb_build_object('id', d.id, 'doc_type', d.doc_type, 'doc_number', d.doc_number, 'doc_date', d.doc_date, 'due_date', d.due_date,
      'customer', d.contact_name, 'customer_key', d.contact_key, 'reference', d.reference, 'source_type', d.source_type, 'source_id', d.source_id,
      'kind', d.meta->>'kind', 'net', d.net, 'vat', d.vat, 'gross', d.gross, 'open', ps_sales_open(d.id), 'reason', d.reason,
      'opening', coalesce((d.meta->>'opening')::boolean, false), 'method', d.meta->>'method',
      'state', case when d.doc_type <> 'sales_invoice' then case when ps_sales_open(d.id) > 0 then 'unused' else 'used' end
                    when ps_sales_open(d.id) <= 0 then 'paid'
                    when coalesce(d.due_date, d.doc_date) < current_date then 'overdue'
                    when ps_sales_open(d.id) < d.gross then 'part_paid' else 'unpaid' end,
      'days_overdue', greatest(0, current_date - coalesce(d.due_date, d.doc_date)),
      'last_sent', (select jsonb_build_object('to', s.sent_to, 'at', s.sent_at) from ps_sales_invoice_sends s where s.document_id = d.id order by s.sent_at desc limit 1),
      'xero_status', d.xero_status) x
    from ps_ledger_documents d
    where d.workspace_id = w and d.status = 'posted' and d.doc_type in ('sales_invoice','sales_credit','customer_receipt')
    order by d.doc_date desc, d.created_at desc limit max_rows) s), '[]'::jsonb);
end $$;
revoke all on function public.ps_sales_documents_list(text,integer) from public, anon;
grant execute on function public.ps_sales_documents_list(text,integer) to authenticated;

-- Aged debtors: what each customer owes, by how late it is, less money they have on account.
create or replace function public.ps_aged_debtors(w text, as_of date default current_date)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare me uuid := ps_ledger_require_finance(w);
begin
  return coalesce((select jsonb_agg(row_to_json(t)::jsonb order by t.total desc) from (
    select d.contact_key as customer_key, max(d.contact_name) as customer,
      round(sum(case when d.doc_type = 'sales_invoice' and coalesce(d.due_date, d.doc_date) >= as_of then ps_sales_open(d.id) else 0 end), 2) as not_due,
      round(sum(case when d.doc_type = 'sales_invoice' and as_of - coalesce(d.due_date, d.doc_date) between 1 and 30 then ps_sales_open(d.id) else 0 end), 2) as d1_30,
      round(sum(case when d.doc_type = 'sales_invoice' and as_of - coalesce(d.due_date, d.doc_date) between 31 and 60 then ps_sales_open(d.id) else 0 end), 2) as d31_60,
      round(sum(case when d.doc_type = 'sales_invoice' and as_of - coalesce(d.due_date, d.doc_date) between 61 and 90 then ps_sales_open(d.id) else 0 end), 2) as d61_90,
      round(sum(case when d.doc_type = 'sales_invoice' and as_of - coalesce(d.due_date, d.doc_date) > 90 then ps_sales_open(d.id) else 0 end), 2) as d90_plus,
      round(sum(case when d.doc_type <> 'sales_invoice' then ps_sales_open(d.id) else 0 end), 2) as on_account,
      round(sum(case when d.doc_type = 'sales_invoice' then ps_sales_open(d.id) else -ps_sales_open(d.id) end), 2) as total
    from ps_ledger_documents d
    where d.workspace_id = w and d.status = 'posted' and d.doc_type in ('sales_invoice','sales_credit','customer_receipt') and d.doc_date <= as_of
    group by d.contact_key
    having round(sum(case when d.doc_type = 'sales_invoice' then ps_sales_open(d.id) else ps_sales_open(d.id) end), 2) <> 0) t), '[]'::jsonb);
end $$;
revoke all on function public.ps_aged_debtors(text,date) from public, anon;
grant execute on function public.ps_aged_debtors(text,date) to authenticated;

-- One invoice or credit note with everything needed to show, print or email it.
create or replace function public.ps_sales_invoice_get(w text, doc_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare me uuid := ps_ledger_require_finance(w); d ps_ledger_documents; s ps_ledger_settings; company jsonb;
begin
  select * into d from ps_ledger_documents where id = doc_id and workspace_id = w and status = 'posted' and doc_type in ('sales_invoice','sales_credit');
  if d.id is null then raise exception 'Invoice not found'; end if;
  select * into s from ps_ledger_settings where workspace_id = w;
  select data->'companySettings' into company from workspace_snapshots where workspace_id = w;
  return jsonb_build_object('id', d.id, 'doc_type', d.doc_type, 'doc_number', d.doc_number, 'doc_date', d.doc_date, 'due_date', d.due_date,
    'reference', d.reference, 'customer_po', d.meta->>'customer_po', 'source_type', d.source_type, 'source_id', d.source_id,
    'source_label', d.meta->>'source_label', 'kind', d.meta->>'kind', 'reason', d.reason,
    'customer', coalesce(d.meta->'customer', jsonb_build_object('name', d.contact_name)) ||
                coalesce((select jsonb_build_object('email', ps_customer_info(w, r.data->>'id')->>'email') from ps_records r
                           where r.workspace_id = w and r.section = 'customers' and r.key = d.contact_key), '{}'::jsonb),
    'lines', coalesce(d.meta->'lines', '[]'::jsonb), 'groups', coalesce(d.meta->'groups', '[]'::jsonb),
    'net', d.net, 'vat', d.vat, 'gross', d.gross, 'open', ps_sales_open(d.id),
    'payments', coalesce((select jsonb_agg(jsonb_build_object('doc_number', f.doc_number, 'doc_type', f.doc_type, 'date', f.doc_date, 'amount', a.amount) order by f.doc_date)
                 from ps_ledger_allocations a join ps_ledger_documents f on f.id = a.from_document where a.to_document = d.id), '[]'::jsonb),
    'credits_invoice', (select jsonb_build_object('doc_number', i.doc_number, 'doc_date', i.doc_date) from ps_ledger_documents i where i.id = (d.meta->>'credits')::uuid),
    'sends', coalesce((select jsonb_agg(jsonb_build_object('to', x.sent_to, 'at', x.sent_at) order by x.sent_at desc) from ps_sales_invoice_sends x where x.document_id = d.id), '[]'::jsonb),
    'company', jsonb_build_object('name', company->>'name', 'email', company->>'email', 'phone', company->>'phone', 'address', company->>'address',
                                  'website', company->>'website') || coalesce(s.invoice_profile, '{}'::jsonb),
    'emails_on', coalesce((select enabled from ps_feature_flags where name = 'invoice_emails'), false));
end $$;
revoke all on function public.ps_sales_invoice_get(text,uuid) from public, anon;
grant execute on function public.ps_sales_invoice_get(text,uuid) to authenticated;

-- Invoice details (legal and payment): read by finance roles, changed by Admin or Management.
create or replace function public.ps_invoice_profile_get(w text)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare me uuid := ps_ledger_require_finance(w); p jsonb; company jsonb; missing text[] := '{}';
begin
  select coalesce(invoice_profile, '{}'::jsonb) into p from ps_ledger_settings where workspace_id = w;
  select data->'companySettings' into company from workspace_snapshots where workspace_id = w;
  p := coalesce(p, '{}'::jsonb);
  if coalesce(trim(p->>'vat_number'),'') = '' then missing := array_append(missing, 'VAT registration number'::text); end if;
  if coalesce(trim(p->>'bank_name'),'') = '' or coalesce(trim(p->>'sort_code'),'') = '' or coalesce(trim(p->>'account_number'),'') = '' then
    missing := array_append(missing, 'Bank details (bank, sort code, account number)'::text); end if;
  if coalesce(trim(p->>'legal_name'), trim(company->>'name'), '') = '' then missing := array_append(missing, 'Company name'::text); end if;
  if coalesce(trim(company->>'address'), '') = '' and coalesce(trim(p->>'address'), '') = '' then missing := array_append(missing, 'Company address'::text); end if;
  return jsonb_build_object('profile', p, 'company', jsonb_build_object('name', company->>'name', 'address', company->>'address',
           'email', company->>'email', 'phone', company->>'phone'), 'missing', to_jsonb(missing),
         'can_edit', not coalesce((ps_user_access()->>'restricted')::boolean, true),
         'emails_on', coalesce((select enabled from ps_feature_flags where name = 'invoice_emails'), false));
end $$;
revoke all on function public.ps_invoice_profile_get(text) from public, anon;
grant execute on function public.ps_invoice_profile_get(text) to authenticated;

create or replace function public.ps_invoice_profile_save(w text, p jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare me uuid := ps_ledger_require_finance(w); clean jsonb := '{}'::jsonb; k text;
begin
  if coalesce((ps_user_access()->>'restricted')::boolean, true) then raise exception 'Only Admin or Management can change the invoice details'; end if;
  foreach k in array array['legal_name','address','vat_number','company_number','bank_name','account_name','sort_code','account_number','iban','payment_note','footer'] loop
    if p ? k then clean := clean || jsonb_build_object(k, left(trim(coalesce(p->>k, '')), 600)); end if;
  end loop;
  if coalesce(clean->>'vat_number','') <> '' and upper(replace(clean->>'vat_number',' ','')) !~ '^(GB)?([0-9]{9}|[0-9]{12})$' then
    raise exception 'That VAT number does not look right (GB followed by 9 digits)'; end if;
  if coalesce(clean->>'sort_code','') <> '' and regexp_replace(clean->>'sort_code','[^0-9]','','g') !~ '^[0-9]{6}$' then
    raise exception 'The sort code should be 6 digits'; end if;
  if coalesce(clean->>'account_number','') <> '' and regexp_replace(clean->>'account_number','[^0-9]','','g') !~ '^[0-9]{8}$' then
    raise exception 'The account number should be 8 digits'; end if;
  insert into ps_ledger_settings(workspace_id, invoice_profile) values (w, clean)
  on conflict (workspace_id) do update set invoice_profile = ps_ledger_settings.invoice_profile || clean, updated_at = now();
  return ps_invoice_profile_get(w);
end $$;
revoke all on function public.ps_invoice_profile_save(text,jsonb) from public, anon;
grant execute on function public.ps_invoice_profile_save(text,jsonb) to authenticated;

-- Record that an invoice was emailed (called by the server after the email provider accepts it, with the user's own sign-in).
create or replace function public.ps_sales_invoice_sent(w text, doc_id uuid, sent_to text, provider_id text default null)
returns void language plpgsql security definer set search_path=public as $$
declare me uuid := ps_ledger_require_finance(w);
begin
  if not exists(select 1 from ps_ledger_documents where id = doc_id and workspace_id = w and doc_type in ('sales_invoice','sales_credit') and status = 'posted') then
    raise exception 'Invoice not found'; end if;
  insert into ps_sales_invoice_sends(workspace_id, document_id, sent_to, sent_by, provider_id) values (w, doc_id, left(sent_to, 300), me, provider_id);
end $$;
revoke all on function public.ps_sales_invoice_sent(text,uuid,text,text) from public, anon;
grant execute on function public.ps_sales_invoice_sent(text,uuid,text,text) to authenticated;

-- Opening balances: customers' unpaid invoices on the go-live date (from Xero's Aged Receivables). Never sent back to Xero.
-- rows: [{customer_key, invoice_number, invoice_date, due_date, outstanding_gross}]
create or replace function public.ps_opening_customer_invoices(w text, as_of date, rows jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare me uuid := ps_ledger_require_finance(w); r jsonb; c jsonb; doc jsonb; n integer := 0; total numeric := 0; problems text[] := '{}'; amt numeric;
begin
  if coalesce((ps_user_access()->>'restricted')::boolean, true) then raise exception 'Only Admin or Management can load opening balances'; end if;
  for r in select value from jsonb_array_elements(rows) loop
    c := ps_customer_info(w, regexp_replace(coalesce(r->>'customer_key',''), '^id:', ''));
    amt := round(coalesce((r->>'outstanding_gross')::numeric, 0), 2);
    if c is null then problems := array_append(problems, ('Unknown customer ' || coalesce(r->>'customer_key','?'))::text); continue; end if;
    if amt <= 0 then problems := array_append(problems, ('No amount for ' || coalesce(r->>'invoice_number','?'))::text); continue; end if;
    if exists(select 1 from ps_ledger_documents d where d.workspace_id = w and d.doc_type = 'sales_invoice' and d.source_type = 'opening'
              and lower(d.source_id) = lower(trim(r->>'invoice_number'))) then
      problems := array_append(problems, ('Already loaded: ' || (r->>'invoice_number'))::text); continue; end if;
    doc := ps_ledger_post(w, jsonb_build_object('doc_type','sales_invoice','doc_date', as_of, 'due_date', coalesce((r->>'due_date')::date, as_of),
        'contact_type','customer','contact_key',c->>'key','contact_name',c->>'name','reference',r->>'invoice_number',
        'source_type','opening','source_id', trim(r->>'invoice_number'), 'net', amt, 'vat', 0, 'gross', amt,
        'meta', jsonb_build_object('opening', true, 'original_invoice_date', r->>'invoice_date', 'customer', c, 'groups', '[]'::jsonb,
                                   'lines', jsonb_build_array(jsonb_build_object('description', 'Opening balance: ' || (r->>'invoice_number') || ' (from Xero)', 'qty', 1, 'net', amt, 'vat', 0)))),
      jsonb_build_array(jsonb_build_object('account_role','debtors','debit',amt,'description','Opening balance'),
                        jsonb_build_object('account_code','3999','credit',amt,'description','Opening balance')));
    update ps_ledger_documents set xero_status = 'not_required' where id = (doc->>'id')::uuid;
    n := n + 1; total := total + amt;
  end loop;
  return jsonb_build_object('loaded', n, 'total', total, 'problems', to_jsonb(problems));
end $$;
revoke all on function public.ps_opening_customer_invoices(text,date,jsonb) from public, anon;
grant execute on function public.ps_opening_customer_invoices(text,date,jsonb) to authenticated;

commit;
