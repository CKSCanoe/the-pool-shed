-- Pool Shed 035 — ready for a web shop (any platform), before the website exists.
-- 1. ps_shop_settings: on/off (starts OFF), platform, shop name and address, and the shared secret the website signs
--    its messages with. The secret is never readable by staff (server code only); staff see the last 4 characters.
-- 2. ps_shop_orders: web orders as received (one row per shop order, so a shop resending the same order changes
--    nothing), waiting in Sales → Web Orders until someone turns them into sales orders (or ignores them).
-- 3. ps_shop_outbox: dispatch updates (shipped, with tracking) waiting to go back to the shop once it is connected.
-- 4. ps_shop_stock: stock available to sell online (warehouse stock less allocations) for products marked to sell
--    online, for the website to read. Server code only.
-- Nothing changes existing records. Rollback: drop the three tables and the ps_shop_* functions.

create table if not exists public.ps_shop_settings (
  workspace_id text primary key,
  enabled boolean not null default false,
  platform text not null default 'none' check (platform in ('none','shopify','woocommerce','other')),
  shop_name text, shop_url text,
  secret text, secret_hint text, secret_set_at timestamptz,
  stock_location_types text[] not null default array['Warehouse','Warehouse Bin'],
  updated_by uuid, updated_at timestamptz not null default now());

create table if not exists public.ps_shop_orders (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null,
  platform text not null,
  external_id text not null,
  external_number text,
  received_at timestamptz not null default now(),
  order_date timestamptz,
  status text not null default 'new' check (status in ('new','imported','ignored')),
  test boolean not null default false,
  customer jsonb not null default '{}'::jsonb,
  billing_address jsonb not null default '{}'::jsonb,
  shipping_address jsonb not null default '{}'::jsonb,
  lines jsonb not null default '[]'::jsonb,
  shipping jsonb not null default '{}'::jsonb,
  totals jsonb not null default '{}'::jsonb,
  payment jsonb not null default '{}'::jsonb,
  note text,
  raw jsonb,
  sales_order_id text,
  handled_by uuid, handled_at timestamptz, handled_note text,
  unique (workspace_id, platform, external_id));
create index if not exists ps_shop_orders_status on public.ps_shop_orders(workspace_id, status, received_at desc);

create table if not exists public.ps_shop_outbox (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null,
  shop_order_id uuid references public.ps_shop_orders(id),
  sales_order_id text not null,
  external_id text,
  kind text not null check (kind in ('shipped','part_shipped','collected','cancelled')),
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'waiting' check (status in ('waiting','sent','failed')),
  attempts integer not null default 0, last_error text,
  created_by uuid, created_at timestamptz not null default now(), sent_at timestamptz);
create index if not exists ps_shop_outbox_status on public.ps_shop_outbox(workspace_id, status, created_at);

alter table public.ps_shop_settings enable row level security;
alter table public.ps_shop_orders enable row level security;
alter table public.ps_shop_outbox enable row level security;
revoke all on public.ps_shop_settings, public.ps_shop_orders, public.ps_shop_outbox from anon, authenticated;

-- Who may do what: managers set the shop up; the office (managers, Accounts, Sales) works the web orders.
create or replace function public.ps_shop_require(w text, managers_only boolean)
returns uuid language plpgsql stable security definer set search_path=public as $$
declare acc jsonb; r text;
begin
  if auth.uid() is null or not ps_workspace_can_read(w) then raise exception 'Workspace access denied'; end if;
  acc := ps_user_access(); r := coalesce(acc->>'role', '');
  if managers_only and r not in ('Admin','Management','Manager') then raise exception 'Only Admin or Management can set up the web shop'; end if;
  if not managers_only and r not in ('Admin','Management','Manager','Accounts','Sales') then raise exception 'Web orders are handled by the office (Admin, Management, Accounts or Sales)'; end if;
  return auth.uid();
end $$;
revoke all on function public.ps_shop_require(text,boolean) from public, anon, authenticated;

create or replace function public.ps_shop_settings_get(w text)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare me uuid := ps_shop_require(w, true); s ps_shop_settings;
begin
  select * into s from ps_shop_settings where workspace_id = w;
  return jsonb_build_object('enabled', coalesce(s.enabled, false), 'platform', coalesce(s.platform, 'none'), 'shop_name', s.shop_name, 'shop_url', s.shop_url,
    'has_secret', s.secret is not null, 'secret_hint', s.secret_hint, 'secret_set_at', s.secret_set_at,
    'stock_location_types', coalesce(to_jsonb(s.stock_location_types), '["Warehouse","Warehouse Bin"]'::jsonb), 'updated_at', s.updated_at,
    'counts', (select jsonb_build_object('new', count(*) filter (where status = 'new'), 'imported', count(*) filter (where status = 'imported'), 'ignored', count(*) filter (where status = 'ignored'))
                 from ps_shop_orders where workspace_id = w),
    'outbox_waiting', (select count(*) from ps_shop_outbox where workspace_id = w and status = 'waiting'));
end $$;
revoke all on function public.ps_shop_settings_get(text) from public, anon;
grant execute on function public.ps_shop_settings_get(text) to authenticated;

-- p: {enabled?, platform?, shop_name?, shop_url?, secret? (set or replace; at least 24 characters), stock_location_types?}
create or replace function public.ps_shop_settings_save(w text, p jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare me uuid := ps_shop_require(w, true); sec text := nullif(trim(coalesce(p->>'secret','')), ''); s ps_shop_settings;
begin
  if p ? 'platform' and coalesce(p->>'platform','') not in ('none','shopify','woocommerce','other') then raise exception 'Unknown shop platform'; end if;
  if sec is not null and length(sec) < 24 then raise exception 'The shop secret must be at least 24 characters'; end if;
  if p ? 'shop_url' and coalesce(p->>'shop_url','') <> '' and p->>'shop_url' !~* '^https://' then raise exception 'The shop address must start with https://'; end if;
  insert into ps_shop_settings(workspace_id) values (w) on conflict do nothing;
  select * into s from ps_shop_settings where workspace_id = w for update;
  if coalesce((p->>'enabled')::boolean, s.enabled) and coalesce(sec, s.secret) is null then raise exception 'Set the shop secret before switching the web shop on'; end if;
  update ps_shop_settings set
    enabled = coalesce((p->>'enabled')::boolean, enabled),
    platform = coalesce(p->>'platform', platform),
    shop_name = case when p ? 'shop_name' then nullif(trim(p->>'shop_name'), '') else shop_name end,
    shop_url = case when p ? 'shop_url' then nullif(trim(p->>'shop_url'), '') else shop_url end,
    secret = coalesce(sec, secret),
    secret_hint = case when sec is not null then right(sec, 4) else secret_hint end,
    secret_set_at = case when sec is not null then now() else secret_set_at end,
    stock_location_types = case when jsonb_typeof(p->'stock_location_types') = 'array' then array(select jsonb_array_elements_text(p->'stock_location_types')) else stock_location_types end,
    updated_by = me, updated_at = now()
  where workspace_id = w;
  return ps_shop_settings_get(w);
end $$;
revoke all on function public.ps_shop_settings_save(text,jsonb) from public, anon;
grant execute on function public.ps_shop_settings_save(text,jsonb) to authenticated;

-- Server only: a web order arrives (already checked against the shop secret and normalised). Same order again = no change.
create or replace function public.ps_shop_order_receive(w text, platform text, o jsonb, raw jsonb default null, is_test boolean default false)
returns jsonb language plpgsql security definer set search_path=public as $$
#variable_conflict use_column
declare rid uuid; dup boolean := false;
begin
  if coalesce(o->>'external_id','') = '' then raise exception 'The order has no id'; end if;
  if coalesce(jsonb_typeof(o->'lines'), '') <> 'array' or jsonb_array_length(o->'lines') = 0 then raise exception 'The order has no lines'; end if;
  insert into ps_shop_orders(workspace_id, platform, external_id, external_number, order_date, test, customer, billing_address, shipping_address, lines, shipping, totals, payment, note, raw)
  values (w, ps_shop_order_receive.platform, o->>'external_id', o->>'external_number', nullif(o->>'order_date','')::timestamptz, is_test,
          coalesce(o->'customer','{}'), coalesce(o->'billing_address','{}'), coalesce(o->'shipping_address','{}'), o->'lines', coalesce(o->'shipping','{}'),
          coalesce(o->'totals','{}'), coalesce(o->'payment','{}'), o->>'note', ps_shop_order_receive.raw)
  on conflict (workspace_id, platform, external_id) do nothing
  returning id into rid;
  if rid is null then
    dup := true;
    select x.id into rid from ps_shop_orders x where x.workspace_id = w and x.platform = ps_shop_order_receive.platform and x.external_id = o->>'external_id';
    -- A later message for an order still waiting can bring its payment up to date (e.g. paid after creation).
    update ps_shop_orders x set payment = coalesce(o->'payment', x.payment) where x.id = rid and x.status = 'new' and coalesce(o->'payment','{}') <> '{}'::jsonb;
  end if;
  return jsonb_build_object('id', rid, 'duplicate', dup);
end $$;
revoke all on function public.ps_shop_order_receive(text,text,jsonb,jsonb,boolean) from public, anon, authenticated;

-- A test order from Settings → Web Shop, so the whole flow can be tried before the website exists.
create or replace function public.ps_shop_test_order(w text, p jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare me uuid := ps_shop_require(w, true);
begin
  return ps_shop_order_receive(w, 'test', p || jsonb_build_object('external_id', 'TEST-' || to_char(now(), 'YYYYMMDDHH24MISS'), 'external_number', 'TEST-' || to_char(now(), 'HH24MISS')), null, true);
end $$;
revoke all on function public.ps_shop_test_order(text,jsonb) from public, anon;
grant execute on function public.ps_shop_test_order(text,jsonb) to authenticated;

create or replace function public.ps_shop_orders_list(w text, which text default 'new', max_rows integer default 200)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare me uuid := ps_shop_require(w, false);
begin
  return coalesce((select jsonb_agg(to_jsonb(x) - 'raw' order by x.received_at desc) from (
    select * from ps_shop_orders where workspace_id = w and (which = 'all' or status = which) order by received_at desc limit greatest(1, least(max_rows, 1000))) x), '[]'::jsonb);
end $$;
revoke all on function public.ps_shop_orders_list(text,text,integer) from public, anon;
grant execute on function public.ps_shop_orders_list(text,text,integer) to authenticated;

-- Imported (with the sales order it became), ignored (with a reason), or back to new.
create or replace function public.ps_shop_order_mark(w text, order_id uuid, new_status text, sales_order text default null, reason text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare me uuid := ps_shop_require(w, false); r ps_shop_orders;
begin
  select * into r from ps_shop_orders where id = order_id and workspace_id = w for update;
  if r.id is null then raise exception 'Web order not found'; end if;
  if new_status = 'imported' then
    if r.status = 'imported' then raise exception 'Web order % is already sales order %', coalesce(r.external_number, r.external_id), r.sales_order_id; end if;
    if coalesce(sales_order, '') = '' then raise exception 'Say which sales order it became'; end if;
  elsif new_status = 'ignored' then
    if r.status = 'imported' then raise exception 'Web order % is already sales order %; cancel that order instead', coalesce(r.external_number, r.external_id), r.sales_order_id; end if;
    if coalesce(trim(reason), '') = '' then raise exception 'Give a reason for ignoring the web order'; end if;
  elsif new_status = 'new' then
    if r.status <> 'ignored' then raise exception 'Only an ignored web order can be brought back'; end if;
  else raise exception 'Unknown status'; end if;
  update ps_shop_orders set status = new_status, sales_order_id = case when new_status = 'imported' then sales_order else null end,
    handled_by = me, handled_at = now(), handled_note = nullif(trim(coalesce(reason, '')), '') where id = r.id;
  return jsonb_build_object('id', r.id, 'status', new_status, 'sales_order_id', case when new_status = 'imported' then sales_order end);
end $$;
revoke all on function public.ps_shop_order_mark(text,uuid,text,text,text) from public, anon;
grant execute on function public.ps_shop_order_mark(text,uuid,text,text,text) to authenticated;

-- A web order was shipped (or collected / cancelled): queue the update for the shop. Not a web order: nothing happens.
create or replace function public.ps_shop_outbox_add(w text, sales_order text, kind text, payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare me uuid := ps_shop_require(w, false); r ps_shop_orders; rid uuid;
begin
  select * into r from ps_shop_orders where workspace_id = w and sales_order_id = sales_order and status = 'imported' limit 1;
  if r.id is null then return null; end if;
  insert into ps_shop_outbox(workspace_id, shop_order_id, sales_order_id, external_id, kind, payload, created_by)
  values (w, r.id, sales_order, r.external_id, kind, coalesce(payload, '{}'::jsonb), me) returning id into rid;
  return jsonb_build_object('id', rid, 'external_id', r.external_id, 'test', r.test);
end $$;
revoke all on function public.ps_shop_outbox_add(text,text,text,jsonb) from public, anon;
grant execute on function public.ps_shop_outbox_add(text,text,text,jsonb) to authenticated;

create or replace function public.ps_shop_outbox_list(w text, max_rows integer default 100)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare me uuid := ps_shop_require(w, true);
begin
  return coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from (
    select b.*, o.external_number, o.test from ps_shop_outbox b left join ps_shop_orders o on o.id = b.shop_order_id
     where b.workspace_id = w order by b.created_at desc limit greatest(1, least(max_rows, 500))) x), '[]'::jsonb);
end $$;
revoke all on function public.ps_shop_outbox_list(text,integer) from public, anon;
grant execute on function public.ps_shop_outbox_list(text,integer) to authenticated;

-- Server only: what can be sold online now, by SKU, for products marked "sell online".
create or replace function public.ps_shop_stock(w text)
returns jsonb language sql stable security definer set search_path=public as $$
  with s as (select coalesce(stock_location_types, array['Warehouse','Warehouse Bin']) t from ps_shop_settings where workspace_id = w),
  locs as (select l.data->>'id' id from ps_records l where l.workspace_id = w and l.section = 'locations' and l.deleted_at is null
            and coalesce(l.data->>'type', 'Warehouse') = any(coalesce((select t from s), array['Warehouse','Warehouse Bin']))),
  prods as (select p.data->>'id' id, p.data->>'sku' sku from ps_records p where p.workspace_id = w and p.section = 'products' and p.deleted_at is null
             and coalesce(p.data->>'sellOnline', 'false') = 'true' and coalesce(p.data->>'sku', '') <> ''),
  st as (select r.data->>'productId' pid, sum(greatest(0, coalesce(ps_num(r.data->'qty'), 0) - coalesce(ps_num(r.data->'allocated'), 0))) avail
           from ps_records r where r.workspace_id = w and r.section = 'stock' and r.deleted_at is null and r.data->>'locationId' in (select id from locs) group by 1)
  select jsonb_build_object('updated_at', now(), 'items', coalesce(jsonb_agg(jsonb_build_object('sku', prods.sku, 'available', floor(coalesce(st.avail, 0))) order by prods.sku), '[]'::jsonb))
    from prods left join st on st.pid = prods.id;
$$;
revoke all on function public.ps_shop_stock(text) from public, anon, authenticated;
