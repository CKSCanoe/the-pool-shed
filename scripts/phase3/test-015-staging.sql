-- Phase 3.1 behaviour test for migration 015. STAGING ONLY. Every case rolls back.
\pset tuples_only on
\pset format unaligned
create or replace function pg_temp.save(label text, snap jsonb) returns text language plpgsql as $$
declare r jsonb; uid uuid; t0 timestamptz := clock_timestamp(); h bigint; v jsonb;
begin
 select user_id into uid from ps_workspace_members where role='admin' limit 1;
 perform set_config('request.jwt.claims', json_build_object('sub',uid,'role','authenticated')::text, true);
 insert into ps_workspace_revisions(workspace_id,data,updated_at) values('pool-bros-main','{}',now()); -- skip daily prune in timing
 select count(*) into h from ps_record_history;
 t0 := clock_timestamp();
 r := ps_workspace_save('pool-bros-main',(select updated_at from workspace_snapshots where workspace_id='pool-bros-main'),snap);
 h := h; -- timing stops here
 perform set_config('ps.test_ms', round(extract(epoch from clock_timestamp()-t0)*1000)::text, true);
 v := case when to_regclass('public.ps_records') is null then '{"ok":"n/a"}'::jsonb else ps_records_verify('pool-bros-main') end;
 return label||': saved='||(r is not null)||' save_ms='||current_setting('ps.test_ms')
   ||' history+='||((select count(*) from ps_record_history)-h)
   ||' actions='||coalesce((select string_agg(action||':'||section,',') from (select action,section from ps_record_history order by id desc limit ((select count(*) from ps_record_history)-h)) x),'-')
   ||' verify='||(v->>'ok')||' issues='||(select count(*) from ps_record_sync_issues);
end $$;
\set S '(select data from workspace_snapshots where workspace_id=''pool-bros-main'')'
begin; select pg_temp.save('1 unchanged', :S); rollback;
begin; select pg_temp.save('2 edit customer', jsonb_set(:S,'{customers,0,notes}','"phase 3 test"')); rollback;
begin; select pg_temp.save('3 delete customer', :S #- '{customers,0}'); rollback;
begin; select pg_temp.save('4 edit product', jsonb_set(:S,'{products,100,rrp}','123.45')); rollback;
begin; select pg_temp.save('5 add sales order', jsonb_set(:S,'{salesOrders}',(:S->'salesOrders')||'[{"id":"SO-TEST-015","lines":[]}]')); rollback;
begin; select pg_temp.save('6 reorder customers', jsonb_set(:S,'{customers}',(select jsonb_agg(e order by e->>'id' desc) from jsonb_array_elements(:S->'customers') e))); rollback;
begin; select pg_temp.save('7 change a setting', jsonb_set(:S,'{companySettings,phase3test}','true')); rollback;
begin; select pg_temp.save('8 edit stock (no ids)', jsonb_set(:S,'{stock,0,qty}',to_jsonb(((:S->'stock'->0->>'qty')::numeric)+1))); rollback;
begin; select pg_temp.save('9 edit supplier (no ids)', jsonb_set(:S,'{suppliers,0,notes}','"t"')); rollback;
-- 10. Version and history detail for one edited customer
begin;
select pg_temp.save('10 edit then inspect', jsonb_set(:S,'{customers,0,notes}','"v2"'));
select '10 record: version='||version||' notes='||(data->>'notes')||' history old/new notes='||coalesce((select (old_data->>'notes')||'/'||(new_data->>'notes') from ps_record_history h where h.section='customers' and h.key=r.key order by id desc limit 1),'-')
 from ps_records r where section='customers' and key='id:'||(:S->'customers'->0->>'id');
rollback;
-- 11. Quote Studio server path also mirrors
begin;
insert into ps_workspace_revisions(workspace_id,data,updated_at) values('pool-bros-main','{}',now());
select '11 quote path: saved='||(ps_quote_workspace_save('pool-bros-main',null,(select updated_at from workspace_snapshots where workspace_id='pool-bros-main'),jsonb_set(:S,'{quotes,0,phase3}','true')) is not null)
  ||' verify='||(ps_records_verify('pool-bros-main')->>'ok');
rollback;
-- 12. A broken mirror never blocks a save: hide the record table, save, check the issue is logged.
begin;
alter table ps_records rename to ps_records_hidden;
select pg_temp.save('12 mirror broken', jsonb_set(:S,'{customers,0,notes}','"x"'));
select '12 issue logged: '||problem from ps_record_sync_issues order by id desc limit 1;
rollback;
select 'after all: '||ps_records_verify('pool-bros-main')::text;
