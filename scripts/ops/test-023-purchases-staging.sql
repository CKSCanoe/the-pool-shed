-- O1/O2 purchases and payment runs proof. STAGING ONLY. Everything rolls back.
begin;
select set_config('ps.a', (select id::text from user_profiles where role='Admin' order by email limit 1), true) is not null;
select set_config('ps.b', (select id::text from user_profiles where role='Admin' order by email desc limit 1), true) is not null;
select set_config('ps.credit_sup', (select key from ps_records where section='suppliers' and deleted_at is null and coalesce(data->>'accountType','') not ilike 'pro%' limit 1), true) is not null;
select set_config('ps.proforma_sup', coalesce((select key from ps_records where section='suppliers' and deleted_at is null and data->>'accountType' ilike 'pro%forma%' limit 1),''), true) is not null;
create or replace function pg_temp.as_user(u text) returns void language sql as $$ select set_config('request.jwt.claims', json_build_object('sub',u,'role','authenticated')::text, true) $$;
do $$
declare r jsonb; big jsonb; run jsonb; c record; a text := current_setting('ps.a'); b text := current_setting('ps.b');
        cs text := current_setting('ps.credit_sup'); pf text := current_setting('ps.proforma_sup'); ok boolean; tb numeric;
begin
  perform pg_temp.as_user(a);
  raise notice 'suppliers: on-account % / pro-forma %', cs, coalesce(nullif(pf,''),'(none on staging)');
  -- 1. On-account purchase against a job.
  r := ps_purchase_record('pool-bros-main', jsonb_build_object('supplier_key',cs,'supplier_invoice_no','INV-1001','invoice_date',current_date - 35,
        'job_id','#2741','net',200,'vat',40,'description','Blocks and sand'));
  raise notice '1 on-account: % due % approval % | ready for payment? %', r->'document'->>'doc_number', r->>'due_date', r->>'approval',
    (select ready::text||' / '||coalesce(held_reason,'') from ps_payment_candidates('pool-bros-main') where document_id=(r->'document'->>'id')::uuid);
  -- 2. Duplicate invoice number from the same supplier.
  begin perform ps_purchase_record('pool-bros-main', jsonb_build_object('supplier_key',cs,'supplier_invoice_no','inv-1001 ','job_id','#2741','net',10,'vat',2));
        raise notice '2 FAIL'; exception when others then raise notice '2 duplicate refused: %', sqlerrm; end;
  -- 3. Missing job/category, VAT over 20%, future date.
  begin perform ps_purchase_record('pool-bros-main', jsonb_build_object('supplier_key',cs,'supplier_invoice_no','X1','net',10,'vat',2)); raise notice '3 FAIL';
        exception when others then raise notice '3a no job/category refused: %', sqlerrm; end;
  begin perform ps_purchase_record('pool-bros-main', jsonb_build_object('supplier_key',cs,'supplier_invoice_no','X2','category','Fuel','net',10,'vat',5)); raise notice '3 FAIL';
        exception when others then raise notice '3b VAT over 20%% refused'; end;
  begin perform ps_purchase_record('pool-bros-main', jsonb_build_object('supplier_key',cs,'supplier_invoice_no','X3','category','Fuel','net',10,'vat',2,'invoice_date',current_date+1)); raise notice '3 FAIL';
        exception when others then raise notice '3c future date refused'; end;
  -- 4. Pro-forma supplier must be paid up front.
  if pf <> '' then
    begin perform ps_purchase_record('pool-bros-main', jsonb_build_object('supplier_key',pf,'supplier_invoice_no','PF-1','job_id','#2741','net',100,'vat',20)); raise notice '4 FAIL';
          exception when others then raise notice '4a pro-forma unpaid refused: %', sqlerrm; end;
    r := ps_purchase_record('pool-bros-main', jsonb_build_object('supplier_key',pf,'supplier_invoice_no','PF-2','job_id','#2741','net',100,'vat',20,
          'paid',jsonb_build_object('method','bank_transfer','reference','PF2-PAY')));
    raise notice '4b pro-forma paid: % + payment %, still owed %', r->'document'->>'doc_number', r->'payment'->>'doc_number', ps_document_outstanding((r->'document'->>'id')::uuid);
  end if;
  -- 5. Large purchase needs approval by someone else.
  big := ps_purchase_record('pool-bros-main', jsonb_build_object('supplier_key',cs,'supplier_invoice_no','INV-2002','invoice_date',current_date - 40,
          'job_id','#2741','net',1500,'vat',300,'attachment_ref','media:test-invoice.pdf'));
  raise notice '5 large purchase approval: %', big->>'approval';
  begin perform ps_purchase_approve('pool-bros-main', (big->'document'->>'id')::uuid, true); raise notice '5 FAIL';
        exception when others then raise notice '5a self-approval refused: %', sqlerrm; end;
  perform pg_temp.as_user(b);
  perform ps_purchase_approve('pool-bros-main', (big->'document'->>'id')::uuid, true);
  raise notice '5b approved by second admin';
  perform pg_temp.as_user(a);
  -- 6. Held bill can't go in a run; attach the copy and it becomes ready.
  begin perform ps_payment_run_create('pool-bros-main', current_date, array[(r->'document'->>'id')::uuid, (big->'document'->>'id')::uuid]);
        exception when others then raise notice '6a run with unready bill refused: %', left(sqlerrm, 140); end;
  r := (select to_jsonb(x) from (select document_id from ps_payment_candidates('pool-bros-main') where doc_number like 'PINV%' and held_reason='Invoice copy missing' limit 1) x);
  perform ps_purchase_attach('pool-bros-main', (r->>'document_id')::uuid, 'media:test-receipt.jpg');
  raise notice '6b ready now: %', (select string_agg(doc_number||'='||ready, ', ') from ps_payment_candidates('pool-bros-main'));
  -- 7. Run: created by A, approved by B (not A), paid.
  run := ps_payment_run_create('pool-bros-main', current_date, (select array_agg(document_id) from ps_payment_candidates('pool-bros-main') where ready));
  raise notice '7 run %, total %', run->>'run_number', (select total from ps_payment_runs where id=(run->>'run_id')::uuid);
  begin perform ps_payment_run_approve('pool-bros-main', (run->>'run_id')::uuid); raise notice '7 FAIL';
        exception when others then raise notice '7a self-approval of run refused'; end;
  begin perform ps_payment_run_pay('pool-bros-main', (run->>'run_id')::uuid); raise notice '7 FAIL';
        exception when others then raise notice '7b paying an unapproved run refused'; end;
  perform pg_temp.as_user(b); perform ps_payment_run_approve('pool-bros-main', (run->>'run_id')::uuid);
  perform pg_temp.as_user(a); r := ps_payment_run_pay('pool-bros-main', (run->>'run_id')::uuid);
  raise notice '7c paid: % supplier payment(s); bills still owed: %; candidates left: %', r->>'supplier_payments',
    (select coalesce(sum(ps_document_outstanding(document_id)),0) from ps_payment_run_items where run_id=(run->>'run_id')::uuid),
    (select count(*) from ps_payment_candidates('pool-bros-main'));
  -- 8. Books balance; creditors back to zero for paid bills.
  select sum(balance) into tb from ps_ledger_trial_balance('pool-bros-main');
  raise notice '8 trial balance %, creditors %, WIP %, VAT input %, bank %', tb,
    (select balance from ps_ledger_trial_balance('pool-bros-main') where code='2100'), (select balance from ps_ledger_trial_balance('pool-bros-main') where code='1400'),
    (select balance from ps_ledger_trial_balance('pool-bros-main') where code='2201'), (select balance from ps_ledger_trial_balance('pool-bros-main') where code='1200');
end $$;
rollback;
-- 9. Sales cannot record purchases.
begin;
update user_profiles set role='Sales' where id=(select id from user_profiles where role='Admin' order by email limit 1);
select set_config('request.jwt.claims', json_build_object('sub',(select id from user_profiles where role='Sales' limit 1),'role','authenticated')::text, true) is not null;
do $$ begin begin perform ps_purchase_record('pool-bros-main', '{"supplier_key":"x"}'); raise notice '9 FAIL';
  exception when others then raise notice '9 Sales refused: %', sqlerrm; end; end $$;
rollback;
