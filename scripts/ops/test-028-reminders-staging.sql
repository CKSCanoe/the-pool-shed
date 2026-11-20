-- Van report reminder schedule. STAGING ONLY. Rolled back.
begin;
delete from ps_van_reports where van_id in (select id from ps_vans where registration='PB21 VAN');
update ps_vans set assigned_user=(select id from user_profiles where role='Admin' and coalesce(email,'')<>'' order by email limit 1), status='Active' where registration='PB21 VAN';
do $$ declare d date; r jsonb; m date := date_trunc('month', current_date + interval '1 month')::date; begin
  foreach d in array array[m, m+1, m+3, m+7] loop
    r := ps_fleet_reminders_due('pool-bros-main', d);
    raise notice 'day %: engineers % (status %), managers %, outstanding %, switch on: %', extract(day from d), jsonb_array_length(r->'engineers'),
      coalesce(r->'engineers'->0->>'status','-'), jsonb_array_length(r->'managers'), jsonb_array_length(r->'outstanding'), r->>'enabled';
  end loop;
  r := ps_fleet_reminders_due('pool-bros-main', m);
  perform ps_fleet_reminder_sent('pool-bros-main', m, 'engineer', (r->'engineers'->0->>'user_id')::uuid, m, '{}');
  raise notice 'day 1 again after sending: engineers %', jsonb_array_length(ps_fleet_reminders_due('pool-bros-main', m)->'engineers');
  insert into ps_van_reports(workspace_id, van_id, period, status, review_note) select 'pool-bros-main', id, m, 'returned', 'Photo the tyre' from ps_vans where registration='PB21 VAN';
  r := ps_fleet_reminders_due('pool-bros-main', m+1);
  raise notice 'day 2 with a sent-back report: engineers % (status %, note "%")', jsonb_array_length(r->'engineers'), r->'engineers'->0->>'status', r->'engineers'->0->>'review_note';
  update ps_van_reports set status='submitted' where van_id=(select id from ps_vans where registration='PB21 VAN') and period=m;
  raise notice 'day 4 once submitted: engineers %', jsonb_array_length(ps_fleet_reminders_due('pool-bros-main', m+3)->'engineers');
end $$;
rollback;
