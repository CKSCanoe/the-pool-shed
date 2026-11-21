-- Pool Shed 032 - customer account and statement from the ledger (blueprint step 5, owner 21 Nov 2026).
-- One customer's money in one place: what they owe and how late, every invoice, credit note, payment and refund,
-- and a statement (opening balance, each transaction with a running balance, closing balance) for any period.
-- Worked out from the trade debtors lines of posted documents, so it always agrees with the ledger.
-- Finance roles only (Admin, Management, Accounts). Read-only; additive. Requires 022 and 029.
begin;

create or replace function public.ps_customer_account(w text, customer_key text, period_from date default null, period_to date default null)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare me uuid := ps_ledger_require_finance(w); debt text; f date; t date; c jsonb; opening numeric; closing numeric;
begin
  select code into debt from ps_ledger_accounts where workspace_id = w and system_role = 'debtors';
  t := coalesce(period_to, current_date);
  f := coalesce(period_from, (t - interval '90 days')::date);
  if f > t then raise exception 'The statement must start on or before its end date'; end if;
  c := ps_customer_info(w, regexp_replace(coalesce(customer_key, ''), '^id:', ''));
  if c is null then raise exception 'Customer not found'; end if;

  select coalesce(sum(l.debit - l.credit), 0) into opening
    from ps_ledger_lines l join ps_ledger_documents d on d.id = l.document_id
   where d.workspace_id = w and d.status = 'posted' and d.contact_key = c->>'key' and l.account_code = debt and d.doc_date < f;
  select coalesce(sum(l.debit - l.credit), 0) into closing
    from ps_ledger_lines l join ps_ledger_documents d on d.id = l.document_id
   where d.workspace_id = w and d.status = 'posted' and d.contact_key = c->>'key' and l.account_code = debt and d.doc_date <= t;

  return jsonb_build_object(
    'customer', c,
    'terms', case when (c->>'basis') = 'pro_forma' then 'Pro forma: due on receipt' when coalesce((c->>'days')::integer, 0) = 0 then 'Due on receipt' else 'Due in ' || (c->>'days') || ' days' end,
    'balance', (select coalesce(sum(l.debit - l.credit), 0) from ps_ledger_lines l join ps_ledger_documents d on d.id = l.document_id
                 where d.workspace_id = w and d.status = 'posted' and d.contact_key = c->>'key' and l.account_code = debt),
    'aged', coalesce((select x from jsonb_array_elements(ps_aged_debtors(w)) x where x->>'customer_key' = c->>'key'), '{}'::jsonb),
    'documents', coalesce((select jsonb_agg(jsonb_build_object('id', d.id, 'doc_type', d.doc_type, 'doc_number', d.doc_number, 'doc_date', d.doc_date,
                    'due_date', d.due_date, 'reference', d.reference, 'source_id', d.source_id, 'gross', d.gross,
                    'open', case when d.doc_type in ('sales_invoice','sales_credit','customer_receipt') then ps_sales_open(d.id) end,
                    'overdue', d.doc_type = 'sales_invoice' and ps_sales_open(d.id) > 0 and coalesce(d.due_date, d.doc_date) < current_date)
                  order by d.doc_date desc, d.created_at desc)
                 from ps_ledger_documents d
                where d.workspace_id = w and d.status = 'posted' and d.contact_key = c->>'key'
                  and (d.doc_type in ('sales_invoice','sales_credit','customer_receipt') or d.source_type = 'customer_refund')), '[]'::jsonb),
    'statement', jsonb_build_object('from', f, 'to', t, 'opening', opening, 'closing', closing,
      'lines', coalesce((
        select jsonb_agg(jsonb_build_object('date', x.doc_date, 'doc_number', x.doc_number, 'doc_type', x.doc_type, 'reference', x.reference,
                 'due_date', x.due_date, 'debit', x.debit, 'credit', x.credit, 'balance', x.balance)
                 order by x.doc_date, x.created_at, x.doc_number)
          from (select g.*, opening + sum(g.debit - g.credit) over (order by g.doc_date, g.created_at, g.doc_number rows unbounded preceding) balance
                  from (select d.doc_date, d.created_at, d.doc_number, d.doc_type, d.reference, d.due_date,
                               sum(l.debit) debit, sum(l.credit) credit
                          from ps_ledger_lines l join ps_ledger_documents d on d.id = l.document_id
                         where d.workspace_id = w and d.status = 'posted' and d.contact_key = c->>'key' and l.account_code = debt
                           and d.doc_date between f and t
                         group by d.id, d.doc_date, d.created_at, d.doc_number, d.doc_type, d.reference, d.due_date) g) x), '[]'::jsonb)));
end $$;
revoke all on function public.ps_customer_account(text,text,date,date) from public, anon;
grant execute on function public.ps_customer_account(text,text,date,date) to authenticated;

commit;
