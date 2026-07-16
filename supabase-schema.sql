create extension if not exists pgcrypto;

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique,
  supplier_sku text,
  name text not null,
  category text not null,
  supplier_name text,
  barcode text unique,
  unit text not null default 'each',
  track_batch boolean not null default false,
  track_serial boolean not null default false,
  warranty_period text,
  internal_notes text,
  reorder_level integer not null default 0,
  cost_price numeric(12,2) not null default 0,
  rrp_price numeric(12,2) not null default 0,
  trade_price numeric(12,2) not null default 0,
  wholesale_price numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  phone text,
  price_list text not null default 'rrp'
    check (price_list in ('rrp', 'trade', 'wholesale', 'contract')),
  created_at timestamptz not null default now()
);

create table if not exists customer_addresses (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  address_type text not null
    check (address_type in ('primary', 'billing', 'delivery')),
  address_line_1 text not null,
  address_line_2 text,
  town_city text,
  county text,
  postcode text,
  country text not null default 'United Kingdom',
  is_default boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists locations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  location_type text not null
    check (location_type in ('warehouse', 'shelf', 'engineer_van', 'job_bin', 'customer_site')),
  owner_name text,
  barcode text unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers(id),
  name text not null,
  status text not null default 'open',
  site_location_id uuid references locations(id),
  created_at timestamptz not null default now()
);

create table if not exists purchase_orders (
  id uuid primary key default gen_random_uuid(),
  po_number text not null unique,
  supplier_name text not null,
  project_id uuid references projects(id),
  status text not null default 'draft'
    check (status in ('draft', 'sent', 'part_received', 'received', 'cancelled')),
  due_date date,
  created_at timestamptz not null default now()
);

create table if not exists purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references purchase_orders(id) on delete cascade,
  product_id uuid not null references products(id),
  qty_ordered integer not null check (qty_ordered > 0),
  qty_received integer not null default 0 check (qty_received >= 0),
  unit_cost numeric(12,2) not null default 0
);

create table if not exists sales_orders (
  id uuid primary key default gen_random_uuid(),
  sales_order_number text not null unique,
  customer_id uuid not null references customers(id),
  project_id uuid references projects(id),
  price_list text not null default 'rrp',
  price_override_reason text,
  primary_address_id uuid references customer_addresses(id),
  billing_address_id uuid references customer_addresses(id),
  delivery_address_id uuid references customer_addresses(id),
  channel text,
  ship_to text,
  carrier text,
  ship_from_location_id uuid references locations(id),
  due_date date,
  status text not null default 'draft'
    check (status in ('draft', 'pending_parts', 'allocated', 'ready_to_pick', 'picking', 'packed', 'shipped', 'completed', 'cancelled')),
  created_at timestamptz not null default now()
);

create table if not exists sales_order_items (
  id uuid primary key default gen_random_uuid(),
  sales_order_id uuid not null references sales_orders(id) on delete cascade,
  product_id uuid not null references products(id),
  qty_required integer not null check (qty_required > 0),
  qty_picked integer not null default 0 check (qty_picked >= 0),
  qty_packed integer not null default 0 check (qty_packed >= 0),
  unit_sell_price numeric(12,2) not null default 0,
  special_price boolean not null default false,
  price_note text
);

create table if not exists goods_out_notes (
  id uuid primary key default gen_random_uuid(),
  goods_note_number text not null unique,
  sales_order_id uuid not null references sales_orders(id) on delete cascade,
  template_name text not null default 'packing_note',
  printed_at timestamptz,
  picked_at timestamptz,
  packed_at timestamptz,
  shipped_at timestamptz,
  priority boolean not null default false,
  shipping_method text,
  courier_name text,
  tracking_reference text,
  boxes integer not null default 1 check (boxes > 0),
  weight_text text,
  split_from_goods_note_id uuid references goods_out_notes(id),
  stock_deducted boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists goods_out_note_items (
  id uuid primary key default gen_random_uuid(),
  goods_out_note_id uuid not null references goods_out_notes(id) on delete cascade,
  sales_order_item_id uuid references sales_order_items(id),
  product_id uuid not null references products(id),
  qty_required integer not null check (qty_required > 0),
  qty_picked integer not null default 0 check (qty_picked >= 0),
  qty_packed integer not null default 0 check (qty_packed >= 0),
  qty_shipped integer not null default 0 check (qty_shipped >= 0)
);

create table if not exists notification_events (
  id uuid primary key default gen_random_uuid(),
  goods_out_note_id uuid references goods_out_notes(id) on delete cascade,
  sales_order_id uuid references sales_orders(id) on delete cascade,
  customer_id uuid references customers(id),
  trigger_name text not null,
  channel text not null default 'email',
  subject text not null,
  status text not null default 'queued'
    check (status in ('queued', 'ready_to_send', 'sent', 'failed', 'internal_only')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists product_serials (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id),
  serial_number text not null unique,
  current_location_id uuid references locations(id),
  customer_id uuid references customers(id),
  project_id uuid references projects(id),
  warranty_start_date date,
  warranty_end_date date,
  status text not null default 'in_stock'
    check (status in ('in_stock', 'allocated', 'installed', 'sold', 'returned', 'written_off')),
  created_at timestamptz not null default now()
);

create table if not exists product_batches (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id),
  batch_number text not null,
  expiry_date date,
  current_location_id uuid references locations(id),
  qty_on_hand integer not null default 0 check (qty_on_hand >= 0),
  created_at timestamptz not null default now(),
  unique (product_id, batch_number, current_location_id)
);

create table if not exists stock_balances (
  product_id uuid not null references products(id),
  location_id uuid not null references locations(id),
  qty_on_hand integer not null default 0,
  qty_allocated integer not null default 0,
  primary key (product_id, location_id),
  check (qty_on_hand >= 0),
  check (qty_allocated >= 0),
  check (qty_allocated <= qty_on_hand)
);

create table if not exists location_restock_rules (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id),
  location_id uuid not null references locations(id),
  minimum_qty integer not null default 0 check (minimum_qty >= 0),
  maximum_qty integer not null default 0 check (maximum_qty >= 0),
  restock_to_qty integer not null default 0 check (restock_to_qty >= 0),
  priority text not null default 'normal'
    check (priority in ('critical', 'normal', 'low')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (product_id, location_id),
  check (maximum_qty >= minimum_qty),
  check (restock_to_qty >= minimum_qty),
  check (maximum_qty = 0 or maximum_qty >= restock_to_qty)
);

create table if not exists stock_allocations (
  id uuid primary key default gen_random_uuid(),
  sales_order_id uuid references sales_orders(id),
  project_id uuid references projects(id),
  product_id uuid not null references products(id),
  from_location_id uuid not null references locations(id),
  qty integer not null check (qty > 0),
  status text not null default 'allocated'
    check (status in ('allocated', 'picked', 'on_site', 'used', 'returned', 'cancelled')),
  created_at timestamptz not null default now()
);

create table if not exists stock_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id),
  qty integer not null check (qty > 0),
  movement_type text not null
    check (movement_type in ('goods_in', 'goods_out', 'transfer', 'allocation', 'unallocation', 'engineer_sale', 'used_on_job', 'return', 'adjustment')),
  from_location_id uuid references locations(id),
  to_location_id uuid references locations(id),
  customer_id uuid references customers(id),
  project_id uuid references projects(id),
  purchase_order_id uuid references purchase_orders(id),
  sales_order_id uuid references sales_orders(id),
  reference text,
  created_by text,
  created_at timestamptz not null default now()
);

create or replace view location_stock_values as
select
  l.id as location_id,
  l.name as location_name,
  l.location_type,
  sum(sb.qty_on_hand) as units_on_hand,
  sum(sb.qty_allocated) as units_allocated,
  sum(sb.qty_on_hand * p.cost_price) as cost_value,
  sum(sb.qty_on_hand * p.rrp_price) as rrp_value,
  sum(sb.qty_on_hand * p.trade_price) as trade_value,
  sum(sb.qty_on_hand * p.wholesale_price) as wholesale_value
from locations l
left join stock_balances sb on sb.location_id = l.id
left join products p on p.id = sb.product_id
group by l.id, l.name, l.location_type;

create or replace view location_restock_requirements as
select
  lrr.id as restock_rule_id,
  l.id as location_id,
  l.name as location_name,
  l.location_type,
  p.id as product_id,
  p.sku,
  p.name as product_name,
  coalesce(sb.qty_on_hand, 0) as current_qty,
  lrr.minimum_qty,
  lrr.maximum_qty,
  lrr.restock_to_qty,
  greatest(0, lrr.restock_to_qty - coalesce(sb.qty_on_hand, 0)) as suggested_top_up_qty,
  lrr.priority,
  case
    when coalesce(sb.qty_on_hand, 0) < lrr.minimum_qty then 'restock'
    when lrr.maximum_qty > 0 and coalesce(sb.qty_on_hand, 0) > lrr.maximum_qty then 'overstocked'
    else 'ok'
  end as restock_status
from location_restock_rules lrr
join locations l on l.id = lrr.location_id
join products p on p.id = lrr.product_id
left join stock_balances sb on sb.product_id = lrr.product_id and sb.location_id = lrr.location_id
where lrr.active = true;

-- Pool Shed shared workspace and authenticated profiles
create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  role text not null default 'Engineer',
  job_title text,
  phone text,
  avatar_url text,
  permissions jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspace_snapshots (
  workspace_id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

create table if not exists public.sync_audit (
  id bigint generated by default as identity primary key,
  workspace_id text not null,
  user_id uuid references auth.users(id),
  action text not null default 'workspace_save',
  created_at timestamptz not null default now()
);

alter table public.user_profiles enable row level security;
alter table public.workspace_snapshots enable row level security;
alter table public.sync_audit enable row level security;

drop policy if exists "authenticated users read profiles" on public.user_profiles;
create policy "authenticated users read profiles" on public.user_profiles for select to authenticated using (true);
drop policy if exists "users update own profile" on public.user_profiles;
create policy "users update own profile" on public.user_profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "authenticated workspace read" on public.workspace_snapshots;
create policy "authenticated workspace read" on public.workspace_snapshots for select to authenticated using (workspace_id = 'pool-bros-main');
drop policy if exists "authenticated workspace insert" on public.workspace_snapshots;
create policy "authenticated workspace insert" on public.workspace_snapshots for insert to authenticated with check (workspace_id = 'pool-bros-main' and updated_by = auth.uid());
drop policy if exists "authenticated workspace update" on public.workspace_snapshots;
create policy "authenticated workspace update" on public.workspace_snapshots for update to authenticated using (workspace_id = 'pool-bros-main') with check (workspace_id = 'pool-bros-main' and updated_by = auth.uid());

drop policy if exists "authenticated audit insert" on public.sync_audit;
create policy "authenticated audit insert" on public.sync_audit for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "authenticated audit read" on public.sync_audit;
create policy "authenticated audit read" on public.sync_audit for select to authenticated using (true);
