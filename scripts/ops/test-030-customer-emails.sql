-- Customer emails (030): who may send, which steps, recipient from the customer record, log. Everything rolls back.
begin;
select set_config('ps.a', (select id::text from user_profiles where role='Admin' order by email limit 1), true) is not null;
select set_config('ps.order', (select data->>'id' from ps_records where section='salesOrders' and deleted_at is null order by key limit 1), true) is not null;
create or replace function pg_temp.as_user(u text) returns void language sql as $$ select set_config('request.jwt.claims', json_build_object('sub',u,'role','authenticated')::text, true) $$;
do $$
declare a text := current_setting('ps.a'); o text := current_setting('ps.order'); c jsonb;
begin
  perform pg_temp.as_user(a);
  c := ps_customer_email_context('pool-bros-main', o, 'Ship');
  raise notice '1 context for %: recipient on record: %, switch on: %, rule found: %', o, (c->'customer'->>'email') is not null, c->>'emails_on', (c->'rule'->>'subject') is not null;
  begin perform ps_customer_email_context('pool-bros-main', o, 'Invoice'); raise notice '2 FAIL'; exception when others then raise notice '2 non-fulfilment step refused: %', sqlerrm; end;
  begin perform ps_customer_email_context('pool-bros-main', 'NO-SUCH', 'Ship'); raise notice '3 FAIL'; exception when others then raise notice '3 unknown order refused: %', sqlerrm; end;
  update user_profiles set role = 'Engineer' where id = a::uuid;
  begin perform ps_customer_email_context('pool-bros-main', o, 'Ship'); raise notice '4 FAIL'; exception when others then raise notice '4 engineer refused: %', sqlerrm; end;
  begin perform ps_customer_email_sent('pool-bros-main', o, 'GN-1', 'Ship', 'x@example.test', 'Subject'); raise notice '4b FAIL'; exception when others then raise notice '4b engineer cannot log: %', sqlerrm; end;
end $$;
rollback;
