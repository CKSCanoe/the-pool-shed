-- Phase 2 behaviour test for migration 014. STAGING ONLY. Every case rolls back.
\set ON_ERROR_STOP 0
\pset tuples_only on
\pset format unaligned
select 'admin user: '||(select user_id is not null from ps_workspace_members where role='admin' limit 1);

create or replace function pg_temp.try(label text, snap jsonb, stamp_override timestamptz default null) returns text language plpgsql as $$
declare r jsonb; cur workspace_snapshots; uid uuid;
begin
 select user_id into uid from ps_workspace_members where role='admin' limit 1;
 perform set_config('request.jwt.claims', json_build_object('sub',uid,'role','authenticated')::text, true);
 select * into cur from workspace_snapshots where workspace_id='pool-bros-main';
 r := ps_workspace_save('pool-bros-main', coalesce(stamp_override,cur.updated_at), snap);
 return label||': '||coalesce(r::text,'NULL (conflict, client merges)');
exception when others then return label||': REFUSED - '||sqlerrm;
end $$;

begin; select pg_temp.try('1 unchanged save', data) from workspace_snapshots where workspace_id='pool-bros-main'; rollback;
begin; select pg_temp.try('2 erase all customers', jsonb_set(data,'{customers}','[]')) from workspace_snapshots where workspace_id='pool-bros-main'; rollback;
begin; select pg_temp.try('3 change a receipt qty', jsonb_set(data,'{receiptEvents,0,qty}','999')) from workspace_snapshots where workspace_id='pool-bros-main'; rollback;
begin; select pg_temp.try('4 remove a receipt', data #- '{receiptEvents,0}') from workspace_snapshots where workspace_id='pool-bros-main'; rollback;
begin; select pg_temp.try('5 stale save', data, '2000-01-01') from workspace_snapshots where workspace_id='pool-bros-main'; rollback;
begin; select pg_temp.try('6 add a customer', jsonb_set(data,'{customers}',(data->'customers')||'[{"id":"TEST-014","name":"Test"}]')) from workspace_snapshots where workspace_id='pool-bros-main'; rollback;
begin; select pg_temp.try('7 reorder receipts (allowed)', jsonb_set(data,'{receiptEvents}',(select jsonb_agg(e order by random()) from jsonb_array_elements(data->'receiptEvents') e))) from workspace_snapshots where workspace_id='pool-bros-main'; rollback;
begin; select pg_temp.try('8 duplicate receipt id', jsonb_set(data,'{receiptEvents}',(data->'receiptEvents')||jsonb_build_array(jsonb_set(data->'receiptEvents'->0,'{qty}','1')))) from workspace_snapshots where workspace_id='pool-bros-main'; rollback;
begin; select pg_temp.try('9 stock negative', jsonb_set(data,'{stock,0,qty}','-1')) from workspace_snapshots where workspace_id='pool-bros-main'; rollback;
select 'prune dry run: '||ps_workspace_revisions_prune('pool-bros-main',true)::text;
