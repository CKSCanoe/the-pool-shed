-- Van stock (031): link, engineer sees own van only, count waits for the office, self-apply refused, apply/discard. Rolls back.
begin;
select set_config('ps.a', (select id::text from user_profiles where role='Admin' order by email limit 1), true) is not null;
select set_config('ps.b', (select id::text from user_profiles where role='Admin' order by email desc limit 1), true) is not null;
create or replace function pg_temp.as_user(u text) returns void language sql as $$ select set_config('request.jwt.claims', json_build_object('sub',u,'role','authenticated')::text, true) $$;
do $$
declare a text := current_setting('ps.a'); b text := current_setting('ps.b'); van uuid; other uuid; pid text; st jsonb; r jsonb; c uuid;
begin
  perform pg_temp.as_user(a);
  insert into ps_vans(id, workspace_id, registration, make, model, status, assigned_user) values (gen_random_uuid(), 'pool-bros-main', 'ZZ31 VAN', 'Test', 'Van', 'Active', b::uuid) returning id into van;
  insert into ps_vans(id, workspace_id, registration, make, model, status) values (gen_random_uuid(), 'pool-bros-main', 'ZZ31 OTH', 'Test', 'Van', 'Active') returning id into other;
  select data->>'productId' into pid from ps_records where section = 'stock' and deleted_at is null limit 1;
  insert into ps_records(workspace_id, section, key, ord, data, hash) values ('pool-bros-main', 'stock', 'test:vanstock', 99999, jsonb_build_object('productId', pid, 'locationId', 'L-VAN-ZZ31', 'qty', 5, 'allocated', 0), 'x');
  st := ps_van_stock('pool-bros-main', van); raise notice '1 before set-up: location %, items %', coalesce(st->>'location_id','none'), jsonb_array_length(st->'items');
  perform ps_fleet_van_link_location('pool-bros-main', van, 'L-VAN-ZZ31');
  begin perform ps_fleet_van_link_location('pool-bros-main', other, 'L-VAN-ZZ31'); raise notice '2 FAIL'; exception when others then raise notice '2 same location twice refused: %', sqlerrm; end;
  st := ps_van_stock('pool-bros-main', van); raise notice '3 after set-up: % item(s), expected % (no cost field: %)', jsonb_array_length(st->'items'), st->'items'->0->>'expected', not (st->'items'->0 ? 'cost');
  -- engineer b: own van yes, other van no
  update user_profiles set role = 'Engineer' where id = b::uuid;
  perform pg_temp.as_user(b);
  begin perform ps_van_stock('pool-bros-main', other); raise notice '4 FAIL'; exception when others then raise notice '4 engineer cannot see another van: %', sqlerrm; end;
  begin perform ps_van_counts_list('pool-bros-main'); raise notice '5 FAIL'; exception when others then raise notice '5 engineer cannot review counts: %', sqlerrm; end;
  begin perform ps_van_count_submit('pool-bros-main', van, jsonb_build_array(jsonb_build_object('product_id', pid, 'counted', 2.5))); raise notice '6 FAIL'; exception when others then raise notice '6 part units refused: %', sqlerrm; end;
  r := ps_van_count_submit('pool-bros-main', van, jsonb_build_array(jsonb_build_object('product_id', pid, 'counted', 3)), 'used 2 on a job'); c := (r->>'id')::uuid;
  raise notice '7 engineer count sent: % difference(s)', r->>'differences';
  begin perform ps_van_count_submit('pool-bros-main', van, jsonb_build_array(jsonb_build_object('product_id', pid, 'counted', 3))); raise notice '8 FAIL'; exception when others then raise notice '8 second count while one waits refused: %', sqlerrm; end;
  perform pg_temp.as_user(a);
  update user_profiles set role = 'Admin' where id = b::uuid;
  raise notice '9 office sees: %', (select x->>'registration' || ' ' || (x->>'differences') || ' diff, ' || (x->>'status') from jsonb_array_elements(ps_van_counts_list('pool-bros-main')) x where x->>'id' = c::text);
  perform ps_van_count_decide('pool-bros-main', c, true, null);
  raise notice '10 applied by another person: %', (select status from ps_van_counts where id = c);
  begin perform ps_van_count_decide('pool-bros-main', c, false, null); raise notice '11 FAIL'; exception when others then raise notice '11 deciding twice refused: %', sqlerrm; end;
  -- self-counted with differences cannot be applied by the same person
  r := ps_van_count_submit('pool-bros-main', van, jsonb_build_array(jsonb_build_object('product_id', pid, 'counted', 4)));
  begin perform ps_van_count_decide('pool-bros-main', (r->>'id')::uuid, true, null); raise notice '12 FAIL'; exception when others then raise notice '12 own count with differences refused: %', sqlerrm; end;
  perform ps_van_count_decide('pool-bros-main', (r->>'id')::uuid, false, 'recount'); raise notice '13 discard allowed: %', (select status from ps_van_counts where id = (r->>'id')::uuid);
end $$;
rollback;
