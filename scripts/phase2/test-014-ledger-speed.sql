-- F5 speed test: old n x m ledger check vs 014 hash check. STAGING ONLY, rolled back.
\pset tuples_only on
\pset format unaligned
\timing on
begin;
create temp table big as
select (select jsonb_agg(jsonb_build_object('id','RE-'||g,'poId','PO-'||(g%40),'lineId','L'||(g%7),'productId','P'||(g%900),'qty',(g%9)+1,'at','2026-10-01T10:00:00Z','by','synthetic')) from generate_series(1,N.n) g) old_l, N.n
from (values (200),(2000),(5000)) N(n);
select 'n='||n||' old-style check (ms):' from big order by n;
\echo -- old n x m check, 5000 entries
select count(*) from big, jsonb_array_elements(old_l) o where n=5000 and not exists(select 1 from jsonb_array_elements(old_l||'[{"id":"NEW"}]') c where c=o);
\echo -- 014 check, 5000 entries
select ps_workspace_validate(jsonb_build_object('jobs','[]','salesOrders','[]','purchaseOrders','[]','customers','[]','products','[]','suppliers','[]','stock','[]','receiptEvents',old_l,'putawayTransfers',old_l),
                             jsonb_build_object('jobs','[]','salesOrders','[]','purchaseOrders','[]','customers','[]','products','[]','suppliers','[]','stock','[]','receiptEvents',old_l||'[{"id":"NEW"}]','putawayTransfers',old_l), true) from big where n=5000;
\echo -- old n x m check, 2000 entries
select count(*) from big, jsonb_array_elements(old_l) o where n=2000 and not exists(select 1 from jsonb_array_elements(old_l||'[{"id":"NEW"}]') c where c=o);
\echo -- 014 check, 2000 entries
select ps_workspace_validate(jsonb_build_object('jobs','[]','salesOrders','[]','purchaseOrders','[]','customers','[]','products','[]','suppliers','[]','stock','[]','receiptEvents',old_l,'putawayTransfers',old_l),
                             jsonb_build_object('jobs','[]','salesOrders','[]','purchaseOrders','[]','customers','[]','products','[]','suppliers','[]','stock','[]','receiptEvents',old_l||'[{"id":"NEW"}]','putawayTransfers',old_l), true) from big where n=2000;
\echo -- current data: full 014 validation of the live-sized snapshot
select ps_workspace_validate(data,data,true) from workspace_snapshots where workspace_id='pool-bros-main';
rollback;
