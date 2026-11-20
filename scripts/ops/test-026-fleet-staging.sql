-- Vans & Fleet proof. STAGING ONLY. Everything rolls back.
begin;
select set_config('ps.boss', (select id::text from user_profiles where role='Admin' order by email limit 1), true) is not null;
select set_config('ps.eng',  (select id::text from user_profiles where role='Admin' order by email desc limit 1), true) is not null;
select set_config('ps.other', (select id::text from user_profiles where role='Admin' order by email limit 1 offset 1), true) is not null;
update user_profiles set role='Engineer' where id in (current_setting('ps.eng')::uuid, current_setting('ps.other')::uuid);
create or replace function pg_temp.as_user(u text) returns void language sql as $$ select set_config('request.jwt.claims', json_build_object('sub',u,'role','authenticated')::text, true) $$;
do $$
declare boss text := current_setting('ps.boss'); eng text := current_setting('ps.eng'); other text := current_setting('ps.other');
        v jsonb; v2 jsonb; rep jsonb; rid uuid; ck jsonb; i record;
begin
  perform pg_temp.as_user(boss);
  v := ps_fleet_van_save('pool-bros-main', jsonb_build_object('registration','ab12cde','make','Ford','model','Transit Custom','year',2021,'colour','White',
        'fuel_type','Diesel','assigned_user',eng,'odometer',41250,'mot_due',current_date+20,'tax_due',current_date-3,'insurance_provider','Zurich',
        'insurance_policy','ZUR-12345','insurance_due',current_date+200,'service_due',current_date+90,
        'kit', jsonb_build_array(jsonb_build_object('item','Chlorine tablets (5kg)','target_qty',2), jsonb_build_object('item','pH test kit','target_qty',1))));
  raise notice '1 van added: %', v;
  begin perform ps_fleet_van_save('pool-bros-main', '{"registration":"AB12 CDE","make":"Ford","model":"Transit"}'); raise notice '1b FAIL';
  exception when others then raise notice '1b duplicate plate refused'; end;
  v2 := ps_fleet_van_save('pool-bros-main', jsonb_build_object('registration','XY70ZZZ','make','Vauxhall','model','Vivaro','assigned_user',other));
  select * into i from ps_fleet_vans('pool-bros-main') where registration='AB12 CDE';
  raise notice '2 compliance: MOT % / tax % / insurance % / worst % / report %', i.mot_state, i.tax_state, i.insurance_state, i.worst_state, i.report_status;
  -- Engineer sees only their van (and not the policy number).
  perform pg_temp.as_user(eng);
  raise notice '3 engineer sees: % (policy hidden: %)', (select string_agg(registration, ', ') from ps_fleet_vans('pool-bros-main')),
    (select insurance_policy is null from ps_fleet_vans('pool-bros-main') limit 1);
  begin perform ps_fleet_report_open('pool-bros-main', (v2->>'id')::uuid); raise notice '3b FAIL';
  exception when others then raise notice '3b other engineer''s van refused: %', sqlerrm; end;
  begin perform ps_fleet_van_save('pool-bros-main', '{"registration":"ZZ99ZZZ","make":"x","model":"y"}'); raise notice '3c FAIL';
  exception when others then raise notice '3c engineer cannot add vans'; end;
  -- Monthly report.
  rep := ps_fleet_report_open('pool-bros-main', (v->>'id')::uuid); rid := (rep->'report'->>'id')::uuid;
  raise notice '4 report opened: % checks, kit % items', jsonb_array_length(rep->'checklist'), jsonb_array_length(rep->'report'->'kit_counts');
  begin perform ps_fleet_report_submit('pool-bros-main', rid, 'sig', 'Eng'); raise notice '4b FAIL'; exception when others then raise notice '4b incomplete refused: %', left(sqlerrm, 80); end;
  select jsonb_object_agg(code, jsonb_build_object('ok', code <> 'tyres', 'note', '')) into ck from ps_van_checklist_items where workspace_id='pool-bros-main';
  perform ps_fleet_report_save('pool-bros-main', rid, jsonb_build_object('odometer', 42100, 'checklist', ck,
          'kit_counts', jsonb_build_array(jsonb_build_object('item','Chlorine tablets (5kg)','expected',2,'counted',1), jsonb_build_object('item','pH test kit','expected',1,'counted',1))));
  begin perform ps_fleet_report_submit('pool-bros-main', rid, 'sig', 'Eng'); raise notice '5 FAIL'; exception when others then raise notice '5 failed check without note refused: %', sqlerrm; end;
  perform ps_fleet_report_save('pool-bros-main', rid, '{"checklist":{"tyres":{"ok":false,"note":"Front nearside tyre low tread - booked in"}},"odometer":40000}');
  begin perform ps_fleet_report_submit('pool-bros-main', rid, 'sig', 'Eng'); raise notice '5b FAIL'; exception when others then raise notice '5b mileage backwards refused: %', sqlerrm; end;
  perform ps_fleet_report_save('pool-bros-main', rid, '{"odometer":42100}');
  begin perform ps_fleet_damage_add('pool-bros-main', rid, '{"area":"Left side","severity":"Dent","description":"Dent on sliding door"}'); raise notice '6 FAIL';
  exception when others then raise notice '6 damage without photo refused: %', sqlerrm; end;
  perform ps_fleet_damage_add('pool-bros-main', rid, '{"area":"Left side","severity":"Dent","description":"Dent on sliding door","photo_refs":["fleet-media:test"]}');
  begin perform ps_fleet_report_submit('pool-bros-main', rid, '', ''); raise notice '7 FAIL'; exception when others then raise notice '7 unsigned refused'; end;
  raise notice '7b submitted: %', ps_fleet_report_submit('pool-bros-main', rid, 'fleet-media:sig-eng', 'Engineer Name');
  begin perform ps_fleet_report_save('pool-bros-main', rid, '{"notes":"edit after submit"}'); raise notice '8 FAIL'; exception when others then raise notice '8 submitted report locked'; end;
  begin perform ps_fleet_report_review('pool-bros-main', rid, true, '', 'x', 'y'); raise notice '9 FAIL'; exception when others then raise notice '9 engineer cannot sign off'; end;
  -- Manager: send back, engineer fixes, re-submits, manager signs off.
  perform pg_temp.as_user(boss);
  begin perform ps_fleet_report_review('pool-bros-main', rid, false, '', null, null); raise notice '10 FAIL'; exception when others then raise notice '10 send back needs a reason'; end;
  perform ps_fleet_report_review('pool-bros-main', rid, false, 'Photo the tyre tread please', null, null);
  perform pg_temp.as_user(eng);
  perform ps_fleet_report_save('pool-bros-main', rid, '{"notes":"Tyre photo added"}');
  perform ps_fleet_report_submit('pool-bros-main', rid, 'fleet-media:sig-eng2', 'Engineer Name');
  perform pg_temp.as_user(boss);
  raise notice '11 signed off: %', ps_fleet_report_review('pool-bros-main', rid, true, 'Tyre booked', 'fleet-media:sig-boss', 'Boss Name');
  select * into i from ps_fleet_vans('pool-bros-main') where registration='AB12 CDE';
  raise notice '12 van now: mileage % / open damage % / report %', i.odometer, i.open_damage, i.report_status;
  raise notice '12b history: %', (select string_agg(status||' failed='||failed_checks||' kit_short='||kit_short||' damage='||damage_logged, '; ') from ps_fleet_reports('pool-bros-main', (v->>'id')::uuid));
  perform ps_fleet_damage_close('pool-bros-main', (select id from ps_van_damage where van_id=(v->>'id')::uuid limit 1), 'Repaired', 'Smart repair, £120');
  raise notice '13 damage closed; open now: %', (select open_damage from ps_fleet_vans('pool-bros-main') where registration='AB12 CDE');
end $$;
rollback;
select '14 staff can read ps_vans directly: '||has_table_privilege('authenticated','public.ps_vans','select');
