-- Pool Shed v1.61.0 — project stage invoices on the Pool Shed ledger (blueprint step 7).
-- 1. Each project stage shows the ledger invoices raised against it (less any credit notes).
-- 2. A stage that is already invoiced (and not credited back) cannot be invoiced a second time.
-- 3. ps_job_billing: one project's stage invoices with what is paid and still open, for the project page.
-- Nothing existing is changed or removed: the contract value, the total-billed limit and every document stay as they were.

-- Net still billed for one stage: its invoices less the credit notes raised against them.
create or replace function public.ps_job_phase_billed(w text, job_id text, phase_id text)
returns jsonb language sql stable security definer set search_path=public as $$
  select jsonb_build_object(
    'net', round(coalesce(sum(i.net - coalesce((select sum(c.net) from ps_ledger_documents c
              where c.workspace_id = w and c.doc_type = 'sales_credit' and c.status = 'posted' and (c.meta->>'credits')::uuid = i.id), 0)), 0), 2),
    'documents', coalesce(jsonb_agg(i.doc_number order by i.doc_date, i.doc_number), '[]'::jsonb))
  from ps_ledger_documents i
  where i.workspace_id = w and i.doc_type = 'sales_invoice' and i.status = 'posted'
    and i.source_type = 'job' and i.source_id = job_id and i.meta->>'phase_id' = phase_id;
$$;
revoke all on function public.ps_job_phase_billed(text,text,text) from public, anon, authenticated;

-- Contract value of a project billed by stage (unchanged), with each stage's ledger invoices added.
create or replace function public.ps_job_contract(w text, job_id text)
returns jsonb language sql stable security definer set search_path=public as $$
  select jsonb_build_object('job_id', r.data->>'id', 'name', r.data->>'name', 'customer_id', r.data->>'customerId',
    'billing_mode', coalesce(r.data->'project'->>'billingMode', 'orders'),
    'contract_net', coalesce(ps_num(r.data->'project'->'quoteNet'), 0)
       + coalesce((select sum(coalesce(ps_num(v->'sellNet'), 0)) from jsonb_array_elements(case when jsonb_typeof(r.data->'project'->'variations') = 'array'
                    then r.data->'project'->'variations' else '[]'::jsonb end) v where v->>'status' = 'Approved'), 0),
    'phases', coalesce((select jsonb_agg(jsonb_build_object('id', ph->>'id', 'name', ph->>'name', 'amount_net', ps_num(ph->'amountNet'), 'status', ph->>'status',
                         'billed_net', (b->>'net')::numeric, 'invoices', b->'documents'))
                 from jsonb_array_elements(case when jsonb_typeof(r.data->'project'->'phases') = 'array' then r.data->'project'->'phases' else '[]'::jsonb end) ph,
                      lateral ps_job_phase_billed(w, r.data->>'id', ph->>'id') b), '[]'::jsonb))
  from ps_records r where r.workspace_id = w and r.section = 'jobs' and r.deleted_at is null and r.key = 'id:' || job_id;
$$;
revoke all on function public.ps_job_contract(text,text) from public, anon, authenticated;

-- Refuse a second invoice for a stage that is still billed. Credit the first invoice to bill the stage again.
create or replace function public.ps_job_phase_guard()
returns trigger language plpgsql security definer set search_path=public as $$
declare b jsonb;
begin
  if new.doc_type = 'sales_invoice' and new.source_type = 'job' and coalesce(new.meta->>'phase_id', '') <> '' then
    b := ps_job_phase_billed(new.workspace_id, new.source_id, new.meta->>'phase_id');
    if (b->>'net')::numeric > 0 then
      raise exception 'This stage is already invoiced (%). Credit that invoice first if it needs raising again',
        (select string_agg(v, ', ') from jsonb_array_elements_text(b->'documents') v);
    end if;
  end if;
  return new;
end $$;
revoke all on function public.ps_job_phase_guard() from public, anon, authenticated;
drop trigger if exists ps_job_phase_guard on public.ps_ledger_documents;
create trigger ps_job_phase_guard before insert on public.ps_ledger_documents
  for each row execute function public.ps_job_phase_guard();

-- One project's ledger billing, for the project page: contract, billed, paid, open, and each invoice.
create or replace function public.ps_job_billing(w text, job_id text)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare me uuid := ps_ledger_require_finance(w); jc jsonb; docs jsonb;
begin
  jc := ps_job_contract(w, job_id);
  if jc is null then raise exception 'Project % not found', job_id; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id', d.id, 'doc_number', d.doc_number, 'doc_type', d.doc_type, 'date', d.doc_date, 'due_date', d.due_date,
           'phase_id', d.meta->>'phase_id', 'kind', d.meta->>'kind',
           'description', coalesce(d.meta->'lines'->0->>'description', ''),
           'net', case when d.doc_type = 'sales_credit' then -d.net else d.net end,
           'gross', case when d.doc_type = 'sales_credit' then -d.gross else d.gross end,
           'open', case when d.doc_type = 'sales_invoice' then ps_sales_open(d.id) else 0 end) order by d.doc_date, d.doc_number), '[]'::jsonb)
    into docs
    from ps_ledger_documents d
   where d.workspace_id = w and d.status = 'posted'
     and ((d.doc_type = 'sales_invoice' and d.source_type = 'job' and d.source_id = job_id)
       or (d.doc_type = 'sales_credit' and exists(select 1 from ps_ledger_documents i where i.id = (d.meta->>'credits')::uuid
             and i.source_type = 'job' and i.source_id = job_id)));
  return jc || jsonb_build_object('documents', docs,
    'billed_net', round(coalesce((select sum((x->>'net')::numeric) from jsonb_array_elements(docs) x), 0), 2),
    'billed_gross', round(coalesce((select sum((x->>'gross')::numeric) from jsonb_array_elements(docs) x), 0), 2),
    'open_gross', round(coalesce((select sum((x->>'open')::numeric) from jsonb_array_elements(docs) x), 0), 2));
end $$;
revoke all on function public.ps_job_billing(text,text) from public, anon;
grant execute on function public.ps_job_billing(text,text) to authenticated;
