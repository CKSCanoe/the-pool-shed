-- Van report reminder schedule on live with a temporary van. Rolled back: nothing is kept, nothing is emailed.
begin;
insert into ps_vans(id, workspace_id, registration, make, model, status, assigned_user)
values ('00000000-0000-4000-8000-000000000028', 'pool-bros-main', 'ZZ28 TST', 'Test', 'Van', 'Active',
        (select id from user_profiles where active and coalesce(email,'')<>'' order by email limit 1));
do $$ declare d date; r jsonb; m date := date_trunc('month', current_date + interval '1 month')::date;
  v uuid := '00000000-0000-4000-8000-000000000028'; begin
  foreach d in array array[m, m+1, m+3, m+7] loop
    r := ps_fleet_reminders_due('pool-bros-main', d);
    raise notice 'day %: engineers %, managers %, outstanding %, switch on: %', extract(day from d),
      jsonb_array_length(r->'engineers'), jsonb_array_length(r->'managers'), jsonb_array_length(r->'outstanding'), r->>'enabled';
  end loop;
  r := ps_fleet_reminders_due('pool-bros-main', m);
  perform ps_fleet_reminder_sent('pool-bros-main', m, 'engineer', (r->'engineers'->0->>'user_id')::uuid, m, '{}');
  raise notice 'day 1 again after sending: engineers %', jsonb_array_length(ps_fleet_reminders_due('pool-bros-main', m)->'engineers');
  insert into ps_van_reports(workspace_id, van_id, period, status, review_note) values ('pool-bros-main', v, m, 'returned', 'test');
  raise notice 'day 2 sent back: engineers % (status %)', jsonb_array_length(ps_fleet_reminders_due('pool-bros-main', m+1)->'engineers'),
    ps_fleet_reminders_due('pool-bros-main', m+1)->'engineers'->0->>'status';
  update ps_van_reports set status='submitted' where van_id=v and period=m;
  raise notice 'day 4 once submitted: engineers %', jsonb_array_length(ps_fleet_reminders_due('pool-bros-main', m+3)->'engineers');
end $$;
rollback;
