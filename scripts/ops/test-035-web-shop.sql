-- 035 web shop: settings (managers only, secret hidden, cannot switch on without it), orders received once,
-- import / ignore rules, outbox only for web orders, stock feed (sell-online products, warehouse only, less
-- allocations), server-only functions refused to staff. Applies 035 inside the transaction. Rolls back.
begin;
\i database/035-web-shop.sql
select set_config('ps.a', (select id::text from user_profiles where role='Admin' order by email limit 1), true) is not null;
select set_config('ps.b', (select id::text from user_profiles where role='Admin' order by email desc limit 1), true) is not null;
create or replace function pg_temp.as_user(u text) returns void language sql as $$ select set_config('request.jwt.claims', json_build_object('sub',u,'role','authenticated')::text, true) $$;
create temp table out(n int, msg text); grant all on out to authenticated;
do $$
declare a text := current_setting('ps.a'); b text := current_setting('ps.b'); s jsonb; r jsonb; r2 jsonb; oid uuid; pid text; wh text; van text;
  ord jsonb := jsonb_build_object('external_id','1001','external_number','#1001','customer',jsonb_build_object('name','Test Buyer','email','buyer@example.test'),
    'lines',jsonb_build_array(jsonb_build_object('sku','X','name','Thing','qty',1,'net',10,'vat',2,'unit_net',10,'vat_rate',20)),'payment',jsonb_build_object('status','pending'));
begin
  perform pg_temp.as_user(a);
  s := ps_shop_settings_get('pool-bros-main'); insert into out values (1, 'starts off: enabled ' || (s->>'enabled') || ', platform ' || (s->>'platform'));
  begin perform ps_shop_settings_save('pool-bros-main', '{"enabled":true}'); insert into out values (2, 'FAIL on without secret'); exception when others then insert into out values (2, 'switch on without a secret refused: ' || sqlerrm); end;
  begin perform ps_shop_settings_save('pool-bros-main', '{"secret":"short"}'); insert into out values (3, 'FAIL short secret'); exception when others then insert into out values (3, 'short secret refused: ' || sqlerrm); end;
  s := ps_shop_settings_save('pool-bros-main', jsonb_build_object('secret', 'abcdefghijklmnopqrstuvwxyz123456', 'platform', 'shopify', 'enabled', true, 'shop_url', 'https://shop.example.test'));
  insert into out values (4, 'saved: enabled ' || (s->>'enabled') || ', hint ' || (s->>'secret_hint') || ', secret returned ' || (s ? 'secret'));
  update user_profiles set role = 'Sales' where id = b::uuid; perform pg_temp.as_user(b);
  begin perform ps_shop_settings_get('pool-bros-main'); insert into out values (5, 'FAIL sales sees settings'); exception when others then insert into out values (5, 'Sales cannot open shop settings: ' || sqlerrm); end;
  r := ps_shop_orders_list('pool-bros-main', 'new'); insert into out values (6, 'Sales can list web orders: ' || jsonb_array_length(r));
  perform pg_temp.as_user(a); update user_profiles set role = 'Warehouse' where id = b::uuid; perform pg_temp.as_user(b);
  begin perform ps_shop_orders_list('pool-bros-main', 'new'); insert into out values (7, 'FAIL warehouse lists'); exception when others then insert into out values (7, 'Warehouse cannot: ' || sqlerrm); end;
  perform pg_temp.as_user(a); update user_profiles set role = 'Admin' where id = b::uuid;
  -- Receive (server), twice; second brings payment up to date.
  r := ps_shop_order_receive('pool-bros-main', 'shopify', ord, '{}'::jsonb);
  r2 := ps_shop_order_receive('pool-bros-main', 'shopify', ord || jsonb_build_object('payment', jsonb_build_object('status','paid','amount',12)), '{}'::jsonb);
  oid := (r->>'id')::uuid;
  insert into out values (8, 'same order twice: one row ' || ((r->>'id') = (r2->>'id')) || ', duplicate ' || (r2->>'duplicate') || ', payment now ' || (select payment->>'status' from ps_shop_orders where id = oid));
  begin perform ps_shop_order_receive('pool-bros-main', 'shopify', ord - 'lines', null); insert into out values (9, 'FAIL no lines'); exception when others then insert into out values (9, 'order with no lines refused: ' || sqlerrm); end;
  begin perform ps_shop_order_mark('pool-bros-main', oid, 'ignored', null, ''); insert into out values (10, 'FAIL ignore no reason'); exception when others then insert into out values (10, 'ignore needs a reason: ' || sqlerrm); end;
  perform ps_shop_order_mark('pool-bros-main', oid, 'imported', 'SO-TEST-1', null);
  begin perform ps_shop_order_mark('pool-bros-main', oid, 'imported', 'SO-TEST-2', null); insert into out values (11, 'FAIL import twice'); exception when others then insert into out values (11, 'cannot import twice: ' || sqlerrm); end;
  begin perform ps_shop_order_mark('pool-bros-main', oid, 'ignored', null, 'dup'); insert into out values (12, 'FAIL ignore imported'); exception when others then insert into out values (12, 'cannot ignore an imported order: ' || sqlerrm); end;
  r := ps_shop_outbox_add('pool-bros-main', 'SO-TEST-1', 'shipped', '{"courier":"DPD","tracking":"123"}');
  r2 := ps_shop_outbox_add('pool-bros-main', 'SO-NOT-WEB', 'shipped', '{}');
  insert into out values (13, 'outbox: web order queued ' || (r is not null) || ' (external ' || (r->>'external_id') || '), other order ignored ' || (r2 is null) || ', listed ' || jsonb_array_length(ps_shop_outbox_list('pool-bros-main')));
  r := ps_shop_test_order('pool-bros-main', ord - 'external_id'); insert into out values (14, 'test order received: ' || ((select test from ps_shop_orders where id = (r->>'id')::uuid)));
  -- Stock feed: mark one product online with stock in a warehouse bin and a van.
  select l.data->>'id' into wh from ps_records l where l.workspace_id='pool-bros-main' and l.section='locations' and l.deleted_at is null and l.data->>'type' in ('Warehouse','Warehouse Bin') limit 1;
  select l.data->>'id' into van from ps_records l where l.workspace_id='pool-bros-main' and l.section='locations' and l.deleted_at is null and l.data->>'type' = 'Engineer Van' limit 1;
  select data->>'id' into pid from ps_records where workspace_id='pool-bros-main' and section='products' and deleted_at is null and coalesce(data->>'sku','') <> '' and coalesce(data->>'stockTracked','true') <> 'false' limit 1;
  update ps_records set data = data || '{"sellOnline":true}' where workspace_id='pool-bros-main' and section='products' and key='id:' || pid;
  insert into ps_records(workspace_id, section, key, ord, data, hash) values
    ('pool-bros-main','stock','test:shop1',99998, jsonb_build_object('productId',pid,'locationId',wh,'qty',7,'allocated',2),'x'),
    ('pool-bros-main','stock','test:shop2',99999, jsonb_build_object('productId',pid,'locationId',coalesce(van,'L-VAN-NONE'),'qty',5,'allocated',0),'x');
  r := ps_shop_stock('pool-bros-main');
  insert into out values (15, 'stock feed: ' || jsonb_array_length(r->'items') || ' item(s); ' || (select x->>'sku' || ' available ' || (x->>'available') from jsonb_array_elements(r->'items') x limit 1) || ' (warehouse 7 less 2 allocated; van not counted)');
end $$;
set local role authenticated;
select pg_temp.as_user(current_setting('ps.a')) is null;
do $$ begin
  begin perform ps_shop_stock('pool-bros-main'); insert into out values (16, 'FAIL staff read stock feed fn'); exception when insufficient_privilege then insert into out values (16, 'stock feed is server-only'); end;
  begin perform ps_shop_order_receive('pool-bros-main','other','{}'::jsonb); insert into out values (17, 'FAIL staff receive'); exception when insufficient_privilege then insert into out values (17, 'receiving orders is server-only'); end;
  begin perform secret from ps_shop_settings; insert into out values (18, 'FAIL secret readable'); exception when insufficient_privilege then insert into out values (18, 'secret not readable by staff'); end;
end $$;
reset role;
select n || ' ' || msg from out order by n;
rollback;
