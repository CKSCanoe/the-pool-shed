-- Pool Shed 031 - van stock (blueprint step 4, owner 21 Nov 2026): each van is linked to its stock location; engineers
-- see the stock on their own van (names and quantities, never costs) and submit a quick stock count from the phone;
-- the count waits for the office, who apply it (stock adjusted and logged in the app) or discard it.
-- Stock itself stays in the workspace records; counts are stored here until applied. Requires 015, 026, 028. Additive.
begin;

alter table public.ps_vans add column if not exists location_id text;

create table if not exists public.ps_van_counts (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null,
  van_id uuid not null references public.ps_vans(id),
  location_id text not null,
  lines jsonb not null,                 -- [{product_id, name, sku, expected, counted}]
  note text,
  status text not null default 'submitted' check (status in ('submitted','applied','discarded')),
  counted_by uuid,
  counted_at timestamptz not null default now(),
  decided_by uuid,
  decided_at timestamptz,
  decision_note text
);
create index if not exists ps_van_counts_van on public.ps_van_counts(workspace_id, van_id, counted_at desc);
alter table public.ps_van_counts enable row level security;
revoke all on public.ps_van_counts from anon, authenticated;

-- Link a van to its stock location (managers).
create or replace function public.ps_fleet_van_link_location(w text, van uuid, loc text)
returns void language plpgsql security definer set search_path=public as $$
declare me jsonb := ps_fleet_me(w);
begin
  if not coalesce((me->>'manager')::boolean, false) then raise exception 'Only Admin or Management can set up van stock'; end if;
  if coalesce(trim(loc), '') = '' then raise exception 'Choose the stock location for this van'; end if;
  if exists(select 1 from ps_vans v where v.workspace_id = w and v.location_id = loc and v.id <> van) then raise exception 'That location is already linked to another van'; end if;
  update ps_vans set location_id = loc where id = van and workspace_id = w;
  if not found then raise exception 'Van not found'; end if;
end $$;
revoke all on function public.ps_fleet_van_link_location(text,uuid,text) from public, anon;
grant execute on function public.ps_fleet_van_link_location(text,uuid,text) to authenticated;

-- What should be on this van now: stock rows at its location plus anything with a minimum there. No costs.
create or replace function public.ps_van_stock(w text, van uuid)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare loc text; reg text; rules jsonb;
begin
  if not ps_fleet_can_report(w, van) then raise exception 'You can only see the van assigned to you'; end if;
  select v.location_id, v.registration into loc, reg from ps_vans v where v.id = van and v.workspace_id = w;
  if loc is null then return jsonb_build_object('van_id', van, 'registration', reg, 'location_id', null, 'items', '[]'::jsonb); end if;
  select coalesce(jsonb_agg(r.data), '[]'::jsonb) into rules from ps_records r
   where r.workspace_id = w and r.section = 'restockRules' and r.deleted_at is null and r.data->>'locationId' = loc;
  return jsonb_build_object('van_id', van, 'registration', reg, 'location_id', loc,
    'last_count', (select jsonb_build_object('status', c.status, 'counted_at', c.counted_at, 'decided_at', c.decided_at)
                     from ps_van_counts c where c.van_id = van order by c.counted_at desc limit 1),
    'items', coalesce((
      with ids as (
        select r.data->>'productId' pid from ps_records r where r.workspace_id = w and r.section = 'stock' and r.deleted_at is null and r.data->>'locationId' = loc
        union select x->>'productId' from jsonb_array_elements(rules) x)
      select jsonb_agg(jsonb_build_object('product_id', i.pid, 'name', coalesce(p.data->>'name', i.pid), 'sku', p.data->>'sku',
               'expected', coalesce((select sum(coalesce(ps_num(s.data->'qty'), 0)) from ps_records s where s.workspace_id = w and s.section = 'stock' and s.deleted_at is null
                                      and s.data->>'locationId' = loc and s.data->>'productId' = i.pid), 0),
               'min', (select ps_num(x->'min') from jsonb_array_elements(rules) x where x->>'productId' = i.pid limit 1),
               'target', (select coalesce(ps_num(x->'restockTo'), ps_num(x->'target')) from jsonb_array_elements(rules) x where x->>'productId' = i.pid limit 1))
             order by coalesce(p.data->>'name', i.pid))
        from ids i left join ps_records p on p.workspace_id = w and p.section = 'products' and p.deleted_at is null and p.key = 'id:' || i.pid
       where i.pid is not null), '[]'::jsonb));
end $$;
revoke all on function public.ps_van_stock(text,uuid) from public, anon;
grant execute on function public.ps_van_stock(text,uuid) to authenticated;

-- An engineer (own van) or a manager submits a count. lines: [{product_id, counted}]; expected is taken from the records.
create or replace function public.ps_van_count_submit(w text, van uuid, lines jsonb, note text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare st jsonb := ps_van_stock(w, van); l jsonb; item jsonb; out jsonb := '[]'::jsonb; id uuid; n numeric;
begin
  if st->>'location_id' is null then raise exception 'This van has no stock location yet. Ask the office to set up van stock.'; end if;
  if exists(select 1 from ps_van_counts c where c.van_id = van and c.status = 'submitted') then
    raise exception 'A count for this van is already waiting for the office. They will apply or discard it first.';
  end if;
  for l in select value from jsonb_array_elements(coalesce(lines, '[]'::jsonb)) loop
    n := ps_num(l->'counted');
    if n is null or n < 0 or n <> floor(n) then raise exception 'Counts must be whole numbers, 0 or more'; end if;
    select x into item from jsonb_array_elements(st->'items') x where x->>'product_id' = l->>'product_id';
    out := out || jsonb_build_object('product_id', l->>'product_id', 'name', coalesce(item->>'name', l->>'product_id'), 'sku', item->>'sku',
                                     'expected', coalesce((item->>'expected')::numeric, 0), 'counted', n);
  end loop;
  if jsonb_array_length(out) = 0 then raise exception 'Count at least one item'; end if;
  insert into ps_van_counts(workspace_id, van_id, location_id, lines, note, counted_by)
  values (w, van, st->>'location_id', out, nullif(trim(coalesce(note, '')), ''), auth.uid()) returning ps_van_counts.id into id;
  return jsonb_build_object('id', id, 'differences', (select count(*) from jsonb_array_elements(out) x where (x->>'counted')::numeric <> (x->>'expected')::numeric));
end $$;
revoke all on function public.ps_van_count_submit(text,uuid,jsonb,text) from public, anon;
grant execute on function public.ps_van_count_submit(text,uuid,jsonb,text) to authenticated;

-- Counts for the office (managers): waiting ones first, then recent decisions.
create or replace function public.ps_van_counts_list(w text)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare me jsonb := ps_fleet_me(w);
begin
  if not coalesce((me->>'manager')::boolean, false) then raise exception 'Only Admin or Management can review van counts'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'van_id', c.van_id, 'registration', v.registration, 'location_id', c.location_id,
      'engineer', (select full_name from user_profiles u where u.id = c.counted_by), 'counted_at', c.counted_at, 'status', c.status, 'note', c.note,
      'lines', c.lines, 'differences', (select count(*) from jsonb_array_elements(c.lines) x where (x->>'counted')::numeric <> (x->>'expected')::numeric))
      order by (c.status = 'submitted') desc, c.counted_at desc)
    from ps_van_counts c join ps_vans v on v.id = c.van_id where c.workspace_id = w and (c.status = 'submitted' or c.counted_at > now() - interval '60 days')), '[]'::jsonb);
end $$;
revoke all on function public.ps_van_counts_list(text) from public, anon;
grant execute on function public.ps_van_counts_list(text) to authenticated;

-- The office records its decision after applying the stock change in the app (or discards the count).
drop function if exists public.ps_van_count_decide(text,uuid,boolean,text);
create or replace function public.ps_van_count_decide(w text, count_id uuid, apply boolean, reason text default null)
returns void language plpgsql security definer set search_path=public as $$
declare me jsonb := ps_fleet_me(w);
begin
  if not coalesce((me->>'manager')::boolean, false) then raise exception 'Only Admin or Management can apply van counts'; end if;
  if (select counted_by from ps_van_counts where id = count_id) = auth.uid() and apply
     and exists(select 1 from ps_van_counts c, jsonb_array_elements(c.lines) x where c.id = count_id and (x->>'counted')::numeric <> (x->>'expected')::numeric) then
    raise exception 'A different person must apply a count with differences that you counted yourself';
  end if;
  update ps_van_counts set status = case when apply then 'applied' else 'discarded' end, decided_by = auth.uid(), decided_at = now(),
         decision_note = nullif(trim(coalesce(reason, '')), '')
   where id = count_id and workspace_id = w and status = 'submitted';
  if not found then raise exception 'That count has already been dealt with'; end if;
end $$;
revoke all on function public.ps_van_count_decide(text,uuid,boolean,text) from public, anon;
grant execute on function public.ps_van_count_decide(text,uuid,boolean,text) to authenticated;

-- The van list also carries each van's stock location.
drop function if exists public.ps_fleet_vans(text);
create or replace function public.ps_fleet_vans(w text)
returns table(id uuid, registration text, make text, model text, variant text, year integer, colour text, fuel_type text, vin text,
              status text, assigned_user uuid, assigned_name text, odometer integer, odometer_at date,
              mot_due date, mot_state text, tax_due date, tax_state text, insurance_provider text, insurance_policy text,
              insurance_due date, insurance_state text, service_due date, service_state text, service_due_miles integer,
              breakdown_provider text, breakdown_due date, notes text, open_damage integer,
              report_status text, report_id uuid, worst_state text, report_review_note text, location_id text)
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
         (select r.review_note from ps_van_reports r where r.van_id = v.id and r.period = p),
         v.location_id
  from ps_vans v
  where v.workspace_id = w and v.status <> 'Sold'
    and ((me->>'manager')::boolean or v.assigned_user = (me->>'uid')::uuid)
  order by v.registration;
end $$;
revoke all on function public.ps_fleet_vans(text) from public, anon;
grant execute on function public.ps_fleet_vans(text) to authenticated;

-- Restock rules (van and location minimums) get a stable key, product + location, like stock rows. Without it every
-- rule made the app fall back to saving the whole workspace. Must match workspaceSectionKeys() in the app exactly.
create or replace function public.ps_section_items(section text, items jsonb)
returns table(key text, ord integer, data jsonb, hash text)
language sql immutable set search_path=public as $$
  with e as (
    select value as data, ordinality::integer as ord,
      coalesce(
        case when jsonb_typeof(value)='object' and value ? 'id' and jsonb_typeof(value->'id') in ('string','number') then 'id:'||(value->>'id') end,
        case when section='stock' and jsonb_typeof(value)='object' then 'stock:'||coalesce(value->>'productId','')||'|'||coalesce(value->>'locationId',value->>'location','') end,
        case when section='restockRules' and jsonb_typeof(value)='object' then 'rule:'||coalesce(value->>'productId','')||'|'||coalesce(value->>'locationId',value->>'location','') end,
        case when jsonb_typeof(value)='object' and coalesce(value->>'name',value->>'label','')<>'' then 'name:'||coalesce(value->>'name',value->>'label') end,
        case when jsonb_typeof(value)='string' then 'text:'||(value#>>'{}') end,
        'hash:'||md5(value::text)
      ) as base_key
    from jsonb_array_elements(case when jsonb_typeof(items)='array' then items else '[]'::jsonb end) with ordinality
  )
  select case when row_number() over w = 1 then base_key else base_key||'#'||row_number() over w end,
         ord, data, md5(data::text)
  from e window w as (partition by base_key order by ord);
$$;
revoke all on function public.ps_section_items(text,jsonb) from public, anon, authenticated;
-- Re-key any rules already stored (none on live at the time of writing). The current revision is pointed at the
-- re-key's change number, so the change feed reports it to every app that opened an older revision; apps already on
-- the current revision work out the same keys from the same content.
do $$
declare s record; v bigint;
begin
  for s in select workspace_id, updated_at, data from public.workspace_snapshots
            where jsonb_typeof(data->'restockRules') = 'array' and jsonb_array_length(data->'restockRules') > 0 loop
    v := nextval('public.ps_record_change_seq');
    perform public.ps_records_sync(s.workspace_id, jsonb_build_object('restockRules', '[]'::jsonb),
              jsonb_build_object('restockRules', s.data->'restockRules'), null::uuid, false, v);
    update public.ps_snapshot_seq set seq = v where workspace_id = s.workspace_id and snapshot_updated_at = s.updated_at;
  end loop;
end $$;

commit;
