-- Project stage billing (033): stage shows its invoice, second invoice for the same stage refused, credit frees it,
-- other stages still bill, ps_job_billing totals, numbering unchanged afterwards. Applies 033 inside the transaction. Rolls back.
begin;
\i database/033-project-stage-billing.sql
select set_config('ps.a', (select id::text from user_profiles where role='Admin' order by email limit 1), true) is not null;
create or replace function pg_temp.as_user(u text) returns void language sql as $$ select set_config('request.jwt.claims', json_build_object('sub',u,'role','authenticated')::text, true) $$;
do $$
declare a text := current_setting('ps.a'); cust text; jc jsonb; x jsonb; y jsonb; b jsonb; n0 bigint;
begin
  perform pg_temp.as_user(a);
  select next_value into n0 from ps_ledger_counters where workspace_id = 'pool-bros-main' and doc_type = 'sales_invoice';
  select data->>'id' into cust from ps_records where workspace_id = 'pool-bros-main' and section = 'customers' and deleted_at is null and coalesce(data->>'name','') <> '' limit 1;
  insert into ps_records(workspace_id, section, key, ord, data, hash) values ('pool-bros-main', 'jobs', 'id:ZZ-JOB-033', 99999,
    jsonb_build_object('id', 'ZZ-JOB-033', 'name', 'Test pool build', 'customerId', cust, 'status', 'Open',
      'project', jsonb_build_object('billingMode', 'phases', 'quoteNet', 10000, 'variations', jsonb_build_array(jsonb_build_object('id','V1','status','Approved','sellNet',500)),
        'phases', jsonb_build_array(jsonb_build_object('id','P1','name','Deposit','amountNet',3000), jsonb_build_object('id','P2','name','Shell','amountNet',4000)))), 'x');
  jc := ps_job_contract('pool-bros-main', 'ZZ-JOB-033');
  raise notice '1 contract % (10000 + 500 approved), stage P1 billed %', jc->>'contract_net', jc->'phases'->0->>'billed_net';
  x := ps_sales_invoice_create('pool-bros-main', jsonb_build_object('source','job','id','ZZ-JOB-033','kind','stage','net',3000,'vat_rate',20,'description','Deposit','phase_id','P1'));
  raise notice '2 stage P1 invoiced: % gross %', x->>'doc_number', x->>'gross';
  jc := ps_job_contract('pool-bros-main', 'ZZ-JOB-033');
  raise notice '3 P1 now shows billed % on %', jc->'phases'->0->>'billed_net', jc->'phases'->0->'invoices';
  begin perform ps_sales_invoice_create('pool-bros-main', jsonb_build_object('source','job','id','ZZ-JOB-033','kind','stage','net',100,'vat_rate',20,'description','Deposit again','phase_id','P1'));
    raise notice '4 FAIL second invoice allowed'; exception when others then raise notice '4 second invoice for P1 refused: %', sqlerrm; end;
  y := ps_sales_invoice_create('pool-bros-main', jsonb_build_object('source','job','id','ZZ-JOB-033','kind','stage','net',4000,'vat_rate',20,'description','Shell','phase_id','P2'));
  raise notice '5 other stage P2 still bills: %', y->>'doc_number';
  perform ps_sales_credit_create('pool-bros-main', jsonb_build_object('invoice_id', x->>'id', 'full', true, 'reason', 'test'));
  jc := ps_job_contract('pool-bros-main', 'ZZ-JOB-033');
  raise notice '6 after full credit P1 billed %', jc->'phases'->0->>'billed_net';
  x := ps_sales_invoice_create('pool-bros-main', jsonb_build_object('source','job','id','ZZ-JOB-033','kind','stage','net',3000,'vat_rate',20,'description','Deposit (reissued)','phase_id','P1'));
  raise notice '7 P1 re-invoiced after credit: %', x->>'doc_number';
  b := ps_job_billing('pool-bros-main', 'ZZ-JOB-033');
  raise notice '8 billing: % documents, billed net % (expect 7000), gross %, open %', jsonb_array_length(b->'documents'), b->>'billed_net', b->>'billed_gross', b->>'open_gross';
  begin perform ps_sales_invoice_create('pool-bros-main', jsonb_build_object('source','job','id','ZZ-JOB-033','kind','stage','net',4000,'vat_rate',20,'description','Too much'));
    raise notice '9 FAIL over contract'; exception when others then raise notice '9 contract limit still applies: %', sqlerrm; end;
  perform set_config('request.jwt.claims', '', true);
  begin perform ps_job_billing('pool-bros-main', 'ZZ-JOB-033'); raise notice '10 FAIL anon'; exception when others then raise notice '10 no user refused: %', sqlerrm; end;
  raise notice '11 counter before % (rolled back with the test)', n0;
end $$;
rollback;
select '12 counter after rollback: INV-' || next_value from ps_ledger_counters where workspace_id = 'pool-bros-main' and doc_type = 'sales_invoice';
