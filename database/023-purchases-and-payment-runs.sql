-- Pool Shed 023 - Operations O1/O2: record purchases and pay suppliers, with tight controls (owner, 20 Nov 2026).
--   Pro-forma suppliers: paid up front, so a purchase is only complete with its payment recorded.
--   On-account suppliers: due date from the supplier's terms (e.g. "Net 30"); credit limit checked.
--   Supplier invoice number required and unique per supplier; job or cost category required;
--   a receipt or invoice copy is required before anything can be paid;
--   purchases at or above the approval threshold need Admin or Management approval before payment;
--   payment runs contain only approved, attached, on-account, due bills, and must themselves be approved;
--   paying a run posts the supplier payments and settles each bill. Corrections are credit notes (022 rules).
-- Requires 015 (supplier records in ps_records) and 022 (ledger). Additive; no workspace data is changed.
begin;

create table if not exists public.ps_ledger_settings (
  workspace_id text primary key,
  approval_threshold numeric(14,2) not null default 1000,
  require_attachment boolean not null default true,
  ledger_start_date date,
  updated_at timestamptz not null default now()
);
insert into public.ps_ledger_settings(workspace_id) values ('pool-bros-main') on conflict do nothing;

create table if not exists public.ps_purchase_controls (
  document_id uuid primary key references public.ps_ledger_documents(id),
  workspace_id text not null,
  supplier_invoice_no text not null,
  job_id text,
  category text,
  payment_basis text not null check (payment_basis in ('pro_forma','on_account')),
  attachment_ref text,
  approval_status text not null check (approval_status in ('not_required','pending','approved','rejected')),
  approved_by uuid,
  approved_at timestamptz,
  rejected_reason text,
  updated_at timestamptz not null default now()
);
-- One supplier invoice number per supplier is enforced in ps_purchase_record (supplier lives on the document).
create index if not exists ps_purchase_controls_invoice on public.ps_purchase_controls(workspace_id, lower(supplier_invoice_no));

create table if not exists public.ps_payment_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null,
  run_number text not null,
  status text not null default 'draft' check (status in ('draft','approved','paid','cancelled')),
  pay_date date not null,
  method text not null default 'bank_transfer',
  total numeric(14,2) not null default 0,
  created_by uuid, created_at timestamptz not null default now(),
  approved_by uuid, approved_at timestamptz,
  paid_by uuid, paid_at timestamptz,
  unique (workspace_id, run_number)
);
create table if not exists public.ps_payment_run_items (
  run_id uuid not null references public.ps_payment_runs(id),
  document_id uuid not null references public.ps_ledger_documents(id),
  amount numeric(14,2) not null check (amount > 0),
  primary key (run_id, document_id)
);

alter table public.ps_ledger_settings enable row level security;
alter table public.ps_purchase_controls enable row level security;
alter table public.ps_payment_runs enable row level security;
alter table public.ps_payment_run_items enable row level security;
revoke all on public.ps_ledger_settings, public.ps_purchase_controls, public.ps_payment_runs, public.ps_payment_run_items from anon, authenticated;

-- Supplier facts from the live supplier record: payment basis, terms in days, credit limit.
create or replace function public.ps_supplier_terms(w text, supplier_key text)
returns jsonb language sql stable security definer set search_path=public as $$
  select jsonb_build_object(
    'key', r.key,
    'name', r.data->>'name',
    'basis', case when lower(coalesce(r.data->>'accountType','')) like 'pro%forma%' then 'pro_forma' else 'on_account' end,
    'days', coalesce(nullif(substring(coalesce(r.data->>'terms','') from '([0-9]+)'), '')::integer, 30),
    'end_of_month', coalesce(r.data->>'terms','') ~* 'eom|end of month',
    'credit_limit', nullif(r.data->>'creditLimit','')::numeric)
  from ps_records r
  where r.workspace_id = w and r.section = 'suppliers' and r.deleted_at is null and r.key = supplier_key;
$$;
revoke all on function public.ps_supplier_terms(text,text) from public, anon, authenticated;

-- What is still owed on a bill (gross minus payments and credits allocated to it).
create or replace function public.ps_document_outstanding(doc_id uuid)
returns numeric language sql stable security definer set search_path=public as $$
  select round(d.gross - coalesce((select sum(a.amount) from ps_ledger_allocations a where a.to_document = d.id), 0), 2)
  from ps_ledger_documents d where d.id = doc_id;
$$;
revoke all on function public.ps_document_outstanding(uuid) from public, anon, authenticated;

-- Record a purchase (the main route for things already bought).
-- p: {supplier_key, supplier_invoice_no, invoice_date, job_id?, category?, net, vat, description,
--     attachment_ref?, paid?: {method, reference, date}}
create or replace function public.ps_purchase_record(w text, p jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare actor uuid := ps_ledger_require_finance(w); t jsonb; s ps_ledger_settings; net numeric; vat numeric; gross numeric;
        inv_date date; due date; doc jsonb; pay jsonb := null; approval text; debit_role text; owed numeric;
begin
  select * into s from ps_ledger_settings where workspace_id = w;
  t := ps_supplier_terms(w, p->>'supplier_key');
  if t is null then raise exception 'Choose a supplier from the supplier list'; end if;
  if coalesce(trim(p->>'supplier_invoice_no'), '') = '' then raise exception 'The supplier invoice or receipt number is required'; end if;
  if exists(select 1 from ps_purchase_controls c join ps_ledger_documents d on d.id = c.document_id
            where c.workspace_id = w and d.contact_key = t->>'key' and d.doc_type = 'purchase_invoice'
              and lower(trim(c.supplier_invoice_no)) = lower(trim(p->>'supplier_invoice_no'))) then
    raise exception 'Invoice % from % is already recorded', p->>'supplier_invoice_no', t->>'name';
  end if;
  if coalesce(p->>'job_id', '') = '' and coalesce(p->>'category', '') = '' then raise exception 'Choose the job, or a cost category for overheads'; end if;
  net := round(coalesce((p->>'net')::numeric, 0), 2); vat := round(coalesce((p->>'vat')::numeric, 0), 2); gross := net + vat;
  if net <= 0 or vat < 0 then raise exception 'Enter the net amount (and VAT, or 0)'; end if;
  if vat > round(net * 0.2, 2) + 0.05 then raise exception 'VAT is more than 20%% of the net amount; check the invoice'; end if;
  inv_date := coalesce((p->>'invoice_date')::date, current_date);
  if inv_date > current_date then raise exception 'The invoice date cannot be in the future'; end if;
  if (t->>'basis') = 'pro_forma' and p->'paid' is null then
    raise exception '% is a pro-forma supplier (paid up front): record how and when it was paid', t->>'name';
  end if;
  due := case when (t->>'basis') = 'pro_forma' then inv_date
              when (t->>'end_of_month')::boolean then (date_trunc('month', inv_date) + interval '1 month - 1 day')::date + (t->>'days')::integer
              else inv_date + (t->>'days')::integer end;
  approval := case when net >= s.approval_threshold then 'pending' else 'not_required' end;
  debit_role := case when coalesce(p->>'job_id', '') <> '' then 'wip' else 'direct_purchases' end;

  doc := ps_ledger_post(w, jsonb_build_object('doc_type','purchase_invoice','doc_date',inv_date,'due_date',due,
      'contact_type','supplier','contact_key',t->>'key','contact_name',t->>'name','reference',p->>'supplier_invoice_no',
      'source_type', case when coalesce(p->>'job_id','') <> '' then 'job' else 'category' end,
      'source_id', coalesce(nullif(p->>'job_id',''), p->>'category'),
      'net',net,'vat',vat,'gross',gross,'meta',jsonb_build_object('description',p->>'description','category',p->>'category')),
    jsonb_build_array(jsonb_build_object('account_role',debit_role,'debit',net,'description',coalesce(p->>'description','Purchase')))
    || case when vat > 0 then jsonb_build_array(jsonb_build_object('account_role','vat_input','debit',vat,'description','VAT')) else '[]'::jsonb end
    || jsonb_build_array(jsonb_build_object('account_role','creditors','credit',gross,'description',t->>'name')));
  insert into ps_purchase_controls(document_id, workspace_id, supplier_invoice_no, job_id, category, payment_basis, attachment_ref, approval_status)
  values ((doc->>'id')::uuid, w, trim(p->>'supplier_invoice_no'), nullif(p->>'job_id',''), nullif(p->>'category',''), t->>'basis',
          nullif(p->>'attachment_ref',''), approval);

  if p->'paid' is not null then   -- paid at purchase (card, cash, pro-forma transfer)
    pay := ps_ledger_post(w, jsonb_build_object('doc_type','supplier_payment','doc_date',coalesce((p->'paid'->>'date')::date, inv_date),
        'contact_type','supplier','contact_key',t->>'key','contact_name',t->>'name',
        'reference',coalesce(p->'paid'->>'reference', p->>'supplier_invoice_no'),'gross',gross,
        'meta',jsonb_build_object('method',coalesce(p->'paid'->>'method','card'))),
      jsonb_build_array(jsonb_build_object('account_role','creditors','debit',gross,'description','Paid: '||(p->>'supplier_invoice_no')),
                        jsonb_build_object('account_role','bank','credit',gross,'description',t->>'name')));
    insert into ps_ledger_allocations(workspace_id, from_document, to_document, amount, created_by)
    values (w, (pay->>'id')::uuid, (doc->>'id')::uuid, gross, actor);
  end if;

  select coalesce(sum(ps_document_outstanding(d.id)),0) into owed from ps_ledger_documents d
   where d.workspace_id = w and d.contact_key = t->>'key' and d.doc_type = 'purchase_invoice' and d.status = 'posted';
  return jsonb_build_object('document', doc, 'payment', pay, 'due_date', due, 'approval', approval,
    'over_credit_limit', (t->>'credit_limit') is not null and owed > (t->>'credit_limit')::numeric, 'owed_to_supplier', owed);
end $$;
revoke all on function public.ps_purchase_record(text,jsonb) from public, anon;
grant execute on function public.ps_purchase_record(text,jsonb) to authenticated;

-- Approve or reject a purchase that needs approval: Admin or Management only, and not the person who recorded it.
create or replace function public.ps_purchase_approve(w text, doc_id uuid, approve boolean, reason text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare actor uuid := ps_ledger_require_finance(w); c ps_purchase_controls; creator uuid;
begin
  if coalesce((ps_user_access()->>'restricted')::boolean, true) then raise exception 'Only Admin or Management can approve purchases'; end if;
  select * into c from ps_purchase_controls where document_id = doc_id and workspace_id = w;
  if c.document_id is null or c.approval_status <> 'pending' then raise exception 'This purchase is not waiting for approval'; end if;
  select created_by into creator from ps_ledger_documents where id = doc_id;
  if creator = actor then raise exception 'A different person must approve a purchase you recorded'; end if;
  if not approve and coalesce(trim(reason),'') = '' then raise exception 'Give a reason for rejecting'; end if;
  update ps_purchase_controls set approval_status = case when approve then 'approved' else 'rejected' end,
         approved_by = actor, approved_at = now(), rejected_reason = case when approve then null else reason end, updated_at = now()
   where document_id = doc_id;
  return jsonb_build_object('approval', case when approve then 'approved' else 'rejected' end);
end $$;
revoke all on function public.ps_purchase_approve(text,uuid,boolean,text) from public, anon;
grant execute on function public.ps_purchase_approve(text,uuid,boolean,text) to authenticated;

create or replace function public.ps_purchase_attach(w text, doc_id uuid, p_ref text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare actor uuid := ps_ledger_require_finance(w);
begin
  if coalesce(trim(p_ref),'') = '' then raise exception 'Choose the receipt or invoice file'; end if;
  update ps_purchase_controls c set attachment_ref = p_ref, updated_at = now() where c.document_id = doc_id and c.workspace_id = w;
  if not found then raise exception 'Purchase not found'; end if;
  return jsonb_build_object('attached', true);
end $$;
revoke all on function public.ps_purchase_attach(text,uuid,text) from public, anon;
grant execute on function public.ps_purchase_attach(text,uuid,text) to authenticated;

-- What can go in a payment run on a date, and what is held back (with the reason).
create or replace function public.ps_payment_candidates(w text, up_to date default current_date)
returns table(document_id uuid, doc_number text, supplier text, supplier_invoice_no text, due_date date, outstanding numeric, ready boolean, held_reason text)
language plpgsql stable security definer set search_path=public as $$
begin
  perform ps_ledger_require_finance(w);
  return query
  select d.id, d.doc_number, d.contact_name, c.supplier_invoice_no, d.due_date, ps_document_outstanding(d.id),
         (c.approval_status in ('approved','not_required') and (c.attachment_ref is not null or not s.require_attachment)
          and not exists(select 1 from ps_payment_run_items i join ps_payment_runs r on r.id = i.run_id
                         where i.document_id = d.id and r.status in ('draft','approved'))),
         case when c.approval_status = 'pending' then 'Waiting for approval'
              when c.approval_status = 'rejected' then 'Rejected: ' || coalesce(c.rejected_reason,'')
              when c.attachment_ref is null and s.require_attachment then 'Invoice copy missing'
              when exists(select 1 from ps_payment_run_items i join ps_payment_runs r on r.id = i.run_id
                          where i.document_id = d.id and r.status in ('draft','approved')) then 'Already in a payment run'
              else null end
  from ps_ledger_documents d
  join ps_purchase_controls c on c.document_id = d.id
  join ps_ledger_settings s on s.workspace_id = w
  where d.workspace_id = w and d.doc_type = 'purchase_invoice' and d.status = 'posted'
    and c.payment_basis = 'on_account' and d.due_date <= up_to and ps_document_outstanding(d.id) > 0
  order by d.due_date, d.contact_name;
end $$;
revoke all on function public.ps_payment_candidates(text,date) from public, anon;
grant execute on function public.ps_payment_candidates(text,date) to authenticated;

-- Create a draft payment run from chosen bills (only ready ones; full outstanding amounts).
create or replace function public.ps_payment_run_create(w text, pay_date date, document_ids uuid[], method text default 'bank_transfer')
returns jsonb language plpgsql security definer set search_path=public as $$
declare actor uuid := ps_ledger_require_finance(w); v_run uuid; v_num text; bad text;
begin
  if coalesce(cardinality(document_ids),0) = 0 then raise exception 'Choose at least one bill'; end if;
  select string_agg(coalesce(c.doc_number, d.doc_number, 'unknown bill') || ' (' || coalesce(c.held_reason,
           case when d.id is null then 'not found' when ps_document_outstanding(d.id) <= 0 then 'already paid'
                when exists(select 1 from ps_purchase_controls pc where pc.document_id = d.id and pc.payment_basis = 'pro_forma') then 'pro-forma, paid up front'
                else 'not due yet' end) || ')', ', ')
    into bad
    from unnest(document_ids) x
    left join ps_payment_candidates(w, pay_date) c on c.document_id = x
    left join ps_ledger_documents d on d.id = x and d.workspace_id = w
   where c.document_id is null or not c.ready;
  if bad is not null then raise exception 'These bills cannot be paid in this run: %', bad; end if;
  v_num := 'RUN-' || split_part(ps_ledger_next_number(w, 'payment_run'), '-', 2);
  insert into ps_payment_runs(workspace_id, run_number, pay_date, method, created_by) values (w, v_num, pay_date, method, actor)
  returning id into v_run;
  insert into ps_payment_run_items(run_id, document_id, amount) select v_run, x, ps_document_outstanding(x) from unnest(document_ids) x;
  update ps_payment_runs pr set total = (select sum(i.amount) from ps_payment_run_items i where i.run_id = v_run) where pr.id = v_run;
  return jsonb_build_object('run_id', v_run, 'run_number', v_num);
end $$;
revoke all on function public.ps_payment_run_create(text,date,uuid[],text) from public, anon;
grant execute on function public.ps_payment_run_create(text,date,uuid[],text) to authenticated;

-- Approve a run: Admin or Management, and not the person who created it.
create or replace function public.ps_payment_run_approve(w text, run uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare actor uuid := ps_ledger_require_finance(w); r ps_payment_runs;
begin
  if coalesce((ps_user_access()->>'restricted')::boolean, true) then raise exception 'Only Admin or Management can approve a payment run'; end if;
  select * into r from ps_payment_runs where id = run and workspace_id = w;
  if r.id is null or r.status <> 'draft' then raise exception 'This payment run is not waiting for approval'; end if;
  if r.created_by = actor then raise exception 'A different person must approve a payment run you created'; end if;
  update ps_payment_runs set status = 'approved', approved_by = actor, approved_at = now() where id = run;
  return jsonb_build_object('status', 'approved');
end $$;
revoke all on function public.ps_payment_run_approve(text,uuid) from public, anon;
grant execute on function public.ps_payment_run_approve(text,uuid) to authenticated;

-- Mark an approved run as paid: one supplier payment per supplier, allocated to each bill.
create or replace function public.ps_payment_run_pay(w text, run uuid, paid_date date default current_date)
returns jsonb language plpgsql security definer set search_path=public as $$
declare actor uuid := ps_ledger_require_finance(w); r ps_payment_runs; sup record; pay jsonb; n integer := 0;
begin
  select * into r from ps_payment_runs where id = run and workspace_id = w for update;
  if r.id is null or r.status <> 'approved' then raise exception 'Only an approved payment run can be marked paid'; end if;
  for sup in
    select d.contact_key, d.contact_name, sum(i.amount) amount, array_agg(i.document_id) docs, array_agg(i.amount) amounts
    from ps_payment_run_items i join ps_ledger_documents d on d.id = i.document_id
    where i.run_id = run group by d.contact_key, d.contact_name
  loop
    pay := ps_ledger_post(w, jsonb_build_object('doc_type','supplier_payment','doc_date',paid_date,'contact_type','supplier',
        'contact_key',sup.contact_key,'contact_name',sup.contact_name,'reference',r.run_number,'gross',sup.amount,
        'source_type','payment_run','source_id',r.id::text,'meta',jsonb_build_object('method',r.method)),
      jsonb_build_array(jsonb_build_object('account_role','creditors','debit',sup.amount,'description',r.run_number),
                        jsonb_build_object('account_role','bank','credit',sup.amount,'description',sup.contact_name)));
    insert into ps_ledger_allocations(workspace_id, from_document, to_document, amount, created_by)
    select w, (pay->>'id')::uuid, x.doc, x.amt, actor from unnest(sup.docs, sup.amounts) x(doc, amt);
    n := n + 1;
  end loop;
  update ps_payment_runs set status = 'paid', paid_by = actor, paid_at = now() where id = run;
  return jsonb_build_object('status','paid','supplier_payments',n,'total',r.total);
end $$;
revoke all on function public.ps_payment_run_pay(text,uuid,date) from public, anon;
grant execute on function public.ps_payment_run_pay(text,uuid,date) to authenticated;

commit;
