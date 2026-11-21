-- O3 sales invoicing proof. STAGING ONLY. Everything rolls back.
begin;
select set_config('ps.a', (select id::text from user_profiles where role='Admin' order by email limit 1), true) is not null;
select set_config('ps.b', (select id::text from user_profiles where role='Admin' order by email desc limit 1), true) is not null;
create or replace function pg_temp.as_user(u text) returns void language sql as $$ select set_config('request.jwt.claims', json_build_object('sub',u,'role','authenticated')::text, true) $$;
do $$
declare q jsonb; o jsonb; ready_id text; wip_id text; old_id text; job jsonb; r jsonb; r2 jsonb; dep jsonb; fin jsonb; cr jsonb; rc jsonb; ag jsonb;
        a text := current_setting('ps.a'); b text := current_setting('ps.b'); price jsonb; tb record; inv_id uuid; cust text;
begin
  perform pg_temp.as_user(a);
  q := ps_invoicing_queue('pool-bros-main');
  raise notice '1 queue: %', (select string_agg(s||'='||c, ', ') from (select x->>'state' s, count(*) c from jsonb_array_elements(q->'orders') x group by 1 order by 1) t);
  raise notice '1 projects billed by stage: %', jsonb_array_length(q->'jobs');
  select x->>'order_id' into ready_id from jsonb_array_elements(q->'orders') x where x->>'state'='ready' and (x->>'net')::numeric > 0 order by x->>'order_id' limit 1;
  -- A second delivered order is put back to "Needs Review" (inside this rolled-back test) to act as not delivered yet.
  select x->>'order_id' into wip_id from jsonb_array_elements(q->'orders') x where x->>'state'='ready' and x->>'order_id' <> ready_id and (x->>'net')::numeric > 100 order by x->>'order_id' limit 1;
  update ps_records set data = jsonb_set(data, '{status}', '"Needs Review"') where section='salesOrders' and key='id:'||wip_id;
  select x->>'order_id' into old_id from jsonb_array_elements(q->'orders') x where x->>'state'='before_ledger' limit 1;
  raise notice '  using: ready %, not delivered %, invoiced before ledger %', ready_id, wip_id, old_id;

  -- 2. Only finance roles.
  update user_profiles set role='Sales' where id = b::uuid;
  perform pg_temp.as_user(b);
  begin perform ps_invoicing_queue('pool-bros-main'); raise notice '2 FAIL'; exception when others then raise notice '2 Sales refused: %', sqlerrm; end;
  perform pg_temp.as_user(a);
  update user_profiles set role='Admin' where id = b::uuid;

  -- 3. Final invoice for a delivered order: number, totals = order, due on receipt; stale total refused first.
  price := ps_sales_order_pricing('pool-bros-main', ready_id);
  begin perform ps_sales_invoice_create('pool-bros-main', jsonb_build_object('source','sales_order','id',ready_id,'kind','final','expected_gross',(price->>'gross')::numeric + 1));
        raise notice '3 FAIL'; exception when others then raise notice '3a changed order refused: %', sqlerrm; end;
  r := ps_sales_invoice_create('pool-bros-main', jsonb_build_object('source','sales_order','id',ready_id,'kind','final','expected_gross',price->'gross'));
  raise notice '3 invoice % gross % (order %), due % (today %)', r->>'doc_number', r->>'gross', price->>'gross', r->>'due_date', current_date;
  inv_id := (r->>'id')::uuid;
  begin perform ps_sales_invoice_create('pool-bros-main', jsonb_build_object('source','sales_order','id',ready_id,'kind','final'));
        raise notice '4 FAIL'; exception when others then raise notice '4 second invoice refused: %', sqlerrm; end;
  if old_id is not null then
    begin perform ps_sales_invoice_create('pool-bros-main', jsonb_build_object('source','sales_order','id',old_id,'kind','final'));
          raise notice '5 FAIL'; exception when others then raise notice '5 invoiced-before-ledger refused: %', sqlerrm; end;
  end if;

  -- 6. Order not delivered: final refused; deposit allowed; too much refused; once delivered the final invoice deducts the deposit.
  if wip_id is not null then
    price := ps_sales_order_pricing('pool-bros-main', wip_id);
    begin perform ps_sales_invoice_create('pool-bros-main', jsonb_build_object('source','sales_order','id',wip_id,'kind','final'));
          raise notice '6 FAIL'; exception when others then raise notice '6a not delivered refused: %', sqlerrm; end;
    begin perform ps_sales_invoice_create('pool-bros-main', jsonb_build_object('source','sales_order','id',wip_id,'kind','deposit','net',100,'vat_rate',20));
          raise notice '6 FAIL'; exception when others then raise notice '6b deposit without description refused: %', sqlerrm; end;
    dep := ps_sales_invoice_create('pool-bros-main', jsonb_build_object('source','sales_order','id',wip_id,'kind','deposit',
             'net', round((price->>'net')::numeric * 0.3, 2), 'vat_rate', 20, 'description', '30% deposit'));
    raise notice '6c deposit % net % gross %', dep->>'doc_number', dep->>'net', dep->>'gross';
    begin perform ps_sales_invoice_create('pool-bros-main', jsonb_build_object('source','sales_order','id',wip_id,'kind','deposit','net',(price->>'net')::numeric,'description','too much'));
          raise notice '6 FAIL'; exception when others then raise notice '6d over the order refused: %', sqlerrm; end;
    update ps_records set data = jsonb_set(data, '{status}', '"Shipped"') where section='salesOrders' and key='id:'||wip_id;
    fin := ps_sales_invoice_create('pool-bros-main', jsonb_build_object('source','sales_order','id',wip_id,'kind','final'));
    raise notice '6e final % net % (order net % less deposit %) lines %', fin->>'doc_number', fin->>'net', price->>'net', dep->>'net',
      (select jsonb_array_length(meta->'lines') from ps_ledger_documents where id=(fin->>'id')::uuid);
    raise notice '6f order state now: %', (select x->>'state' from jsonb_array_elements(ps_invoicing_queue('pool-bros-main')->'orders') x where x->>'order_id'=wip_id);
    -- The screen then marks the order Invoiced with the ledger number: it must still count as invoiced in the ledger, not "before the ledger".
    update ps_records set data = data || jsonb_build_object('status','Invoiced','xeroRef',fin->>'doc_number','invoiceSource','Ledger') where section='salesOrders' and key='id:'||wip_id;
    raise notice '6g after marking the order Invoiced: %', (select x->>'state' from jsonb_array_elements(ps_invoicing_queue('pool-bros-main')->'orders') x where x->>'order_id'=wip_id);
  end if;

  -- 7. Project stage invoice within the contract; over the contract refused.
  select x into job from jsonb_array_elements(q->'jobs') x order by (x->>'contract_net')::numeric desc limit 1;
  if job is not null then
    r2 := ps_sales_invoice_create('pool-bros-main', jsonb_build_object('source','job','id',job->>'job_id','kind','stage','net',1000,'vat_rate',20,'description','Stage 1: excavation'));
    raise notice '7 stage invoice % gross % (contract net %)', r2->>'doc_number', r2->>'gross', job->>'contract_net';
    begin perform ps_sales_invoice_create('pool-bros-main', jsonb_build_object('source','job','id',job->>'job_id','net',(job->>'contract_net')::numeric,'description','too much'));
          raise notice '7 FAIL'; exception when others then raise notice '7b over the contract refused: %', sqlerrm; end;
  end if;

  -- 8. Credit notes: reason required; partial credit; more than left refused.
  begin perform ps_sales_credit_create('pool-bros-main', jsonb_build_object('invoice_id',inv_id,'net',5)); raise notice '8 FAIL';
        exception when others then raise notice '8a credit without reason refused: %', sqlerrm; end;
  cr := ps_sales_credit_create('pool-bros-main', jsonb_build_object('invoice_id',inv_id,'net',10,'vat_rate',20,'reason','One item returned'));
  raise notice '8b credit % gross % applied %', cr->>'doc_number', cr->>'gross', cr->>'applied';
  begin perform ps_sales_credit_create('pool-bros-main', jsonb_build_object('invoice_id',inv_id,'net',999999,'reason','x')); raise notice '8 FAIL';
        exception when others then raise notice '8c too much refused: %', sqlerrm; end;

  -- 9. Customer payment: over-allocation refused; part applied, rest on account; then applied; refund.
  select contact_key into cust from ps_ledger_documents where id = inv_id;
  begin perform ps_customer_receipt_record('pool-bros-main', jsonb_build_object('customer_key',cust,'amount',50,'method','bank_transfer',
          'allocations', jsonb_build_array(jsonb_build_object('document_id',inv_id,'amount',999999)))); raise notice '9 FAIL';
        exception when others then raise notice '9a over-allocation refused: %', sqlerrm; end;
  rc := ps_customer_receipt_record('pool-bros-main', jsonb_build_object('customer_key',cust,'amount',ps_sales_open(inv_id) + 25,'method','bank_transfer','reference','BACS test',
          'allocations', jsonb_build_array(jsonb_build_object('document_id',inv_id,'amount',ps_sales_open(inv_id)))));
  raise notice '9b receipt % applied % on account %; invoice open now %', rc->>'doc_number', rc->>'applied', rc->>'on_account', ps_sales_open(inv_id);
  raise notice '9c invoice state: %', (select x->>'state' from jsonb_array_elements(ps_sales_documents_list('pool-bros-main')) x where x->>'id' = inv_id::text);
  raise notice '9d refund 25: %', ps_customer_refund('pool-bros-main', (rc->>'id')::uuid, 25, 'bank_transfer', 'test')->>'doc_number';
  begin perform ps_customer_refund('pool-bros-main', (rc->>'id')::uuid, 1, 'bank_transfer'); raise notice '9 FAIL';
        exception when others then raise notice '9e refunding more than is on account refused: %', sqlerrm; end;

  -- 10. Aged debtors and the books.
  ag := ps_aged_debtors('pool-bros-main');
  raise notice '10 aged debtors: % customers, total owed %', jsonb_array_length(ag), (select sum((x->>'total')::numeric) from jsonb_array_elements(ag) x);
  select sum(debit) d, sum(credit) c into tb from ps_ledger_lines l join ps_ledger_documents d on d.id=l.document_id where d.workspace_id='pool-bros-main' and d.status='posted';
  raise notice '10 books balance: debits % credits % difference %', tb.d, tb.c, tb.d - tb.c;

  -- 11. Posted invoices cannot be changed.
  begin update ps_ledger_documents set meta = meta || '{"kind":"x"}' where id = inv_id; raise notice '11 FAIL';
        exception when others then raise notice '11 editing a posted invoice refused: %', sqlerrm; end;

  -- 12. Invoice details: checks, then saved; what is still missing.
  begin perform ps_invoice_profile_save('pool-bros-main', '{"vat_number":"12345"}'); raise notice '12 FAIL';
        exception when others then raise notice '12a bad VAT number refused: %', sqlerrm; end;
  raise notice '12b missing before: %', ps_invoice_profile_get('pool-bros-main')->'missing';
  raise notice '12c missing after: %', ps_invoice_profile_save('pool-bros-main', '{"vat_number":"GB 123 4567 89","bank_name":"Test Bank","sort_code":"12-34-56","account_number":"12345678"}')->'missing';
  raise notice '12d invoice for printing: % lines, company %, customer %', jsonb_array_length(ps_sales_invoice_get('pool-bros-main', inv_id)->'lines'),
    ps_sales_invoice_get('pool-bros-main', inv_id)->'company'->>'vat_number', ps_sales_invoice_get('pool-bros-main', inv_id)->'customer'->>'name';
  perform ps_sales_invoice_sent('pool-bros-main', inv_id, 'customer@example.test', 'test');
  raise notice '12e emailed recorded: %', ps_sales_invoice_get('pool-bros-main', inv_id)->'sends'->0->>'to';
end $$;
rollback;
