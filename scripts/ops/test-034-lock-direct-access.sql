-- 034 (+020): one record read follows the role rules; old first-design tables and the raw workspace refused to
-- signed-in users; the change stamp still readable. Applies 034 (and 020 if missing) inside the transaction. Rolls back.
begin;
\i database/034-lock-direct-access.sql
revoke select on public.workspace_snapshots from authenticated;
grant select (workspace_id, updated_at) on public.workspace_snapshots to authenticated;
select set_config('ps.a', (select id::text from user_profiles where role='Admin' order by email limit 1), true) is not null;
select set_config('ps.b', (select id::text from user_profiles where role='Admin' order by email desc limit 1), true) is not null;
create or replace function pg_temp.as_user(u text) returns void language sql as $$ select set_config('request.jwt.claims', json_build_object('sub',u,'role','authenticated')::text, true) $$;
create temp table out(n int, msg text);
grant all on out to authenticated, anon;
do $$
declare a text := current_setting('ps.a'); b text := current_setting('ps.b'); pid text; jid text; aid text; r jsonb;
begin
  select data->>'id' into pid from ps_records where workspace_id='pool-bros-main' and section='products' and deleted_at is null and (data->>'cost') is not null limit 1;
  select data->>'id' into jid from ps_records where workspace_id='pool-bros-main' and section='jobs' and deleted_at is null limit 1;
  select data->>'id' into aid from ps_records where workspace_id='pool-bros-main' and section='poolAudits' and deleted_at is null limit 1;
  perform pg_temp.as_user(a);
  r := ps_record_get('pool-bros-main', 'products', pid);
  insert into out values (1, 'Admin product ' || pid || ': has cost ' || (r->'data' ? 'cost'));
  r := ps_record_get('pool-bros-main', 'products', 'no-such-id'); insert into out values (2, 'missing record: ' || coalesce(r::text, 'null'));
  update user_profiles set role = 'Warehouse' where id = b::uuid;
  perform pg_temp.as_user(b);
  r := ps_record_get('pool-bros-main', 'products', pid);
  insert into out values (3, 'Warehouse product: found ' || (r is not null) || ', has cost ' || coalesce((r->'data' ? 'cost')::text, 'n/a'));
  perform pg_temp.as_user(a); update user_profiles set role = 'Engineer' where id = b::uuid; perform pg_temp.as_user(b);
  r := ps_record_get('pool-bros-main', 'jobs', jid);
  insert into out values (4, 'Engineer, job not assigned to them: ' || coalesce(r::text, 'null'));
  r := ps_record_get('pool-bros-main', 'poolAudits', coalesce(aid, 'none'));
  insert into out values (5, 'Engineer pool audit (' || coalesce(aid, 'no audits on this database') || '): ' || case when r is null then 'null' else 'returned' end);
  perform set_config('request.jwt.claims', '', true);
  begin perform ps_record_get('pool-bros-main', 'products', pid); insert into out values (6, 'FAIL no user allowed'); exception when others then insert into out values (6, 'no user refused: ' || sqlerrm); end;
  perform pg_temp.as_user(a);
  update user_profiles set role = 'Admin' where id = b::uuid;
end $$;
-- Direct table access as a signed-in user.
set local role authenticated;
select pg_temp.as_user(current_setting('ps.a')) is null;
do $$ begin
  begin perform 1 from public.products limit 1; insert into out values (7, 'FAIL old products table readable'); exception when insufficient_privilege then insert into out values (7, 'old products table refused'); end;
  begin insert into public.sales_orders default values; insert into out values (8, 'FAIL old sales_orders writable'); exception when insufficient_privilege then insert into out values (8, 'old sales_orders write refused'); when others then insert into out values (8, 'FAIL? ' || sqlerrm); end;
  begin perform data from public.workspace_snapshots limit 1; insert into out values (9, 'FAIL raw workspace readable'); exception when insufficient_privilege then insert into out values (9, 'raw workspace refused'); end;
  begin perform updated_at from public.workspace_snapshots limit 1; insert into out values (10, 'change stamp still readable'); exception when others then insert into out values (10, 'FAIL stamp: ' || sqlerrm); end;
  begin perform 1 from public.user_profiles limit 1; insert into out values (11, 'user_profiles still readable (in use)'); exception when others then insert into out values (11, 'FAIL profiles: ' || sqlerrm); end;
  begin perform ps_workspace_load('pool-bros-main'); insert into out values (12, 'app load (ps_workspace_load) still works'); exception when others then insert into out values (12, 'FAIL load: ' || sqlerrm); end;
end $$;
reset role;
set local role anon;
do $$ begin
  begin perform 1 from public.sales_order_margin_summary limit 1; insert into out values (13, 'FAIL anon view readable'); exception when insufficient_privilege then insert into out values (13, 'anonymous view refused'); end;
end $$;
reset role;
select n || ' ' || msg from out order by n;
rollback;
