-- Xero hand-off proof (ready, not linked). STAGING ONLY. Everything rolls back.
begin;
select set_config('request.jwt.claims', json_build_object('sub',(select id from user_profiles where role='Admin' order by email limit 1),'role','authenticated')::text, true) is not null;
do $$ declare r jsonb; o record; ob jsonb; begin
  raise notice '0 send switch xero_push: %', (select enabled from ps_feature_flags where name='xero_push');
  r := ps_xero_prepare_all('pool-bros-main'); raise notice '1 prepared: %', r;
  for o in select * from ps_xero_outbox_list('pool-bros-main') loop
    raise notice '  % % % state=% problems=%', o.doc_number, o.kind, o.contact, o.state, array_to_string(o.problems, ' | ');
  end loop;
  raise notice '2 sample bill payload: %', (select left(payload::text, 600) from ps_xero_outbox where kind='bill' limit 1);
  -- Confirm codes and match contacts (as would happen at link time), then re-prepare.
  perform ps_xero_account_confirm('pool-bros-main', a.code, a.xero_code) from ps_ledger_accounts a where a.workspace_id='pool-bros-main' and a.xero_code is not null;
  insert into ps_xero_contact_map(workspace_id, contact_type, contact_key, xero_contact_id, xero_name)
    select 'pool-bros-main','supplier', k, gen_random_uuid(), n
    from (select contact_key k, min(contact_name) n from ps_ledger_documents where contact_type='supplier' group by contact_key) x;
  r := ps_xero_prepare_all('pool-bros-main'); raise notice '3 after confirming codes and contacts: %', r;
  for o in select * from ps_xero_outbox_list('pool-bros-main') loop
    raise notice '  % % state=% problems=%', o.doc_number, o.kind, o.state, array_to_string(o.problems, ' | ');
  end loop;
  -- Opening balances: recorded, payable, never sent to Xero.
  ob := ps_opening_supplier_bills('pool-bros-main', current_date, jsonb_build_array(
          jsonb_build_object('supplier_key','name:Arrow Plant Hire','supplier_invoice_no','XERO-OPEN-1','invoice_date', current_date-20,'due_date', current_date+10,'outstanding_gross', 960),
          jsonb_build_object('supplier_key','name:Nobody','supplier_invoice_no','X','outstanding_gross', 1)));
  raise notice '4 opening balances: %', ob;
  r := ps_xero_prepare_all('pool-bros-main');
  raise notice '4b opening bill xero_status: %, in outbox: %', (select xero_status from ps_ledger_documents where reference='XERO-OPEN-1'),
    exists(select 1 from ps_xero_outbox xo join ps_ledger_documents dd on dd.id=xo.document_id where dd.reference='XERO-OPEN-1');
  raise notice '4c opening bill payable in a run (due by +14d): %', (select ready from ps_payment_candidates('pool-bros-main', current_date+14) where supplier_invoice_no='XERO-OPEN-1');
  raise notice '5 trial balance: %', (select sum(balance) from ps_ledger_trial_balance('pool-bros-main'));
end $$;
rollback;
select '6 staff can read outbox directly: '||has_table_privilege('authenticated','public.ps_xero_outbox','select');
