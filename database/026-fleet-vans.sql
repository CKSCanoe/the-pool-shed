-- Pool Shed 026 - Vans & Fleet (owner request 20 Nov 2026).
-- Van register (registration, make, model, year, colour, fuel, VIN, mileage, assigned engineer), compliance
-- (MOT, road tax, insurance, service, breakdown cover) with due-soon and overdue status, van supplies (kit list),
-- the engineer's monthly electronic van report (checklist, damage with photos, supplies count, signature) and the
-- manager's sign-off. Rules are enforced here:
--   * engineers see and report only on the van assigned to them;
--   * one report per van per month; a submitted report is locked; mileage cannot go backwards;
--   * every failed check needs a note; submitting needs the engineer's signature;
--   * sign-off is by Admin or Management, never the person who submitted, with their signature;
--   * damage stays on record until it is marked repaired.
-- Additive; no workspace data is changed.
begin;

create table if not exists public.ps_vans (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null,
  registration text not null,
  make text not null,
  model text not null,
  variant text,
  year integer check (year between 1980 and 2100),
  colour text,
  fuel_type text check (fuel_type in ('Diesel','Petrol','Electric','Hybrid','Other')),
  vin text,
  status text not null default 'Active' check (status in ('Active','Off road','In repair','Sold')),
  assigned_user uuid references auth.users(id),
  odometer integer check (odometer >= 0),
  odometer_at date,
  mot_due date,
  tax_due date,
  insurance_provider text,
  insurance_policy text,
  insurance_due date,
  service_due date,
  service_due_miles integer,
  breakdown_provider text,
  breakdown_due date,
  notes text,
  created_by uuid, created_at timestamptz not null default now(),
  updated_by uuid, updated_at timestamptz not null default now()
);
create unique index if not exists ps_vans_registration on public.ps_vans(workspace_id, upper(replace(registration, ' ', '')));

create table if not exists public.ps_van_kit (
  van_id uuid not null references public.ps_vans(id),
  item text not null,
  product_id text,
  target_qty numeric(10,2) not null default 1 check (target_qty >= 0),
  sort integer not null default 0,
  primary key (van_id, item)
);

create table if not exists public.ps_van_checklist_items (
  workspace_id text not null,
  code text not null,
  section text not null,
  label text not null,
  sort integer not null default 0,
  active boolean not null default true,
  primary key (workspace_id, code)
);
insert into public.ps_van_checklist_items(workspace_id, code, section, label, sort) values
  ('pool-bros-main','tyres','Outside','Tyres: tread depth, pressure, no cuts or bulges',10),
  ('pool-bros-main','lights','Outside','Lights and indicators all working',20),
  ('pool-bros-main','mirrors_glass','Outside','Mirrors and windscreen clean, no chips or cracks',30),
  ('pool-bros-main','bodywork','Outside','Bodywork checked (log any dents or scratches below)',40),
  ('pool-bros-main','exterior_clean','Outside','Outside clean and presentable (company image)',50),
  ('pool-bros-main','oil','Under the bonnet','Engine oil level',60),
  ('pool-bros-main','coolant','Under the bonnet','Coolant level',70),
  ('pool-bros-main','screenwash','Under the bonnet','Screenwash topped up',80),
  ('pool-bros-main','warning_lights','Cab','No warning lights on the dashboard',90),
  ('pool-bros-main','brakes','Cab','Brakes and handbrake feel right',100),
  ('pool-bros-main','wipers','Cab','Wipers and horn working',110),
  ('pool-bros-main','cab_clean','Cab','Cab clean and tidy',120),
  ('pool-bros-main','load_secure','Load area','Load area tidy, racking secure, nothing loose',130),
  ('pool-bros-main','chemicals_stored','Load area','Chemicals stored safely and labelled',140),
  ('pool-bros-main','first_aid','Safety','First aid kit present and in date',150),
  ('pool-bros-main','fire_extinguisher','Safety','Fire extinguisher present and in date',160),
  ('pool-bros-main','spill_kit','Safety','Spill kit present',170),
  ('pool-bros-main','ppe','Safety','PPE on board (gloves, goggles, hi-vis)',180)
on conflict do nothing;

create table if not exists public.ps_van_reports (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null,
  van_id uuid not null references public.ps_vans(id),
  period date not null check (period = date_trunc('month', period)::date),
  status text not null default 'draft' check (status in ('draft','submitted','returned','signed_off')),
  odometer integer check (odometer >= 0),
  checklist jsonb not null default '{}'::jsonb,      -- { code: { "ok": true|false, "note": "" } }
  kit_counts jsonb not null default '[]'::jsonb,     -- [ { "item", "expected", "counted" } ]
  notes text,
  engineer_signature_ref text,
  engineer_name text,
  submitted_by uuid, submitted_at timestamptz,
  review_note text,
  manager_signature_ref text,
  manager_name text,
  reviewed_by uuid, reviewed_at timestamptz,
  created_by uuid, created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (van_id, period)
);

create table if not exists public.ps_van_damage (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null,
  van_id uuid not null references public.ps_vans(id),
  report_id uuid references public.ps_van_reports(id),
  area text not null check (area in ('Front','Rear','Left side','Right side','Roof','Windscreen','Interior','Wheels and tyres')),
  severity text not null check (severity in ('Minor scratch','Scratch','Dent','Major damage')),
  description text not null,
  photo_refs text[] not null default '{}',
  status text not null default 'Open' check (status in ('Open','Repaired','Accepted (no repair)')),
  reported_by uuid, reported_at timestamptz not null default now(),
  closed_by uuid, closed_at timestamptz, close_note text
);
create index if not exists ps_van_damage_van on public.ps_van_damage(van_id, status);

alter table public.ps_vans enable row level security;
alter table public.ps_van_kit enable row level security;
alter table public.ps_van_checklist_items enable row level security;
alter table public.ps_van_reports enable row level security;
alter table public.ps_van_damage enable row level security;
revoke all on public.ps_vans, public.ps_van_kit, public.ps_van_checklist_items, public.ps_van_reports, public.ps_van_damage from anon, authenticated;

-- Who is asking: managers (Admin, Management) manage the fleet and sign off; anyone else may only use their own van.
create or replace function public.ps_fleet_me(w text)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare acc jsonb;
begin
  if not ps_workspace_can_read(w) then raise exception 'Workspace access denied'; end if;
  acc := ps_user_access();
  return jsonb_build_object('uid', auth.uid(), 'manager', not coalesce((acc->>'restricted')::boolean, true), 'role', acc->>'role');
end $$;
revoke all on function public.ps_fleet_me(text) from public, anon, authenticated;

create or replace function public.ps_fleet_require_manager(w text)
returns uuid language plpgsql stable security definer set search_path=public as $$
begin
  if not (ps_fleet_me(w)->>'manager')::boolean then raise exception 'Only Admin or Management can manage vans and sign off reports'; end if;
  return auth.uid();
end $$;
revoke all on function public.ps_fleet_require_manager(text) from public, anon, authenticated;

create or replace function public.ps_fleet_due_state(d date, warn_days integer default 30)
returns text language sql immutable as $$
  select case when d is null then 'Missing' when d < current_date then 'Overdue'
              when d <= current_date + warn_days then 'Due soon' else 'OK' end;
$$;

-- Vans this user may see, with compliance and this month's report status.
create or replace function public.ps_fleet_vans(w text)
returns table(id uuid, registration text, make text, model text, variant text, year integer, colour text, fuel_type text, vin text,
              status text, assigned_user uuid, assigned_name text, odometer integer, odometer_at date,
              mot_due date, mot_state text, tax_due date, tax_state text, insurance_provider text, insurance_policy text,
              insurance_due date, insurance_state text, service_due date, service_state text, service_due_miles integer,
              breakdown_provider text, breakdown_due date, notes text, open_damage integer,
              report_status text, report_id uuid, worst_state text)
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
           order by array_position(array['Overdue','Missing','Due soon','OK'], s) limit 1)
  from ps_vans v
  where v.workspace_id = w and v.status <> 'Sold'
    and ((me->>'manager')::boolean or v.assigned_user = (me->>'uid')::uuid)
  order by v.registration;
end $$;
revoke all on function public.ps_fleet_vans(text) from public, anon;
grant execute on function public.ps_fleet_vans(text) to authenticated;

-- Add or update a van (managers). van: {id?, registration, make, model, ... , kit: [{item, target_qty, product_id?}]}
create or replace function public.ps_fleet_van_save(w text, van jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare actor uuid := ps_fleet_require_manager(w); vid uuid := nullif(van->>'id','')::uuid; reg text; k jsonb;
begin
  reg := upper(regexp_replace(coalesce(van->>'registration',''), '\s+', '', 'g'));
  if reg !~ '^[A-Z0-9]{2,8}$' then raise exception 'Enter the registration plate (letters and numbers)'; end if;
  reg := case when reg ~ '^[A-Z]{2}[0-9]{2}[A-Z]{3}$' then substr(reg,1,4) || ' ' || substr(reg,5) else reg end;  -- UK style "AB12 CDE"
  if coalesce(trim(van->>'make'),'') = '' or coalesce(trim(van->>'model'),'') = '' then raise exception 'Enter the make and model'; end if;
  if nullif(van->>'assigned_user','') is not null and not exists(select 1 from user_profiles where id = (van->>'assigned_user')::uuid and active) then
    raise exception 'The assigned engineer must be an active Pool Shed user';
  end if;
  if vid is null then
    insert into ps_vans(workspace_id, registration, make, model, variant, year, colour, fuel_type, vin, status, assigned_user, odometer, odometer_at,
                        mot_due, tax_due, insurance_provider, insurance_policy, insurance_due, service_due, service_due_miles,
                        breakdown_provider, breakdown_due, notes, created_by, updated_by)
    values (w, reg, trim(van->>'make'), trim(van->>'model'), nullif(van->>'variant',''), nullif(van->>'year','')::integer, nullif(van->>'colour',''),
            nullif(van->>'fuel_type',''), nullif(upper(van->>'vin'),''), coalesce(nullif(van->>'status',''),'Active'), nullif(van->>'assigned_user','')::uuid,
            nullif(van->>'odometer','')::integer, case when nullif(van->>'odometer','') is not null then current_date end,
            nullif(van->>'mot_due','')::date, nullif(van->>'tax_due','')::date, nullif(van->>'insurance_provider',''), nullif(van->>'insurance_policy',''),
            nullif(van->>'insurance_due','')::date, nullif(van->>'service_due','')::date, nullif(van->>'service_due_miles','')::integer,
            nullif(van->>'breakdown_provider',''), nullif(van->>'breakdown_due','')::date, nullif(van->>'notes',''), actor, actor)
    returning ps_vans.id into vid;
  else
    update ps_vans v set registration = reg, make = trim(van->>'make'), model = trim(van->>'model'), variant = nullif(van->>'variant',''),
           year = nullif(van->>'year','')::integer, colour = nullif(van->>'colour',''), fuel_type = nullif(van->>'fuel_type',''),
           vin = nullif(upper(van->>'vin'),''), status = coalesce(nullif(van->>'status',''), v.status), assigned_user = nullif(van->>'assigned_user','')::uuid,
           mot_due = nullif(van->>'mot_due','')::date, tax_due = nullif(van->>'tax_due','')::date,
           insurance_provider = nullif(van->>'insurance_provider',''), insurance_policy = nullif(van->>'insurance_policy',''),
           insurance_due = nullif(van->>'insurance_due','')::date, service_due = nullif(van->>'service_due','')::date,
           service_due_miles = nullif(van->>'service_due_miles','')::integer, breakdown_provider = nullif(van->>'breakdown_provider',''),
           breakdown_due = nullif(van->>'breakdown_due','')::date, notes = nullif(van->>'notes',''), updated_by = actor, updated_at = now()
     where v.id = vid and v.workspace_id = w;
    if not found then raise exception 'Van not found'; end if;
  end if;
  if jsonb_typeof(van->'kit') = 'array' then
    delete from ps_van_kit where van_id = vid;
    for k in select value from jsonb_array_elements(van->'kit') loop
      if coalesce(trim(k->>'item'),'') <> '' then
        insert into ps_van_kit(van_id, item, product_id, target_qty, sort) values (vid, trim(k->>'item'), nullif(k->>'product_id',''),
          coalesce(nullif(k->>'target_qty','')::numeric, 1), coalesce(nullif(k->>'sort','')::integer, 0))
        on conflict (van_id, item) do update set target_qty = excluded.target_qty, product_id = excluded.product_id, sort = excluded.sort;
      end if;
    end loop;
  end if;
  return jsonb_build_object('id', vid, 'registration', reg);
end $$;
revoke all on function public.ps_fleet_van_save(text,jsonb) from public, anon;
grant execute on function public.ps_fleet_van_save(text,jsonb) to authenticated;

-- Can this user work on this van's report? (assigned engineer, or a manager)
create or replace function public.ps_fleet_can_report(w text, van uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select (ps_fleet_me(w)->>'manager')::boolean or exists(select 1 from ps_vans v where v.id = van and v.workspace_id = w and v.assigned_user = auth.uid());
$$;
revoke all on function public.ps_fleet_can_report(text,uuid) from public, anon, authenticated;

-- Open (or create) this month's report for a van, with the checklist, kit list, known open damage and last mileage.
create or replace function public.ps_fleet_report_open(w text, van uuid, p date default current_date)
returns jsonb language plpgsql security definer set search_path=public as $$
declare rid uuid; per date := date_trunc('month', coalesce(p, current_date))::date; r ps_van_reports;
begin
  if not ps_fleet_can_report(w, van) then raise exception 'You can only report on the van assigned to you'; end if;
  select * into r from ps_van_reports where van_id = van and period = per;
  if r.id is null then
    insert into ps_van_reports(workspace_id, van_id, period, created_by, kit_counts)
    values (w, van, per, auth.uid(), coalesce((select jsonb_agg(jsonb_build_object('item', k.item, 'expected', k.target_qty, 'counted', null) order by k.sort, k.item)
                                               from ps_van_kit k where k.van_id = van), '[]'::jsonb))
    returning * into r;
  end if;
  return jsonb_build_object('report', to_jsonb(r),
    'van', (select to_jsonb(x) from (select id, registration, make, model, colour, odometer, odometer_at from ps_vans where id = van) x),
    'checklist', (select coalesce(jsonb_agg(jsonb_build_object('code', code, 'section', section, 'label', label) order by sort), '[]'::jsonb)
                  from ps_van_checklist_items where workspace_id = w and active),
    'open_damage', (select coalesce(jsonb_agg(to_jsonb(d) order by d.reported_at desc), '[]'::jsonb) from ps_van_damage d where d.van_id = van and d.status = 'Open'),
    'last_signed_off', (select to_jsonb(x) from (select period, odometer, reviewed_at, manager_name from ps_van_reports
                                                 where van_id = van and status = 'signed_off' and period < per order by period desc limit 1) x));
end $$;
revoke all on function public.ps_fleet_report_open(text,uuid,date) from public, anon;
grant execute on function public.ps_fleet_report_open(text,uuid,date) to authenticated;

-- Save progress (draft or returned only). patch: {odometer?, checklist?, kit_counts?, notes?}
create or replace function public.ps_fleet_report_save(w text, report uuid, patch jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare r ps_van_reports;
begin
  select * into r from ps_van_reports where id = report and workspace_id = w;
  if r.id is null then raise exception 'Report not found'; end if;
  if not ps_fleet_can_report(w, r.van_id) then raise exception 'You can only report on the van assigned to you'; end if;
  if r.status not in ('draft','returned') then raise exception 'This report has been submitted and is locked'; end if;
  update ps_van_reports set
    odometer = coalesce(nullif(patch->>'odometer','')::integer, odometer),
    checklist = coalesce(case when jsonb_typeof(patch->'checklist') = 'object' then checklist || (patch->'checklist') end, checklist),
    kit_counts = coalesce(case when jsonb_typeof(patch->'kit_counts') = 'array' then patch->'kit_counts' end, kit_counts),
    notes = coalesce(patch->>'notes', notes), updated_at = now()
  where id = report;
  return jsonb_build_object('saved', true);
end $$;
revoke all on function public.ps_fleet_report_save(text,uuid,jsonb) from public, anon;
grant execute on function public.ps_fleet_report_save(text,uuid,jsonb) to authenticated;

-- Log a dent, scratch or other damage against a report (photos uploaded first; refs passed in).
create or replace function public.ps_fleet_damage_add(w text, report uuid, damage jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare r ps_van_reports; did uuid;
begin
  select * into r from ps_van_reports where id = report and workspace_id = w;
  if r.id is null then raise exception 'Report not found'; end if;
  if not ps_fleet_can_report(w, r.van_id) then raise exception 'You can only report on the van assigned to you'; end if;
  if r.status not in ('draft','returned') then raise exception 'This report has been submitted and is locked'; end if;
  if coalesce(trim(damage->>'description'),'') = '' then raise exception 'Describe the damage'; end if;
  if jsonb_array_length(coalesce(damage->'photo_refs','[]'::jsonb)) = 0 then raise exception 'Add at least one photo of the damage'; end if;
  insert into ps_van_damage(workspace_id, van_id, report_id, area, severity, description, photo_refs, reported_by)
  values (w, r.van_id, report, damage->>'area', damage->>'severity', trim(damage->>'description'),
          array(select jsonb_array_elements_text(damage->'photo_refs')), auth.uid())
  returning id into did;
  return jsonb_build_object('id', did);
end $$;
revoke all on function public.ps_fleet_damage_add(text,uuid,jsonb) from public, anon;
grant execute on function public.ps_fleet_damage_add(text,uuid,jsonb) to authenticated;

-- Submit: everything answered, failures explained, mileage not going backwards, kit counted, signed.
create or replace function public.ps_fleet_report_submit(w text, report uuid, signature_ref text, signed_name text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare r ps_van_reports; v ps_vans; missing text; unexplained text; uncounted integer;
begin
  select * into r from ps_van_reports where id = report and workspace_id = w for update;
  if r.id is null then raise exception 'Report not found'; end if;
  if not ps_fleet_can_report(w, r.van_id) then raise exception 'You can only report on the van assigned to you'; end if;
  if r.status not in ('draft','returned') then raise exception 'This report has already been submitted'; end if;
  select * into v from ps_vans where id = r.van_id;
  if r.odometer is null then raise exception 'Enter the mileage'; end if;
  if v.odometer is not null and r.odometer < v.odometer then raise exception 'The mileage (%) is lower than last recorded (%)', r.odometer, v.odometer; end if;
  select string_agg(i.label, '; ' order by i.sort) into missing from ps_van_checklist_items i
   where i.workspace_id = w and i.active and not (r.checklist ? i.code and jsonb_typeof(r.checklist->i.code->'ok') = 'boolean');
  if missing is not null then raise exception 'Answer every check: %', missing; end if;
  select string_agg(i.label, '; ' order by i.sort) into unexplained from ps_van_checklist_items i
   where i.workspace_id = w and i.active and (r.checklist->i.code->>'ok') = 'false' and coalesce(trim(r.checklist->i.code->>'note'),'') = '';
  if unexplained is not null then raise exception 'Add a note for each failed check: %', unexplained; end if;
  select count(*) into uncounted from jsonb_array_elements(r.kit_counts) k where k->'counted' is null or jsonb_typeof(k->'counted') <> 'number';
  if uncounted > 0 then raise exception 'Count every item on the van supplies list (% not counted)', uncounted; end if;
  if coalesce(trim(signature_ref),'') = '' or coalesce(trim(signed_name),'') = '' then raise exception 'Sign the report and type your name'; end if;
  update ps_van_reports set status = 'submitted', engineer_signature_ref = signature_ref, engineer_name = trim(signed_name),
         submitted_by = auth.uid(), submitted_at = now(), updated_at = now() where id = report;
  update ps_vans set odometer = r.odometer, odometer_at = current_date where id = r.van_id;
  return jsonb_build_object('status', 'submitted');
end $$;
revoke all on function public.ps_fleet_report_submit(text,uuid,text,text) from public, anon;
grant execute on function public.ps_fleet_report_submit(text,uuid,text,text) to authenticated;

-- Manager review: sign off (with signature) or send back with a reason. Never the person who submitted it.
create or replace function public.ps_fleet_report_review(w text, report uuid, approve boolean, note text, signature_ref text, signed_name text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare actor uuid := ps_fleet_require_manager(w); r ps_van_reports;
begin
  select * into r from ps_van_reports where id = report and workspace_id = w for update;
  if r.id is null or r.status <> 'submitted' then raise exception 'This report is not waiting for sign-off'; end if;
  if r.submitted_by = actor then raise exception 'A different person must sign off a report you submitted'; end if;
  if approve then
    if coalesce(trim(signature_ref),'') = '' or coalesce(trim(signed_name),'') = '' then raise exception 'Sign and type your name to sign off'; end if;
    update ps_van_reports set status = 'signed_off', review_note = nullif(trim(note),''), manager_signature_ref = signature_ref,
           manager_name = trim(signed_name), reviewed_by = actor, reviewed_at = now(), updated_at = now() where id = report;
  else
    if coalesce(trim(note),'') = '' then raise exception 'Say what needs doing before it can be signed off'; end if;
    update ps_van_reports set status = 'returned', review_note = trim(note), reviewed_by = actor, reviewed_at = now(), updated_at = now() where id = report;
  end if;
  return jsonb_build_object('status', case when approve then 'signed_off' else 'returned' end);
end $$;
revoke all on function public.ps_fleet_report_review(text,uuid,boolean,text,text,text) from public, anon;
grant execute on function public.ps_fleet_report_review(text,uuid,boolean,text,text,text) to authenticated;

-- Close damage (managers): repaired, or accepted without repair, with a note.
create or replace function public.ps_fleet_damage_close(w text, damage uuid, outcome text, note text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare actor uuid := ps_fleet_require_manager(w);
begin
  if outcome not in ('Repaired','Accepted (no repair)') then raise exception 'Choose Repaired or Accepted (no repair)'; end if;
  if coalesce(trim(note),'') = '' then raise exception 'Add a note (e.g. who repaired it and the cost)'; end if;
  update ps_van_damage set status = outcome, closed_by = actor, closed_at = now(), close_note = trim(note)
   where id = damage and workspace_id = w and status = 'Open';
  if not found then raise exception 'Open damage record not found'; end if;
  return jsonb_build_object('status', outcome);
end $$;
revoke all on function public.ps_fleet_damage_close(text,uuid,text,text) from public, anon;
grant execute on function public.ps_fleet_damage_close(text,uuid,text,text) to authenticated;

-- Report history for a van (managers see all vans; engineers their own).
create or replace function public.ps_fleet_reports(w text, van uuid)
returns table(id uuid, period date, status text, odometer integer, engineer_name text, submitted_at timestamptz,
              manager_name text, reviewed_at timestamptz, review_note text, failed_checks integer, kit_short integer, damage_logged integer)
language plpgsql stable security definer set search_path=public as $$
begin
  if not ps_fleet_can_report(w, van) then raise exception 'You can only see the van assigned to you'; end if;
  return query
  select r.id, r.period, r.status, r.odometer, r.engineer_name, r.submitted_at, r.manager_name, r.reviewed_at, r.review_note,
         (select count(*)::integer from jsonb_each(r.checklist) c where c.value->>'ok' = 'false'),
         (select count(*)::integer from jsonb_array_elements(r.kit_counts) k where (k->>'counted')::numeric < (k->>'expected')::numeric),
         (select count(*)::integer from ps_van_damage d where d.report_id = r.id)
  from ps_van_reports r where r.van_id = van and r.workspace_id = w order by r.period desc limit 36;
end $$;
revoke all on function public.ps_fleet_reports(text,uuid) from public, anon;
grant execute on function public.ps_fleet_reports(text,uuid) to authenticated;

commit;
