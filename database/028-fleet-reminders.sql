-- Pool Shed 028 - monthly van report reminders (owner request 20 Nov 2026).
-- In-app reminders use ps_fleet_vans (026). This adds what the daily email check needs:
--   * who still owes this month's report (engineer, van, status) and which reports wait for sign-off;
--   * a log so nobody is emailed twice about the same thing;
--   * a switch 'fleet_email_reminders' that starts OFF (staff emails need the owner's go-ahead).
-- Schedule: engineers on the 1st, then every 3 days while their report is outstanding (or sent back);
--           managers on the 8th, 15th and 22nd with everything still outstanding or waiting for sign-off.
-- Service role only (the daily check runs on the server). Additive.
begin;

insert into public.ps_feature_flags(name, enabled, note)
values ('fleet_email_reminders', false, 'Email monthly van report reminders to engineers and managers. OFF until the owner approves.')
on conflict (name) do nothing;

create table if not exists public.ps_fleet_reminder_log (
  workspace_id text not null,
  period date not null,
  kind text not null check (kind in ('engineer','manager')),
  recipient uuid not null,
  sent_on date not null,
  detail jsonb not null default '{}'::jsonb,
  primary key (workspace_id, period, kind, recipient, sent_on)
);
alter table public.ps_fleet_reminder_log enable row level security;
revoke all on public.ps_fleet_reminder_log from anon, authenticated;

-- Who should be emailed today (sends nothing; the server sends and then records with ps_fleet_reminder_sent).
create or replace function public.ps_fleet_reminders_due(w text, today date default current_date)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare per date := date_trunc('month', today)::date; dom integer := extract(day from today)::integer; eng jsonb; mgr jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object('user_id', u.id, 'name', u.full_name, 'email', u.email, 'van_id', v.id,
           'registration', v.registration, 'van', v.make || ' ' || v.model, 'status', coalesce(r.status, 'not started'),
           'review_note', r.review_note) order by v.registration), '[]'::jsonb)
    into eng
    from ps_vans v
    join user_profiles u on u.id = v.assigned_user and u.active and coalesce(u.email,'') <> ''
    left join ps_van_reports r on r.van_id = v.id and r.period = per
   where v.workspace_id = w and v.status = 'Active'
     and coalesce(r.status, 'not started') in ('not started','draft','returned')
     and (dom = 1 or (dom - 1) % 3 = 0 or r.status = 'returned')
     and not exists(select 1 from ps_fleet_reminder_log l where l.workspace_id = w and l.period = per and l.kind = 'engineer'
                     and l.recipient = u.id and l.sent_on = today);
  if dom in (8, 15, 22) then
    select coalesce(jsonb_agg(jsonb_build_object('user_id', u.id, 'name', u.full_name, 'email', u.email)), '[]'::jsonb) into mgr
      from user_profiles u
     where u.active and u.role in ('Admin','Management','Manager') and coalesce(u.email,'') <> ''
       and not exists(select 1 from ps_fleet_reminder_log l where l.workspace_id = w and l.period = per and l.kind = 'manager'
                       and l.recipient = u.id and l.sent_on = today);
  else
    mgr := '[]'::jsonb;
  end if;
  return jsonb_build_object('period', per, 'day', dom, 'engineers', eng, 'managers', mgr,
    'outstanding', (select coalesce(jsonb_agg(jsonb_build_object('registration', v.registration, 'engineer', u.full_name,
                      'status', coalesce(r.status, 'not started')) order by v.registration), '[]'::jsonb)
                    from ps_vans v left join user_profiles u on u.id = v.assigned_user
                    left join ps_van_reports r on r.van_id = v.id and r.period = per
                    where v.workspace_id = w and v.status = 'Active' and coalesce(r.status, 'not started') <> 'signed_off'),
    'enabled', coalesce((select enabled from ps_feature_flags where name = 'fleet_email_reminders'), false));
end $$;
revoke all on function public.ps_fleet_reminders_due(text,date) from public, anon, authenticated;
grant execute on function public.ps_fleet_reminders_due(text,date) to service_role;

create or replace function public.ps_fleet_reminder_sent(w text, per date, kind text, recipient uuid, today date, detail jsonb)
returns void language sql security definer set search_path=public as $$
  insert into ps_fleet_reminder_log(workspace_id, period, kind, recipient, sent_on, detail)
  values (w, per, kind, recipient, today, coalesce(detail, '{}'::jsonb)) on conflict do nothing;
$$;
revoke all on function public.ps_fleet_reminder_sent(text,date,text,uuid,date,jsonb) from public, anon, authenticated;
grant execute on function public.ps_fleet_reminder_sent(text,date,text,uuid,date,jsonb) to service_role;

-- The van list also carries this month's review comment (for the "sent back" reminder).
drop function if exists public.ps_fleet_vans(text);
create or replace function public.ps_fleet_vans(w text)
returns table(id uuid, registration text, make text, model text, variant text, year integer, colour text, fuel_type text, vin text,
              status text, assigned_user uuid, assigned_name text, odometer integer, odometer_at date,
              mot_due date, mot_state text, tax_due date, tax_state text, insurance_provider text, insurance_policy text,
              insurance_due date, insurance_state text, service_due date, service_state text, service_due_miles integer,
              breakdown_provider text, breakdown_due date, notes text, open_damage integer,
              report_status text, report_id uuid, worst_state text, report_review_note text)
language plpgsql stable security definer set search_path=public as $$
declare me jsonb := ps_fleet_me(w); p date := date_trunc('month', current_date)::date;
begin
  return query
  select v.id, v.registration, v.make, v.model, v.variant, v.year, v.colour, v.fuel_type, v.vin, v.status, v.assigned_user,
         (select full_name from user_profiles u where u.id = v.assigned_user), v.odometer, v.odometer_at,
         v.mot_due, ps_fleet_due_state(v.mot_due), v.tax_due, ps_fleet_due_state(v.tax_due),
         v.insurance_provider, case when (me->>'manager')::boolean then v.insurance_policy else null end,
         v.insurance_due, ps_fleet_due_state(v.insurance_due), v.service_due, ps_fleet_due_state(v.service_due, 21), v.service_due_miles,
         v.breakdown_provider, v.breakdown_due, v.notes,
         (select count(*)::integer from ps_van_damage dm where dm.van_id = v.id and dm.status = 'Open'),
         coalesce((select r.status from ps_van_reports r where r.van_id = v.id and r.period = p), 'not started'),
         (select r.id from ps_van_reports r where r.van_id = v.id and r.period = p),
         (select s from unnest(array[ps_fleet_due_state(v.mot_due), ps_fleet_due_state(v.tax_due), ps_fleet_due_state(v.insurance_due),
                                     ps_fleet_due_state(v.service_due, 21)]) s
           order by array_position(array['Overdue','Missing','Due soon','OK'], s) limit 1),
         (select r.review_note from ps_van_reports r where r.van_id = v.id and r.period = p)
  from ps_vans v
  where v.workspace_id = w and v.status <> 'Sold'
    and ((me->>'manager')::boolean or v.assigned_user = (me->>'uid')::uuid)
  order by v.registration;
end $$;
revoke all on function public.ps_fleet_vans(text) from public, anon;
grant execute on function public.ps_fleet_vans(text) to authenticated;

commit;
