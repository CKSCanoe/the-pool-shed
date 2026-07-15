create table products (
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

create table customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  phone text,
  price_list text not null default 'rrp'
    check (price_list in ('rrp', 'trade', 'wholesale', 'contract')),
  created_at timestamptz not null default now()
);

create table customer_addresses (
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

create table locations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  location_type text not null
    check (location_type in ('warehouse', 'shelf', 'engineer_van', 'job_bin', 'customer_site')),
  owner_name text,
  barcode text unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table projects (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers(id),
  name text not null,
  status text not null default 'open',
  site_location_id uuid references locations(id),
  created_at timestamptz not null default now()
);

create table purchase_orders (
  id uuid primary key default gen_random_uuid(),
  po_number text not null unique,
  supplier_name text not null,
  project_id uuid references projects(id),
  status text not null default 'draft'
    check (status in ('draft', 'sent', 'part_received', 'received', 'cancelled')),
  due_date date,
  created_at timestamptz not null default now()
);

create table purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references purchase_orders(id) on delete cascade,
  product_id uuid not null references products(id),
  qty_ordered integer not null check (qty_ordered > 0),
  qty_received integer not null default 0 check (qty_received >= 0),
  unit_cost numeric(12,2) not null default 0
);

create table sales_orders (
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

create table sales_order_items (
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

create table goods_out_notes (
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

create table goods_out_note_items (
  id uuid primary key default gen_random_uuid(),
  goods_out_note_id uuid not null references goods_out_notes(id) on delete cascade,
  sales_order_item_id uuid references sales_order_items(id),
  product_id uuid not null references products(id),
  qty_required integer not null check (qty_required > 0),
  qty_picked integer not null default 0 check (qty_picked >= 0),
  qty_packed integer not null default 0 check (qty_packed >= 0),
  qty_shipped integer not null default 0 check (qty_shipped >= 0)
);

create table notification_events (
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

create table product_serials (
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

create table product_batches (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id),
  batch_number text not null,
  expiry_date date,
  current_location_id uuid references locations(id),
  qty_on_hand integer not null default 0 check (qty_on_hand >= 0),
  created_at timestamptz not null default now(),
  unique (product_id, batch_number, current_location_id)
);

create table stock_balances (
  product_id uuid not null references products(id),
  location_id uuid not null references locations(id),
  qty_on_hand integer not null default 0,
  qty_allocated integer not null default 0,
  primary key (product_id, location_id),
  check (qty_on_hand >= 0),
  check (qty_allocated >= 0),
  check (qty_allocated <= qty_on_hand)
);

create table location_restock_rules (
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

create table stock_allocations (
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

create table stock_movements (
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

create view location_stock_values as
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

create view location_restock_requirements as
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

The SQL itself is broadly valid. The most likely reason it is erroring is that you have already run part of it, so PostgreSQL is finding tables or views that already exist.

For example:

create table products (

will fail with:

ERROR: relation "products" already exists

Your final three tables use create table if not exists, but all the earlier tables and both views do not.

Cleanest fix for a fresh installation

If you do not need any existing data, run this first in Supabase SQL Editor:

drop view if exists public.location_restock_requirements cascade;
drop view if exists public.location_stock_values cascade;

drop table if exists public.sync_audit cascade;
drop table if exists public.workspace_snapshots cascade;
drop table if exists public.user_profiles cascade;

drop table if exists public.stock_movements cascade;
drop table if exists public.stock_allocations cascade;
drop table if exists public.location_restock_rules cascade;
drop table if exists public.stock_balances cascade;
drop table if exists public.product_batches cascade;
drop table if exists public.product_serials cascade;
drop table if exists public.notification_events cascade;
drop table if exists public.goods_out_note_items cascade;
drop table if exists public.goods_out_notes cascade;
drop table if exists public.sales_order_items cascade;
drop table if exists public.sales_orders cascade;
drop table if exists public.purchase_order_items cascade;
drop table if exists public.purchase_orders cascade;
drop table if exists public.projects cascade;
drop table if exists public.locations cascade;
drop table if exists public.customer_addresses cascade;
drop table if exists public.customers cascade;
drop table if exists public.products cascade;

Then run your complete schema again.

Warning: this deletes all information currently held in those tables.

Also add the UUID extension at the top

Place this before the first create table:

create extension if not exists pgcrypto;

This supports:

gen_random_uuid()

Supabase normally has it available, but adding the extension statement makes the schema safer.

Make the views safe to rerun

Replace:

create view location_stock_values as

with:

create or replace view public.location_stock_values as

And replace:

create view location_restock_requirements as

with:

create or replace view public.location_restock_requirements as
Make all table names consistent

I would also add public. to every table and reference. For example:

create table public.products (

and:

customer_id uuid not null references public.customers(id) on delete cascade

That avoids schema/search-path problems.

One further issue with rerunning policies

Your policy section is correctly dropping policies before recreating them. However, it will only work after these tables have successfully been created:

public.user_profiles
public.workspace_snapshots
public.sync_audit

So one earlier error can cause a chain of later errors.

Recommended beginning of the corrected file
create extension if not exists pgcrypto;

create table if not exists public.products (
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

The exact Supabase error message, especially the first red error and line number, would confirm whether it is an existing relation, missing UUID function, dependency issue, or permissions problem.

uid is 1ba42b47-74c1-4bce-bcf5-470bdcf2bba9



Use that UUID as the id in public.user_profiles and as updated_by in the shared workspace row.

Run this after the tables have been created:

insert into public.user_profiles (
  id,
  full_name,
  email,
  role,
  job_title,
  permissions,
  active
)
values (
  '1ba42b47-74c1-4bce-bcf5-470bdcf2bba9',
  'Aaron Boyer',
  'YOUR-LOGIN-EMAIL-HERE',
  'Admin',
  'Sales & Marketing Manager',
  '{
    "admin": true,
    "products": true,
    "customers": true,
    "sales_orders": true,
    "purchase_orders": true,
    "stock": true,
    "settings": true
  }'::jsonb,
  true
)
on conflict (id) do update set
  full_name = excluded.full_name,
  email = excluded.email,
  role = excluded.role,
  job_title = excluded.job_title,
  permissions = excluded.permissions,
  active = excluded.active,
  updated_at = now();

Replace:

YOUR-LOGIN-EMAIL-HERE

with the exact email address used for your Supabase login.

Then create the shared workspace:

insert into public.workspace_snapshots (
  workspace_id,
  data,
  updated_by
)
values (
  'pool-bros-main',
  '{}'::jsonb,
  '1ba42b47-74c1-4bce-bcf5-470bdcf2bba9'
)
on conflict (workspace_id) do update set
  updated_by = excluded.updated_by,
  updated_at = now();

You can confirm the UID exists in Supabase Auth before inserting:

select
  id,
  email,
  created_at
from auth.users
where id = '1ba42b47-74c1-4bce-bcf5-470bdcf2bba9';

That query must return one row. Your user_profiles.id column references auth.users(id), so the profile insert will fail with a foreign-key error if the UUID does not exist in auth.users. Supabase recommends keeping application profile data in a public table linked to auth.users, which is the structure you are using.

There is also one missing policy in your original schema: authenticated users can update their own profile, but there is no policy allowing them to insert their own profile. Add this:

drop policy if exists "users insert own profile"
on public.user_profiles;

create policy "users insert own profile"
on public.user_profiles
for insert
to authenticated
with check ((select auth.uid()) = id);

Your UID should not be hard-coded into the RLS policies. Keep using auth.uid() because it resolves the identity of whichever authenticated user is making the request.

give me the full code to put in that will work and update anything you think could be missing to run my pool shed app effiently 

I’ve prepared a complete clean-install SQL file for your Pool Shed Supabase database:

the-pool-shed-supabase-clean-install.sql

Open Supabase → SQL Editor → New query, paste the entire file in, then press Run.

Important: this script deletes and recreates the existing Pool Shed tables. Any information currently stored in those tables will be removed.

The script includes:

Your admin UID: 1ba42b47-74c1-4bce-bcf5-470bdcf2bba9
Products, suppliers and customer records
Multiple addresses per customer
Sales orders with multiple items and suppliers
Multiple purchase orders linked to one sales order
Projects and job locations
Warehouse, shelves, vans, job bins and customer-site locations
Stock balances, allocations, transfers and movement history
Batch and serial-number tracking
Goods-out and packing notes
Courier and tracking information
Restocking rules
Workspace synchronisation
Audit records
Appropriate database indexes
Automatic updated_at timestamps
Automatic user-profile creation
Row Level Security
Authenticated staff access
Anonymous access blocked
Reporting views for stock value and restocking

I also corrected several areas that could have caused problems in the original version, including missing indexes, incomplete quantity fields, absent supplier records, missing sales-order links on purchase orders, missing update timestamps and incomplete RLS coverage. Supabase recommends enabling RLS on tables exposed through its Data API, particularly where the application connects directly from the browser.

After it runs successfully, the bottom of the results should show your profile as:

Aaron Boyer
Admin
active: true

It should also show the workspace:

pool-bros-main

One possible error remains:

Supabase Auth user ... does not exist

That means the UID is not present under Supabase → Authentication → Users in the same Supabase project. The profile cannot be created until the matching Auth user exists because user_profiles.id is linked directly to auth.users.id. 

Library
/
the-pool-shed-supabase-clean-install.sql
-- THE POOL SHED — CLEAN SUPABASE DATABASE INSTALL
-- IMPORTANT: This script deletes and recreates the Pool Shed app tables.
-- Run it in Supabase Dashboard > SQL Editor as one complete script.

begin;

create extension if not exists pgcrypto;

-- =========================================================
-- 1. REMOVE THE PREVIOUS POOL SHED SCHEMA
-- =========================================================

drop view if exists public.location_restock_requirements cascade;
drop view if exists public.location_stock_values cascade;

drop function if exists public.set_updated_at() cascade;
drop function if exists public.handle_new_user() cascade;

drop table if exists public.sync_audit cascade;
drop table if exists public.workspace_snapshots cascade;
drop table if exists public.stock_movements cascade;
drop table if exists public.stock_allocations cascade;
drop table if exists public.location_restock_rules cascade;
drop table if exists public.stock_balances cascade;
drop table if exists public.product_batches cascade;
drop table if exists public.product_serials cascade;
drop table if exists public.notification_events cascade;
drop table if exists public.goods_out_note_items cascade;
drop table if exists public.goods_out_notes cascade;
drop table if exists public.sales_order_items cascade;
drop table if exists public.sales_orders cascade;
drop table if exists public.purchase_order_items cascade;
drop table if exists public.purchase_orders cascade;
drop table if exists public.projects cascade;
drop table if exists public.customer_addresses cascade;
drop table if exists public.customers cascade;
drop table if exists public.products cascade;
drop table if exists public.suppliers cascade;
drop table if exists public.locations cascade;
drop table if exists public.user_profiles cascade;

-- =========================================================
-- 2. COMMON UPDATED-AT TRIGGER
-- =========================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =========================================================
-- 3. USERS AND PROFILES
-- =========================================================

create table public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text not null default '',
  role text not null default 'Engineer'
    check (role in ('Admin', 'Manager', 'Office', 'Warehouse', 'Engineer', 'Viewer')),
  job_title text,
  phone text,
  avatar_url text,
  permissions jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger user_profiles_set_updated_at
before update on public.user_profiles
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.user_profiles (
    id,
    full_name,
    email,
    role
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''),
    coalesce(new.email, ''),
    'Engineer'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- =========================================================
-- 4. LOCATIONS, SUPPLIERS, PRODUCTS AND CUSTOMERS
-- =========================================================

create table public.locations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  location_type text not null
    check (location_type in (
      'warehouse',
      'shelf',
      'engineer_van',
      'job_bin',
      'customer_site'
    )),
  parent_location_id uuid references public.locations(id) on delete set null,
  owner_name text,
  barcode text unique,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger locations_set_updated_at
before update on public.locations
for each row execute function public.set_updated_at();

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  contact_name text,
  email text,
  phone text,
  account_number text,
  website text,
  address_line_1 text,
  address_line_2 text,
  town_city text,
  county text,
  postcode text,
  country text not null default 'United Kingdom',
  lead_time_days integer not null default 0 check (lead_time_days >= 0),
  minimum_order_value numeric(12,2) not null default 0 check (minimum_order_value >= 0),
  free_shipping_threshold numeric(12,2) check (free_shipping_threshold is null or free_shipping_threshold >= 0),
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger suppliers_set_updated_at
before update on public.suppliers
for each row execute function public.set_updated_at();

create table public.products (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique,
  supplier_sku text,
  name text not null,
  description text,
  category text not null,
  supplier_id uuid references public.suppliers(id) on delete set null,
  supplier_name text,
  barcode text unique,
  unit text not null default 'each',
  track_batch boolean not null default false,
  track_serial boolean not null default false,
  warranty_period text,
  internal_notes text,
  reorder_level integer not null default 0 check (reorder_level >= 0),
  cost_price numeric(12,2) not null default 0 check (cost_price >= 0),
  rrp_price numeric(12,2) not null default 0 check (rrp_price >= 0),
  trade_price numeric(12,2) not null default 0 check (trade_price >= 0),
  wholesale_price numeric(12,2) not null default 0 check (wholesale_price >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger products_set_updated_at
before update on public.products
for each row execute function public.set_updated_at();

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  company_name text,
  email text,
  phone text,
  price_list text not null default 'rrp'
    check (price_list in ('rrp', 'trade', 'wholesale', 'contract')),
  account_reference text,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger customers_set_updated_at
before update on public.customers
for each row execute function public.set_updated_at();

create table public.customer_addresses (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  address_type text not null
    check (address_type in ('primary', 'billing', 'delivery')),
  address_line_1 text not null,
  address_line_2 text,
  town_city text,
  county text,
  postcode text,
  country text not null default 'United Kingdom',
  is_default boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger customer_addresses_set_updated_at
before update on public.customer_addresses
for each row execute function public.set_updated_at();

-- =========================================================
-- 5. PROJECTS AND PURCHASE ORDERS
-- =========================================================

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers(id) on delete set null,
  name text not null,
  reference text,
  status text not null default 'open'
    check (status in ('lead', 'quoted', 'open', 'on_hold', 'completed', 'cancelled')),
  site_location_id uuid references public.locations(id) on delete set null,
  start_date date,
  due_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger projects_set_updated_at
before update on public.projects
for each row execute function public.set_updated_at();

create table public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  po_number text not null unique,
  supplier_id uuid references public.suppliers(id) on delete set null,
  supplier_name text not null,
  project_id uuid references public.projects(id) on delete set null,
  sales_order_id uuid,
  status text not null default 'draft'
    check (status in (
      'draft',
      'sent',
      'acknowledged',
      'part_received',
      'received',
      'cancelled'
    )),
  order_date date not null default current_date,
  due_date date,
  delivery_location_id uuid references public.locations(id) on delete set null,
  supplier_reference text,
  shipping_cost numeric(12,2) not null default 0 check (shipping_cost >= 0),
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger purchase_orders_set_updated_at
before update on public.purchase_orders
for each row execute function public.set_updated_at();

create table public.purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references public.purchase_orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  sku text,
  item_name text,
  qty_ordered integer not null check (qty_ordered > 0),
  qty_received integer not null default 0 check (qty_received >= 0),
  unit_cost numeric(12,2) not null default 0 check (unit_cost >= 0),
  tax_rate numeric(5,2) not null default 20 check (tax_rate >= 0),
  notes text,
  created_at timestamptz not null default now(),
  constraint purchase_order_items_received_not_over
    check (qty_received <= qty_ordered)
);

-- =========================================================
-- 6. SALES ORDERS
-- =========================================================

create table public.sales_orders (
  id uuid primary key default gen_random_uuid(),
  sales_order_number text not null unique,
  customer_id uuid not null references public.customers(id) on delete restrict,
  project_id uuid references public.projects(id) on delete set null,
  price_list text not null default 'rrp'
    check (price_list in ('rrp', 'trade', 'wholesale', 'contract')),
  price_override_reason text,
  primary_address_id uuid references public.customer_addresses(id) on delete set null,
  billing_address_id uuid references public.customer_addresses(id) on delete set null,
  delivery_address_id uuid references public.customer_addresses(id) on delete set null,
  channel text,
  ship_to text,
  carrier text,
  ship_from_location_id uuid references public.locations(id) on delete set null,
  customer_reference text,
  order_date date not null default current_date,
  due_date date,
  priority boolean not null default false,
  status text not null default 'draft'
    check (status in (
      'draft',
      'pending_parts',
      'part_allocated',
      'allocated',
      'ready_to_pick',
      'picking',
      'part_picked',
      'packed',
      'part_shipped',
      'shipped',
      'completed',
      'cancelled'
    )),
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.purchase_orders
  add constraint purchase_orders_sales_order_id_fkey
  foreign key (sales_order_id)
  references public.sales_orders(id)
  on delete set null;

create trigger sales_orders_set_updated_at
before update on public.sales_orders
for each row execute function public.set_updated_at();

create table public.sales_order_items (
  id uuid primary key default gen_random_uuid(),
  sales_order_id uuid not null references public.sales_orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  sku text,
  item_name text,
  supplier_id uuid references public.suppliers(id) on delete set null,
  qty_required integer not null check (qty_required > 0),
  qty_allocated integer not null default 0 check (qty_allocated >= 0),
  qty_picked integer not null default 0 check (qty_picked >= 0),
  qty_packed integer not null default 0 check (qty_packed >= 0),
  qty_shipped integer not null default 0 check (qty_shipped >= 0),
  unit_sell_price numeric(12,2) not null default 0 check (unit_sell_price >= 0),
  unit_cost_price numeric(12,2) not null default 0 check (unit_cost_price >= 0),
  tax_rate numeric(5,2) not null default 20 check (tax_rate >= 0),
  special_price boolean not null default false,
  price_note text,
  notes text,
  created_at timestamptz not null default now(),
  constraint sales_order_items_allocated_not_over
    check (qty_allocated <= qty_required),
  constraint sales_order_items_picked_not_over
    check (qty_picked <= qty_required),
  constraint sales_order_items_packed_not_over
    check (qty_packed <= qty_required),
  constraint sales_order_items_shipped_not_over
    check (qty_shipped <= qty_required)
);

-- =========================================================
-- 7. GOODS OUT, PACKING AND NOTIFICATIONS
-- =========================================================

create table public.goods_out_notes (
  id uuid primary key default gen_random_uuid(),
  goods_note_number text not null unique,
  sales_order_id uuid not null references public.sales_orders(id) on delete cascade,
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
  split_from_goods_note_id uuid references public.goods_out_notes(id) on delete set null,
  stock_deducted boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger goods_out_notes_set_updated_at
before update on public.goods_out_notes
for each row execute function public.set_updated_at();

create table public.goods_out_note_items (
  id uuid primary key default gen_random_uuid(),
  goods_out_note_id uuid not null references public.goods_out_notes(id) on delete cascade,
  sales_order_item_id uuid references public.sales_order_items(id) on delete set null,
  product_id uuid references public.products(id) on delete set null,
  sku text,
  item_name text,
  qty_required integer not null check (qty_required > 0),
  qty_picked integer not null default 0 check (qty_picked >= 0),
  qty_packed integer not null default 0 check (qty_packed >= 0),
  qty_shipped integer not null default 0 check (qty_shipped >= 0),
  created_at timestamptz not null default now(),
  constraint goods_out_items_picked_not_over
    check (qty_picked <= qty_required),
  constraint goods_out_items_packed_not_over
    check (qty_packed <= qty_required),
  constraint goods_out_items_shipped_not_over
    check (qty_shipped <= qty_required)
);

create table public.notification_events (
  id uuid primary key default gen_random_uuid(),
  goods_out_note_id uuid references public.goods_out_notes(id) on delete cascade,
  sales_order_id uuid references public.sales_orders(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  trigger_name text not null,
  channel text not null default 'email'
    check (channel in ('email', 'sms', 'internal')),
  recipient text,
  subject text not null,
  status text not null default 'queued'
    check (status in ('queued', 'ready_to_send', 'sent', 'failed', 'internal_only')),
  payload jsonb not null default '{}'::jsonb,
  error_message text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

-- =========================================================
-- 8. SERIALS, BATCHES AND STOCK
-- =========================================================

create table public.product_serials (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete restrict,
  serial_number text not null unique,
  current_location_id uuid references public.locations(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  sales_order_id uuid references public.sales_orders(id) on delete set null,
  warranty_start_date date,
  warranty_end_date date,
  status text not null default 'in_stock'
    check (status in ('in_stock', 'allocated', 'installed', 'sold', 'returned', 'written_off')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_serials_warranty_dates
    check (
      warranty_end_date is null
      or warranty_start_date is null
      or warranty_end_date >= warranty_start_date
    )
);

create trigger product_serials_set_updated_at
before update on public.product_serials
for each row execute function public.set_updated_at();

create table public.product_batches (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete restrict,
  batch_number text not null,
  expiry_date date,
  current_location_id uuid references public.locations(id) on delete set null,
  qty_on_hand integer not null default 0 check (qty_on_hand >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique nulls not distinct (product_id, batch_number, current_location_id)
);

create trigger product_batches_set_updated_at
before update on public.product_batches
for each row execute function public.set_updated_at();

create table public.stock_balances (
  product_id uuid not null references public.products(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  qty_on_hand integer not null default 0 check (qty_on_hand >= 0),
  qty_allocated integer not null default 0 check (qty_allocated >= 0),
  updated_at timestamptz not null default now(),
  primary key (product_id, location_id),
  check (qty_allocated <= qty_on_hand)
);

create trigger stock_balances_set_updated_at
before update on public.stock_balances
for each row execute function public.set_updated_at();

create table public.location_restock_rules (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  minimum_qty integer not null default 0 check (minimum_qty >= 0),
  maximum_qty integer not null default 0 check (maximum_qty >= 0),
  restock_to_qty integer not null default 0 check (restock_to_qty >= 0),
  priority text not null default 'normal'
    check (priority in ('critical', 'normal', 'low')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, location_id),
  check (maximum_qty >= minimum_qty),
  check (restock_to_qty >= minimum_qty),
  check (maximum_qty = 0 or maximum_qty >= restock_to_qty)
);

create trigger location_restock_rules_set_updated_at
before update on public.location_restock_rules
for each row execute function public.set_updated_at();

create table public.stock_allocations (
  id uuid primary key default gen_random_uuid(),
  sales_order_id uuid references public.sales_orders(id) on delete cascade,
  sales_order_item_id uuid references public.sales_order_items(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  product_id uuid not null references public.products(id) on delete restrict,
  from_location_id uuid not null references public.locations(id) on delete restrict,
  qty integer not null check (qty > 0),
  status text not null default 'allocated'
    check (status in ('allocated', 'picked', 'on_site', 'used', 'returned', 'cancelled')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger stock_allocations_set_updated_at
before update on public.stock_allocations
for each row execute function public.set_updated_at();

create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete restrict,
  qty integer not null check (qty > 0),
  movement_type text not null
    check (movement_type in (
      'goods_in',
      'goods_out',
      'transfer',
      'allocation',
      'unallocation',
      'engineer_sale',
      'used_on_job',
      'return',
      'adjustment'
    )),
  from_location_id uuid references public.locations(id) on delete set null,
  to_location_id uuid references public.locations(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  purchase_order_id uuid references public.purchase_orders(id) on delete set null,
  sales_order_id uuid references public.sales_orders(id) on delete set null,
  reference text,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (from_location_id is not null or to_location_id is not null)
);

-- =========================================================
-- 9. SHARED WORKSPACE AND AUDIT
-- =========================================================

create table public.workspace_snapshots (
  workspace_id text primary key,
  data jsonb not null default '{}'::jsonb,
  version bigint not null default 1 check (version > 0),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create trigger workspace_snapshots_set_updated_at
before update on public.workspace_snapshots
for each row execute function public.set_updated_at();

create table public.sync_audit (
  id bigint generated by default as identity primary key,
  workspace_id text not null,
  user_id uuid references auth.users(id) on delete set null,
  action text not null default 'workspace_save',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- =========================================================
-- 10. INDEXES
-- =========================================================

create index products_name_idx on public.products using btree (name);
create index products_category_idx on public.products using btree (category);
create index products_supplier_id_idx on public.products (supplier_id);
create index products_active_idx on public.products (active);

create index customer_addresses_customer_id_idx on public.customer_addresses (customer_id);
create index projects_customer_id_idx on public.projects (customer_id);
create index projects_status_idx on public.projects (status);

create index purchase_orders_supplier_id_idx on public.purchase_orders (supplier_id);
create index purchase_orders_project_id_idx on public.purchase_orders (project_id);
create index purchase_orders_sales_order_id_idx on public.purchase_orders (sales_order_id);
create index purchase_orders_status_idx on public.purchase_orders (status);
create index purchase_order_items_po_id_idx on public.purchase_order_items (purchase_order_id);
create index purchase_order_items_product_id_idx on public.purchase_order_items (product_id);

create index sales_orders_customer_id_idx on public.sales_orders (customer_id);
create index sales_orders_project_id_idx on public.sales_orders (project_id);
create index sales_orders_status_idx on public.sales_orders (status);
create index sales_orders_due_date_idx on public.sales_orders (due_date);
create index sales_order_items_so_id_idx on public.sales_order_items (sales_order_id);
create index sales_order_items_product_id_idx on public.sales_order_items (product_id);
create index sales_order_items_supplier_id_idx on public.sales_order_items (supplier_id);

create index goods_out_notes_sales_order_id_idx on public.goods_out_notes (sales_order_id);
create index goods_out_notes_tracking_idx on public.goods_out_notes (tracking_reference);
create index goods_out_note_items_note_id_idx on public.goods_out_note_items (goods_out_note_id);

create index notification_events_status_idx on public.notification_events (status);
create index notification_events_sales_order_id_idx on public.notification_events (sales_order_id);

create index product_serials_product_id_idx on public.product_serials (product_id);
create index product_serials_location_id_idx on public.product_serials (current_location_id);
create index product_batches_product_id_idx on public.product_batches (product_id);
create index product_batches_location_id_idx on public.product_batches (current_location_id);
create index product_batches_expiry_date_idx on public.product_batches (expiry_date);

create index stock_balances_location_id_idx on public.stock_balances (location_id);
create index stock_allocations_sales_order_id_idx on public.stock_allocations (sales_order_id);
create index stock_allocations_product_id_idx on public.stock_allocations (product_id);
create index stock_allocations_location_id_idx on public.stock_allocations (from_location_id);
create index stock_movements_product_id_idx on public.stock_movements (product_id);
create index stock_movements_created_at_idx on public.stock_movements (created_at desc);
create index stock_movements_sales_order_id_idx on public.stock_movements (sales_order_id);
create index stock_movements_purchase_order_id_idx on public.stock_movements (purchase_order_id);
create index sync_audit_workspace_created_idx on public.sync_audit (workspace_id, created_at desc);

-- =========================================================
-- 11. REPORTING VIEWS
-- =========================================================

create view public.location_stock_values
with (security_invoker = true)
as
select
  l.id as location_id,
  l.name as location_name,
  l.location_type,
  coalesce(sum(sb.qty_on_hand), 0)::bigint as units_on_hand,
  coalesce(sum(sb.qty_allocated), 0)::bigint as units_allocated,
  coalesce(sum(sb.qty_on_hand * p.cost_price), 0)::numeric(14,2) as cost_value,
  coalesce(sum(sb.qty_on_hand * p.rrp_price), 0)::numeric(14,2) as rrp_value,
  coalesce(sum(sb.qty_on_hand * p.trade_price), 0)::numeric(14,2) as trade_value,
  coalesce(sum(sb.qty_on_hand * p.wholesale_price), 0)::numeric(14,2) as wholesale_value
from public.locations l
left join public.stock_balances sb on sb.location_id = l.id
left join public.products p on p.id = sb.product_id
group by l.id, l.name, l.location_type;

create view public.location_restock_requirements
with (security_invoker = true)
as
select
  lrr.id as restock_rule_id,
  l.id as location_id,
  l.name as location_name,
  l.location_type,
  p.id as product_id,
  p.sku,
  p.name as product_name,
  coalesce(sb.qty_on_hand, 0) as current_qty,
  coalesce(sb.qty_allocated, 0) as allocated_qty,
  greatest(0, coalesce(sb.qty_on_hand, 0) - coalesce(sb.qty_allocated, 0)) as available_qty,
  lrr.minimum_qty,
  lrr.maximum_qty,
  lrr.restock_to_qty,
  greatest(
    0,
    lrr.restock_to_qty -
    greatest(0, coalesce(sb.qty_on_hand, 0) - coalesce(sb.qty_allocated, 0))
  ) as suggested_top_up_qty,
  lrr.priority,
  case
    when greatest(0, coalesce(sb.qty_on_hand, 0) - coalesce(sb.qty_allocated, 0)) < lrr.minimum_qty
      then 'restock'
    when lrr.maximum_qty > 0
      and coalesce(sb.qty_on_hand, 0) > lrr.maximum_qty
      then 'overstocked'
    else 'ok'
  end as restock_status
from public.location_restock_rules lrr
join public.locations l on l.id = lrr.location_id
join public.products p on p.id = lrr.product_id
left join public.stock_balances sb
  on sb.product_id = lrr.product_id
 and sb.location_id = lrr.location_id
where lrr.active = true;

-- =========================================================
-- 12. ROW LEVEL SECURITY
-- Internal shared-workspace model:
-- all signed-in active staff can use operational tables.
-- =========================================================

alter table public.user_profiles enable row level security;
alter table public.locations enable row level security;
alter table public.suppliers enable row level security;
alter table public.products enable row level security;
alter table public.customers enable row level security;
alter table public.customer_addresses enable row level security;
alter table public.projects enable row level security;
alter table public.purchase_orders enable row level security;
alter table public.purchase_order_items enable row level security;
alter table public.sales_orders enable row level security;
alter table public.sales_order_items enable row level security;
alter table public.goods_out_notes enable row level security;
alter table public.goods_out_note_items enable row level security;
alter table public.notification_events enable row level security;
alter table public.product_serials enable row level security;
alter table public.product_batches enable row level security;
alter table public.stock_balances enable row level security;
alter table public.location_restock_rules enable row level security;
alter table public.stock_allocations enable row level security;
alter table public.stock_movements enable row level security;
alter table public.workspace_snapshots enable row level security;
alter table public.sync_audit enable row level security;

-- Profiles
create policy "staff can read profiles"
on public.user_profiles
for select
to authenticated
using (true);

create policy "users can update own profile"
on public.user_profiles
for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

-- Shared operational tables: authenticated users only
create policy "authenticated staff manage locations"
on public.locations for all to authenticated
using (true) with check (true);

create policy "authenticated staff manage suppliers"
on public.suppliers for all to authenticated
using (true) with check (true);

create policy "authenticated staff manage products"
on public.products for all to authenticated
using (true) with check (true);

create policy "authenticated staff manage customers"
on public.customers for all to authenticated
using (true) with check (true);

create policy "authenticated staff manage customer addresses"
on public.customer_addresses for all to authenticated
using (true) with check (true);

create policy "authenticated staff manage projects"
on public.projects for all to authenticated
using (true) with check (true);

create policy "authenticated staff manage purchase orders"
on public.purchase_orders for all to authenticated
using (true) with check (true);

create policy "authenticated staff manage purchase order items"
on public.purchase_order_items for all to authenticated
using (true) with check (true);

create policy "authenticated staff manage sales orders"
on public.sales_orders for all to authenticated
using (true) with check (true);

create policy "authenticated staff manage sales order items"
on public.sales_order_items for all to authenticated
using (true) with check (true);

create policy "authenticated staff manage goods out notes"
on public.goods_out_notes for all to authenticated
using (true) with check (true);

create policy "authenticated staff manage goods out note items"
on public.goods_out_note_items for all to authenticated
using (true) with check (true);

create policy "authenticated staff manage notifications"
on public.notification_events for all to authenticated
using (true) with check (true);

create policy "authenticated staff manage serials"
on public.product_serials for all to authenticated
using (true) with check (true);

create policy "authenticated staff manage batches"
on public.product_batches for all to authenticated
using (true) with check (true);

create policy "authenticated staff manage stock balances"
on public.stock_balances for all to authenticated
using (true) with check (true);

create policy "authenticated staff manage restock rules"
on public.location_restock_rules for all to authenticated
using (true) with check (true);

create policy "authenticated staff manage allocations"
on public.stock_allocations for all to authenticated
using (true) with check (true);

create policy "authenticated staff manage movements"
on public.stock_movements for all to authenticated
using (true) with check (true);

create policy "authenticated workspace read"
on public.workspace_snapshots
for select
to authenticated
using (workspace_id = 'pool-bros-main');

create policy "authenticated workspace insert"
on public.workspace_snapshots
for insert
to authenticated
with check (
  workspace_id = 'pool-bros-main'
  and updated_by = (select auth.uid())
);

create policy "authenticated workspace update"
on public.workspace_snapshots
for update
to authenticated
using (workspace_id = 'pool-bros-main')
with check (
  workspace_id = 'pool-bros-main'
  and updated_by = (select auth.uid())
);

create policy "authenticated audit insert"
on public.sync_audit
for insert
to authenticated
with check (user_id = (select auth.uid()));

create policy "authenticated audit read"
on public.sync_audit
for select
to authenticated
using (true);

-- =========================================================
-- 13. DATA API PERMISSIONS
-- =========================================================

grant usage on schema public to authenticated;

grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on public.location_stock_values to authenticated;
grant select on public.location_restock_requirements to authenticated;
grant usage, select on all sequences in schema public to authenticated;

revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;

-- Keep future objects aligned with the same permissions.
alter default privileges in schema public
grant select, insert, update, delete on tables to authenticated;

alter default privileges in schema public
grant usage, select on sequences to authenticated;

-- =========================================================
-- 14. CREATE AARON'S ADMIN PROFILE AND SHARED WORKSPACE
-- =========================================================

do $$
begin
  if not exists (
    select 1
    from auth.users
    where id = '1ba42b47-74c1-4bce-bcf5-470bdcf2bba9'::uuid
  ) then
    raise exception
      'Supabase Auth user 1ba42b47-74c1-4bce-bcf5-470bdcf2bba9 does not exist. Create/sign in the user first, then rerun this script.';
  end if;
end;
$$;

insert into public.user_profiles (
  id,
  full_name,
  email,
  role,
  job_title,
  permissions,
  active
)
select
  u.id,
  coalesce(
    nullif(u.raw_user_meta_data ->> 'full_name', ''),
    nullif(u.raw_user_meta_data ->> 'name', ''),
    'Aaron Boyer'
  ),
  coalesce(u.email, ''),
  'Admin',
  'Administrator',
  jsonb_build_object(
    'admin', true,
    'products', true,
    'customers', true,
    'suppliers', true,
    'projects', true,
    'sales_orders', true,
    'purchase_orders', true,
    'stock', true,
    'goods_in', true,
    'goods_out', true,
    'reports', true,
    'settings', true,
    'users', true
  ),
  true
from auth.users u
where u.id = '1ba42b47-74c1-4bce-bcf5-470bdcf2bba9'::uuid
on conflict (id) do update set
  full_name = excluded.full_name,
  email = excluded.email,
  role = excluded.role,
  job_title = excluded.job_title,
  permissions = excluded.permissions,
  active = excluded.active,
  updated_at = now();

insert into public.workspace_snapshots (
  workspace_id,
  data,
  version,
  updated_by
)
values (
  'pool-bros-main',
  '{}'::jsonb,
  1,
  '1ba42b47-74c1-4bce-bcf5-470bdcf2bba9'::uuid
)
on conflict (workspace_id) do update set
  updated_by = excluded.updated_by,
  updated_at = now();

insert into public.sync_audit (
  workspace_id,
  user_id,
  action,
  metadata
)
values (
  'pool-bros-main',
  '1ba42b47-74c1-4bce-bcf5-470bdcf2bba9'::uuid,
  'database_install',
  jsonb_build_object('schema_version', 'pool-shed-v2')
);

commit;

-- =========================================================
-- 15. FINAL CHECKS
-- These SELECT statements should return rows without errors.
-- =========================================================

select id, full_name, email, role, active
from public.user_profiles
where id = '1ba42b47-74c1-4bce-bcf5-470bdcf2bba9'::uuid;

select workspace_id, version, updated_by, updated_at
from public.workspace_snapshots
where workspace_id = 'pool-bros-main';

select
  (select count(*) from public.products) as products,
  (select count(*) from public.customers) as customers,
  (select count(*) from public.sales_orders) as sales_orders,
  (select count(*) from public.purchase_orders) as purchase_orders;

Library
/
the-pool-shed-supabase-clean-install.sql
-- THE POOL SHED — CLEAN SUPABASE DATABASE INSTALL
-- IMPORTANT: This script deletes and recreates the Pool Shed app tables.
-- Run it in Supabase Dashboard > SQL Editor as one complete script.

begin;

create extension if not exists pgcrypto;

-- =========================================================
-- 1. REMOVE THE PREVIOUS POOL SHED SCHEMA
-- =========================================================

drop view if exists public.location_restock_requirements cascade;
drop view if exists public.location_stock_values cascade;

drop function if exists public.set_updated_at() cascade;
drop function if exists public.handle_new_user() cascade;

drop table if exists public.sync_audit cascade;
drop table if exists public.workspace_snapshots cascade;
drop table if exists public.stock_movements cascade;
drop table if exists public.stock_allocations cascade;
drop table if exists public.location_restock_rules cascade;
drop table if exists public.stock_balances cascade;
drop table if exists public.product_batches cascade;
drop table if exists public.product_serials cascade;
drop table if exists public.notification_events cascade;
drop table if exists public.goods_out_note_items cascade;
drop table if exists public.goods_out_notes cascade;
drop table if exists public.sales_order_items cascade;
drop table if exists public.sales_orders cascade;
drop table if exists public.purchase_order_items cascade;
drop table if exists public.purchase_orders cascade;
drop table if exists public.projects cascade;
drop table if exists public.customer_addresses cascade;
drop table if exists public.customers cascade;
drop table if exists public.products cascade;
drop table if exists public.suppliers cascade;
drop table if exists public.locations cascade;
drop table if exists public.user_profiles cascade;

-- =========================================================
-- 2. COMMON UPDATED-AT TRIGGER
-- =========================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =========================================================
-- 3. USERS AND PROFILES
-- =========================================================

create table public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text not null default '',
  role text not null default 'Engineer'
    check (role in ('Admin', 'Manager', 'Office', 'Warehouse', 'Engineer', 'Viewer')),
  job_title text,
  phone text,
  avatar_url text,
  permissions jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger user_profiles_set_updated_at
before update on public.user_profiles
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.user_profiles (
    id,
    full_name,
    email,
    role
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''),
    coalesce(new.email, ''),
    'Engineer'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- =========================================================
-- 4. LOCATIONS, SUPPLIERS, PRODUCTS AND CUSTOMERS
-- =========================================================

create table public.locations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  location_type text not null
    check (location_type in (
      'warehouse',
      'shelf',
      'engineer_van',
      'job_bin',
      'customer_site'
    )),
  parent_location_id uuid references public.locations(id) on delete set null,
  owner_name text,
  barcode text unique,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger locations_set_updated_at
before update on public.locations
for each row execute function public.set_updated_at();

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  contact_name text,
  email text,
  phone text,
  account_number text,
  website text,
  address_line_1 text,
  address_line_2 text,
  town_city text,
  county text,
  postcode text,
  country text not null default 'United Kingdom',
  lead_time_days integer not null default 0 check (lead_time_days >= 0),
  minimum_order_value numeric(12,2) not null default 0 check (minimum_order_value >= 0),
  free_shipping_threshold numeric(12,2) check (free_shipping_threshold is null or free_shipping_threshold >= 0),
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger suppliers_set_updated_at
before update on public.suppliers
for each row execute function public.set_updated_at();

create table public.products (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique,
  supplier_sku text,
  name text not null,
  description text,
  category text not null,
  supplier_id uuid references public.suppliers(id) on delete set null,
  supplier_name text,
  barcode text unique,
  unit text not null default 'each',
  track_batch boolean not null default false,
  track_serial boolean not null default false,
  warranty_period text,
  internal_notes text,
  reorder_level integer not null default 0 check (reorder_level >= 0),
  cost_price numeric(12,2) not null default 0 check (cost_price >= 0),
  rrp_price numeric(12,2) not null default 0 check (rrp_price >= 0),
  trade_price numeric(12,2) not null default 0 check (trade_price >= 0),
  wholesale_price numeric(12,2) not null default 0 check (wholesale_price >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger products_set_updated_at
before update on public.products
for each row execute function public.set_updated_at();

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  company_name text,
  email text,
  phone text,
  price_list text not null default 'rrp'
    check (price_list in ('rrp', 'trade', 'wholesale', 'contract')),
  account_reference text,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger customers_set_updated_at
before update on public.customers
for each row execute function public.set_updated_at();

create table public.customer_addresses (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  address_type text not null
    check (address_type in ('primary', 'billing', 'delivery')),
  address_line_1 text not null,
  address_line_2 text,
  town_city text,
  county text,
  postcode text,
  country text not null default 'United Kingdom',
  is_default boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger customer_addresses_set_updated_at
before update on public.customer_addresses
for each row execute function public.set_updated_at();

-- =========================================================
-- 5. PROJECTS AND PURCHASE ORDERS
-- =========================================================

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers(id) on delete set null,
  name text not null,
  reference text,
  status text not null default 'open'
    check (status in ('lead', 'quoted', 'open', 'on_hold', 'completed', 'cancelled')),
  site_location_id uuid references public.locations(id) on delete set null,
  start_date date,
  due_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger projects_set_updated_at
before update on public.projects
for each row execute function public.set_updated_at();

create table public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  po_number text not null unique,
  supplier_id uuid references public.suppliers(id) on delete set null,
  supplier_name text not null,
  project_id uuid references public.projects(id) on delete set null,
  sales_order_id uuid,
  status text not null default 'draft'
    check (status in (
      'draft',
      'sent',
      'acknowledged',
      'part_received',
      'received',
      'cancelled'
    )),
  order_date date not null default current_date,
  due_date date,
  delivery_location_id uuid references public.locations(id) on delete set null,
  supplier_reference text,
  shipping_cost numeric(12,2) not null default 0 check (shipping_cost >= 0),
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger purchase_orders_set_updated_at
before update on public.purchase_orders
for each row execute function public.set_updated_at();

create table public.purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references public.purchase_orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  sku text,
  item_name text,
  qty_ordered integer not null check (qty_ordered > 0),
  qty_received integer not null default 0 check (qty_received >= 0),
  unit_cost numeric(12,2) not null default 0 check (unit_cost >= 0),
  tax_rate numeric(5,2) not null default 20 check (tax_rate >= 0),
  notes text,
  created_at timestamptz not null default now(),
  constraint purchase_order_items_received_not_over
    check (qty_received <= qty_ordered)
);

-- =========================================================
-- 6. SALES ORDERS
-- =========================================================

create table public.sales_orders (
  id uuid primary key default gen_random_uuid(),
  sales_order_number text not null unique,
  customer_id uuid not null references public.customers(id) on delete restrict,
  project_id uuid references public.projects(id) on delete set null,
  price_list text not null default 'rrp'
    check (price_list in ('rrp', 'trade', 'wholesale', 'contract')),
  price_override_reason text,
  primary_address_id uuid references public.customer_addresses(id) on delete set null,
  billing_address_id uuid references public.customer_addresses(id) on delete set null,
  delivery_address_id uuid references public.customer_addresses(id) on delete set null,
  channel text,
  ship_to text,
  carrier text,
  ship_from_location_id uuid references public.locations(id) on delete set null,
  customer_reference text,
  order_date date not null default current_date,
  due_date date,
  priority boolean not null default false,
  status text not null default 'draft'
    check (status in (
      'draft',
      'pending_parts',
      'part_allocated',
      'allocated',
      'ready_to_pick',
      'picking',
      'part_picked',
      'packed',
      'part_shipped',
      'shipped',
      'completed',
      'cancelled'
    )),
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.purchase_orders
  add constraint purchase_orders_sales_order_id_fkey
  foreign key (sales_order_id)
  references public.sales_orders(id)
  on delete set null;

create trigger sales_orders_set_updated_at
before update on public.sales_orders
for each row execute function public.set_updated_at();

create table public.sales_order_items (
  id uuid primary key default gen_random_uuid(),
  sales_order_id uuid not null references public.sales_orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  sku text,
  item_name text,
  supplier_id uuid references public.suppliers(id) on delete set null,
  qty_required integer not null check (qty_required > 0),
  qty_allocated integer not null default 0 check (qty_allocated >= 0),
  qty_picked integer not null default 0 check (qty_picked >= 0),
  qty_packed integer not null default 0 check (qty_packed >= 0),
  qty_shipped integer not null default 0 check (qty_shipped >= 0),
  unit_sell_price numeric(12,2) not null default 0 check (unit_sell_price >= 0),
  unit_cost_price numeric(12,2) not null default 0 check (unit_cost_price >= 0),
  tax_rate numeric(5,2) not null default 20 check (tax_rate >= 0),
  special_price boolean not null default false,
  price_note text,
  notes text,
  created_at timestamptz not null default now(),
  constraint sales_order_items_allocated_not_over
    check (qty_allocated <= qty_required),
  constraint sales_order_items_picked_not_over
    check (qty_picked <= qty_required),
  constraint sales_order_items_packed_not_over
    check (qty_packed <= qty_required),
  constraint sales_order_items_shipped_not_over
    check (qty_shipped <= qty_required)
);

-- =========================================================
-- 7. GOODS OUT, PACKING AND NOTIFICATIONS
-- =========================================================

create table public.goods_out_notes (
  id uuid primary key default gen_random_uuid(),
  goods_note_number text not null unique,
  sales_order_id uuid not null references public.sales_orders(id) on delete cascade,
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
  split_from_goods_note_id uuid references public.goods_out_notes(id) on delete set null,
  stock_deducted boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger goods_out_notes_set_updated_at
before update on public.goods_out_notes
for each row execute function public.set_updated_at();

create table public.goods_out_note_items (
  id uuid primary key default gen_random_uuid(),
  goods_out_note_id uuid not null references public.goods_out_notes(id) on delete cascade,
  sales_order_item_id uuid references public.sales_order_items(id) on delete set null,
  product_id uuid references public.products(id) on delete set null,
  sku text,
  item_name text,
  qty_required integer not null check (qty_required > 0),
  qty_picked integer not null default 0 check (qty_picked >= 0),
  qty_packed integer not null default 0 check (qty_packed >= 0),
  qty_shipped integer not null default 0 check (qty_shipped >= 0),
  created_at timestamptz not null default now(),
  constraint goods_out_items_picked_not_over
    check (qty_picked <= qty_required),
  constraint goods_out_items_packed_not_over
    check (qty_packed <= qty_required),
  constraint goods_out_items_shipped_not_over
    check (qty_shipped <= qty_required)
);

create table public.notification_events (
  id uuid primary key default gen_random_uuid(),
  goods_out_note_id uuid references public.goods_out_notes(id) on delete cascade,
  sales_order_id uuid references public.sales_orders(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  trigger_name text not null,
  channel text not null default 'email'
    check (channel in ('email', 'sms', 'internal')),
  recipient text,
  subject text not null,
  status text not null default 'queued'
    check (status in ('queued', 'ready_to_send', 'sent', 'failed', 'internal_only')),
  payload jsonb not null default '{}'::jsonb,
  error_message text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

-- =========================================================
-- 8. SERIALS, BATCHES AND STOCK
-- =========================================================

create table public.product_serials (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete restrict,
  serial_number text not null unique,
  current_location_id uuid references public.locations(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  sales_order_id uuid references public.sales_orders(id) on delete set null,
  warranty_start_date date,
  warranty_end_date date,
  status text not null default 'in_stock'
    check (status in ('in_stock', 'allocated', 'installed', 'sold', 'returned', 'written_off')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_serials_warranty_dates
    check (
      warranty_end_date is null
      or warranty_start_date is null
      or warranty_end_date >= warranty_start_date
    )
);

create trigger product_serials_set_updated_at
before update on public.product_serials
for each row execute function public.set_updated_at();

create table public.product_batches (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete restrict,
  batch_number text not null,
  expiry_date date,
  current_location_id uuid references public.locations(id) on delete set null,
  qty_on_hand integer not null default 0 check (qty_on_hand >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique nulls not distinct (product_id, batch_number, current_location_id)
);

create trigger product_batches_set_updated_at
before update on public.product_batches
for each row execute function public.set_updated_at();

create table public.stock_balances (
  product_id uuid not null references public.products(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  qty_on_hand integer not null default 0 check (qty_on_hand >= 0),
  qty_allocated integer not null default 0 check (qty_allocated >= 0),
  updated_at timestamptz not null default now(),
  primary key (product_id, location_id),
  check (qty_allocated <= qty_on_hand)
);

create trigger stock_balances_set_updated_at
before update on public.stock_balances
for each row execute function public.set_updated_at();

create table public.location_restock_rules (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  minimum_qty integer not null default 0 check (minimum_qty >= 0),
  maximum_qty integer not null default 0 check (maximum_qty >= 0),
  restock_to_qty integer not null default 0 check (restock_to_qty >= 0),
  priority text not null default 'normal'
    check (priority in ('critical', 'normal', 'low')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, location_id),
  check (maximum_qty >= minimum_qty),
  check (restock_to_qty >= minimum_qty),
  check (maximum_qty = 0 or maximum_qty >= restock_to_qty)
);

create trigger location_restock_rules_set_updated_at
before update on public.location_restock_rules
for each row execute function public.set_updated_at();

create table public.stock_allocations (
  id uuid primary key default gen_random_uuid(),
  sales_order_id uuid references public.sales_orders(id) on delete cascade,
  sales_order_item_id uuid references public.sales_order_items(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  product_id uuid not null references public.products(id) on delete restrict,
  from_location_id uuid not null references public.locations(id) on delete restrict,
  qty integer not null check (qty > 0),
  status text not null default 'allocated'
    check (status in ('allocated', 'picked', 'on_site', 'used', 'returned', 'cancelled')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger stock_allocations_set_updated_at
before update on public.stock_allocations
for each row execute function public.set_updated_at();

create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete restrict,
  qty integer not null check (qty > 0),
  movement_type text not null
    check (movement_type in (
      'goods_in',
      'goods_out',
      'transfer',
      'allocation',
      'unallocation',
      'engineer_sale',
      'used_on_job',
      'return',
      'adjustment'
    )),
  from_location_id uuid references public.locations(id) on delete set null,
  to_location_id uuid references public.locations(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  purchase_order_id uuid references public.purchase_orders(id) on delete set null,
  sales_order_id uuid references public.sales_orders(id) on delete set null,
  reference text,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (from_location_id is not null or to_location_id is not null)
);

-- =========================================================
-- 9. SHARED WORKSPACE AND AUDIT
-- =========================================================

create table public.workspace_snapshots (
  workspace_id text primary key,
  data jsonb not null default '{}'::jsonb,
  version bigint not null default 1 check (version > 0),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create trigger workspace_snapshots_set_updated_at
before update on public.workspace_snapshots
for each row execute function public.set_updated_at();

create table public.sync_audit (
  id bigint generated by default as identity primary key,
  workspace_id text not null,
  user_id uuid references auth.users(id) on delete set null,
  action text not null default 'workspace_save',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- =========================================================
-- 10. INDEXES
-- =========================================================

create index products_name_idx on public.products using btree (name);
create index products_category_idx on public.products using btree (category);
create index products_supplier_id_idx on public.products (supplier_id);
create index products_active_idx on public.products (active);

create index customer_addresses_customer_id_idx on public.customer_addresses (customer_id);
create index projects_customer_id_idx on public.projects (customer_id);
create index projects_status_idx on public.projects (status);

create index purchase_orders_supplier_id_idx on public.purchase_orders (supplier_id);
create index purchase_orders_project_id_idx on public.purchase_orders (project_id);
create index purchase_orders_sales_order_id_idx on public.purchase_orders (sales_order_id);
create index purchase_orders_status_idx on public.purchase_orders (status);
create index purchase_order_items_po_id_idx on public.purchase_order_items (purchase_order_id);
create index purchase_order_items_product_id_idx on public.purchase_order_items (product_id);

create index sales_orders_customer_id_idx on public.sales_orders (customer_id);
create index sales_orders_project_id_idx on public.sales_orders (project_id);
create index sales_orders_status_idx on public.sales_orders (status);
create index sales_orders_due_date_idx on public.sales_orders (due_date);
create index sales_order_items_so_id_idx on public.sales_order_items (sales_order_id);
create index sales_order_items_product_id_idx on public.sales_order_items (product_id);
create index sales_order_items_supplier_id_idx on public.sales_order_items (supplier_id);

create index goods_out_notes_sales_order_id_idx on public.goods_out_notes (sales_order_id);
create index goods_out_notes_tracking_idx on public.goods_out_notes (tracking_reference);
create index goods_out_note_items_note_id_idx on public.goods_out_note_items (goods_out_note_id);

create index notification_events_status_idx on public.notification_events (status);
create index notification_events_sales_order_id_idx on public.notification_events (sales_order_id);

create index product_serials_product_id_idx on public.product_serials (product_id);
create index product_serials_location_id_idx on public.product_serials (current_location_id);
create index product_batches_product_id_idx on public.product_batches (product_id);
create index product_batches_location_id_idx on public.product_batches (current_location_id);
create index product_batches_expiry_date_idx on public.product_batches (expiry_date);

create index stock_balances_location_id_idx on public.stock_balances (location_id);
create index stock_allocations_sales_order_id_idx on public.stock_allocations (sales_order_id);
create index stock_allocations_product_id_idx on public.stock_allocations (product_id);
create index stock_allocations_location_id_idx on public.stock_allocations (from_location_id);
create index stock_movements_product_id_idx on public.stock_movements (product_id);
create index stock_movements_created_at_idx on public.stock_movements (created_at desc);
create index stock_movements_sales_order_id_idx on public.stock_movements (sales_order_id);
create index stock_movements_purchase_order_id_idx on public.stock_movements (purchase_order_id);
create index sync_audit_workspace_created_idx on public.sync_audit (workspace_id, created_at desc);

-- =========================================================
-- 11. REPORTING VIEWS
-- =========================================================

create view public.location_stock_values
with (security_invoker = true)
as
select
  l.id as location_id,
  l.name as location_name,
  l.location_type,
  coalesce(sum(sb.qty_on_hand), 0)::bigint as units_on_hand,
  coalesce(sum(sb.qty_allocated), 0)::bigint as units_allocated,
  coalesce(sum(sb.qty_on_hand * p.cost_price), 0)::numeric(14,2) as cost_value,
  coalesce(sum(sb.qty_on_hand * p.rrp_price), 0)::numeric(14,2) as rrp_value,
  coalesce(sum(sb.qty_on_hand * p.trade_price), 0)::numeric(14,2) as trade_value,
  coalesce(sum(sb.qty_on_hand * p.wholesale_price), 0)::numeric(14,2) as wholesale_value
from public.locations l
left join public.stock_balances sb on sb.location_id = l.id
left join public.products p on p.id = sb.product_id
group by l.id, l.name, l.location_type;

create view public.location_restock_requirements
with (security_invoker = true)
as
select
  lrr.id as restock_rule_id,
  l.id as location_id,
  l.name as location_name,
  l.location_type,
  p.id as product_id,
  p.sku,
  p.name as product_name,
  coalesce(sb.qty_on_hand, 0) as current_qty,
  coalesce(sb.qty_allocated, 0) as allocated_qty,
  greatest(0, coalesce(sb.qty_on_hand, 0) - coalesce(sb.qty_allocated, 0)) as available_qty,
  lrr.minimum_qty,
  lrr.maximum_qty,
  lrr.restock_to_qty,
  greatest(
    0,
    lrr.restock_to_qty -
    greatest(0, coalesce(sb.qty_on_hand, 0) - coalesce(sb.qty_allocated, 0))
  ) as suggested_top_up_qty,
  lrr.priority,
  case
    when greatest(0, coalesce(sb.qty_on_hand, 0) - coalesce(sb.qty_allocated, 0)) < lrr.minimum_qty
      then 'restock'
    when lrr.maximum_qty > 0
      and coalesce(sb.qty_on_hand, 0) > lrr.maximum_qty
      then 'overstocked'
    else 'ok'
  end as restock_status
from public.location_restock_rules lrr
join public.locations l on l.id = lrr.location_id
join public.products p on p.id = lrr.product_id
left join public.stock_balances sb
  on sb.product_id = lrr.product_id
 and sb.location_id = lrr.location_id
where lrr.active = true;

-- =========================================================
-- 12. ROW LEVEL SECURITY
-- Internal shared-workspace model:
-- all signed-in active staff can use operational tables.
-- =========================================================

alter table public.user_profiles enable row level security;
alter table public.locations enable row level security;
alter table public.suppliers enable row level security;
alter table public.products enable row level security;
alter table public.customers enable row level security;
alter table public.customer_addresses enable row level security;
alter table public.projects enable row level security;
alter table public.purchase_orders enable row level security;
alter table public.purchase_order_items enable row level security;
alter table public.sales_orders enable row level security;
alter table public.sales_order_items enable row level security;
alter table public.goods_out_notes enable row level security;
alter table public.goods_out_note_items enable row level security;
alter table public.notification_events enable row level security;
alter table public.product_serials enable row level security;
alter table public.product_batches enable row level security;
alter table public.stock_balances enable row level security;
alter table public.location_restock_rules enable row level security;
alter table public.stock_allocations enable row level security;
alter table public.stock_movements enable row level security;
alter table public.workspace_snapshots enable row level security;
alter table public.sync_audit enable row level security;

-- Profiles
create policy "staff can read profiles"
on public.user_profiles
for select
to authenticated
using (true);

create policy "users can update own profile"
on public.user_profiles
for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

-- Shared operational tables: authenticated users only
create policy "authenticated staff manage locations"
on public.locations for all to authenticated
using (true) with check (true);

create policy "authenticated staff manage suppliers"
on public.suppliers for all to authenticated
using (true) with check (true);

create policy "authenticated staff manage products"
on public.products for all to authenticated
using (true) with check (true);

create policy "authenticated staff manage customers"
on public.customers for all to authenticated
using (true) with check (true);

create policy "authenticated staff manage customer addresses"
on public.customer_addresses for all to authenticated
using (true) with check (true);

create policy "authenticated staff manage projects"
on public.projects for all to authenticated
using (true) with check (true);

create policy "authenticated staff manage purchase orders"
on public.purchase_orders for all to authenticated
using (true) with check (true);

create policy "authenticated staff manage purchase order items"
on public.purchase_order_items for all to authenticated
using (true) with check (true);

create policy "authenticated staff manage sales orders"
on public.sales_orders for all to authenticated
using (true) with check (true);

create policy "authenticated staff manage sales order items"
on public.sales_order_items for all to authenticated
using (true) with check (true);

create policy "authenticated staff manage goods out notes"
on public.goods_out_notes for all to authenticated
using (true) with check (true);

create policy "authenticated staff manage goods out note items"
on public.goods_out_note_items for all to authenticated
using (true) with check (true);

create policy "authenticated staff manage notifications"
on public.notification_events for all to authenticated
using (true) with check (true);

create policy "authenticated staff manage serials"
on public.product_serials for all to authenticated
using (true) with check (true);

create policy "authenticated staff manage batches"
on public.product_batches for all to authenticated
using (true) with check (true);

create policy "authenticated staff manage stock balances"
on public.stock_balances for all to authenticated
using (true) with check (true);

create policy "authenticated staff manage restock rules"
on public.location_restock_rules for all to authenticated
using (true) with check (true);

create policy "authenticated staff manage allocations"
on public.stock_allocations for all to authenticated
using (true) with check (true);

create policy "authenticated staff manage movements"
on public.stock_movements for all to authenticated
using (true) with check (true);

create policy "authenticated workspace read"
on public.workspace_snapshots
for select
to authenticated
using (workspace_id = 'pool-bros-main');

create policy "authenticated workspace insert"
on public.workspace_snapshots
for insert
to authenticated
with check (
  workspace_id = 'pool-bros-main'
  and updated_by = (select auth.uid())
);

create policy "authenticated workspace update"
on public.workspace_snapshots
for update
to authenticated
using (workspace_id = 'pool-bros-main')
with check (
  workspace_id = 'pool-bros-main'
  and updated_by = (select auth.uid())
);

create policy "authenticated audit insert"
on public.sync_audit
for insert
to authenticated
with check (user_id = (select auth.uid()));

create policy "authenticated audit read"
on public.sync_audit
for select
to authenticated
using (true);

-- =========================================================
-- 13. DATA API PERMISSIONS
-- =========================================================

grant usage on schema public to authenticated;

grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on public.location_stock_values to authenticated;
grant select on public.location_restock_requirements to authenticated;
grant usage, select on all sequences in schema public to authenticated;

revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;

-- Keep future objects aligned with the same permissions.
alter default privileges in schema public
grant select, insert, update, delete on tables to authenticated;

alter default privileges in schema public
grant usage, select on sequences to authenticated;

-- =========================================================
-- 14. CREATE AARON'S ADMIN PROFILE AND SHARED WORKSPACE
-- =========================================================

do $$
begin
  if not exists (
    select 1
    from auth.users
    where id = '1ba42b47-74c1-4bce-bcf5-470bdcf2bba9'::uuid
  ) then
    raise exception
      'Supabase Auth user 1ba42b47-74c1-4bce-bcf5-470bdcf2bba9 does not exist. Create/sign in the user first, then rerun this script.';
  end if;
end;
$$;

insert into public.user_profiles (
  id,
  full_name,
  email,
  role,
  job_title,
  permissions,
  active
)
select
  u.id,
  coalesce(
    nullif(u.raw_user_meta_data ->> 'full_name', ''),
    nullif(u.raw_user_meta_data ->> 'name', ''),
    'Aaron Boyer'
  ),
  coalesce(u.email, ''),
  'Admin',
  'Administrator',
  jsonb_build_object(
    'admin', true,
    'products', true,
    'customers', true,
    'suppliers', true,
    'projects', true,
    'sales_orders', true,
    'purchase_orders', true,
    'stock', true,
    'goods_in', true,
    'goods_out', true,
    'reports', true,
    'settings', true,
    'users', true
  ),
  true
from auth.users u
where u.id = '1ba42b47-74c1-4bce-bcf5-470bdcf2bba9'::uuid
on conflict (id) do update set
  full_name = excluded.full_name,
  email = excluded.email,
  role = excluded.role,
  job_title = excluded.job_title,
  permissions = excluded.permissions,
  active = excluded.active,
  updated_at = now();

insert into public.workspace_snapshots (
  workspace_id,
  data,
  version,
  updated_by
)
values (
  'pool-bros-main',
  '{}'::jsonb,
  1,
  '1ba42b47-74c1-4bce-bcf5-470bdcf2bba9'::uuid
)
on conflict (workspace_id) do update set
  updated_by = excluded.updated_by,
  updated_at = now();

insert into public.sync_audit (
  workspace_id,
  user_id,
  action,
  metadata
)
values (
  'pool-bros-main',
  '1ba42b47-74c1-4bce-bcf5-470bdcf2bba9'::uuid,
  'database_install',
  jsonb_build_object('schema_version', 'pool-shed-v2')
);

commit;

-- =========================================================
-- 15. FINAL CHECKS
-- These SELECT statements should return rows without errors.
-- =========================================================

select id, full_name, email, role, active
from public.user_profiles
where id = '1ba42b47-74c1-4bce-bcf5-470bdcf2bba9'::uuid;

select workspace_id, version, updated_by, updated_at
from public.workspace_snapshots
where workspace_id = 'pool-bros-main';

select
  (select count(*) from public.products) as products,
  (select count(*) from public.customers) as customers,
  (select count(*) from public.sales_orders) as sales_orders,
  (select count(*) from public.purchase_orders) as purchase_orders;
