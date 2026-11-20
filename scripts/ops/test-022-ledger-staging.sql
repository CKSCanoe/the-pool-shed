-- O1 ledger foundation proof. STAGING ONLY. Everything rolls back.
\set ON_ERROR_STOP 0
begin;
select set_config('request.jwt.claims', json_build_object('sub',(select id from user_profiles where role='Admin' limit 1),'role','authenticated')::text, true) is not null;
do $$
declare r jsonb; r2 jsonb; tb numeric; did uuid;
begin
  -- 1. A balanced goods receipt posts and gets a number.
  r := ps_ledger_post('pool-bros-main', '{"doc_type":"stock_receipt","contact_type":"supplier","contact_key":"name:Certikin","contact_name":"Certikin","reference":"PO-TEST","net":100}',
       '[{"account_role":"stock","debit":100,"description":"Pump"},{"account_role":"grni","credit":100,"description":"Pump"}]');
  did := (r->>'id')::uuid;
  raise notice '1 balanced post: % (%)', r->>'doc_number', (select status from ps_ledger_documents where id=did);
  -- 2. Unbalanced is refused.
  begin perform ps_ledger_post('pool-bros-main', '{"doc_type":"manual_journal"}', '[{"account_role":"bank","debit":50},{"account_role":"sales","credit":40}]'); raise notice '2 FAIL';
  exception when others then raise notice '2 unbalanced refused: %', sqlerrm; end;
  -- 3. Posted documents cannot change (except Xero sync fields).
  begin update ps_ledger_documents set net = 1 where id = did; raise notice '3 FAIL';
  exception when others then raise notice '3 edit posted refused: %', sqlerrm; end;
  update ps_ledger_documents set xero_status = 'queued' where id = did; raise notice '3b Xero status update allowed';
  -- 4. No deleting posted documents or touching their lines.
  begin delete from ps_ledger_documents where id = did; raise notice '4 FAIL';
  exception when others then raise notice '4 delete posted refused: %', sqlerrm; end;
  begin update ps_ledger_lines set debit = 1 where document_id = did; raise notice '4b FAIL';
  exception when others then raise notice '4b edit posted line refused'; end;
  begin insert into ps_ledger_lines(document_id,line_no,account_code,debit) values (did, 9, '1200', 5); raise notice '4c FAIL';
  exception when others then raise notice '4c add line to posted refused'; end;
  -- 5. Corrections are reversals (once, with a reason).
  begin perform ps_ledger_reverse('pool-bros-main', did, ''); raise notice '5 FAIL'; exception when others then raise notice '5 reversal needs a reason: ok'; end;
  r2 := ps_ledger_reverse('pool-bros-main', did, 'Wrong supplier');
  raise notice '5b reversal % lines: %', r2->>'doc_number', (select string_agg(account_code||' Dr '||debit||' Cr '||credit, '; ' order by line_no) from ps_ledger_lines where document_id=(r2->>'id')::uuid);
  begin perform ps_ledger_reverse('pool-bros-main', did, 'again'); raise notice '5c FAIL'; exception when others then raise notice '5c double reversal refused'; end;
  -- 6. Trial balance always nets to zero.
  select sum(balance) into tb from ps_ledger_trial_balance('pool-bros-main');
  raise notice '6 trial balance total: %', tb;
  -- 7. Closed months are locked.
  perform ps_ledger_close_period('pool-bros-main', current_date);
  begin perform ps_ledger_post('pool-bros-main', '{"doc_type":"manual_journal"}', '[{"account_role":"bank","debit":10},{"account_role":"sales","credit":10}]'); raise notice '7 FAIL';
  exception when others then raise notice '7 posting into closed month refused: %', sqlerrm; end;
end $$;
rollback;
-- 8. A Sales user cannot post.
begin;
update user_profiles set role='Sales' where id=(select id from user_profiles where role='Admin' order by email limit 1);
select set_config('request.jwt.claims', json_build_object('sub',(select id from user_profiles where role='Sales' limit 1),'role','authenticated')::text, true) is not null;
do $$ begin
  begin perform ps_ledger_post('pool-bros-main', '{"doc_type":"manual_journal"}', '[{"account_role":"bank","debit":10},{"account_role":"sales","credit":10}]'); raise notice '8 FAIL';
  exception when others then raise notice '8 Sales role refused: %', sqlerrm; end;
end $$;
rollback;
-- 9. Staff cannot call the internal posting function directly.
select '9 staff can execute ps_ledger_post: '||has_function_privilege('authenticated','public.ps_ledger_post(text,jsonb,jsonb)','execute');
