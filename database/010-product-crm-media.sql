-- Pool Shed v1.34.0 Product Hub + CRM secure media authority
-- Run after 009-quote-process-authority.sql.
-- Product and customer master records remain in the Pool Shed workspace snapshot.
-- Files live in private Supabase Storage and are referenced by stable media IDs.
begin;

create table if not exists public.ps_product_media (
  id uuid primary key,
  workspace_id text not null,
  product_id text not null,
  asset_kind text not null check (asset_kind in (
    'main_image','gallery','brochure','datasheet','installation_guide','warranty','certificate','other'
  )),
  storage_path text not null unique,
  file_name text not null,
  title text,
  alt_text text,
  mime_type text not null check (mime_type in ('image/jpeg','image/png','image/webp','application/pdf')),
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 26214400),
  sort_order integer not null default 0,
  uploaded_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  archived_at timestamptz
);

create index if not exists ps_product_media_product
  on public.ps_product_media(workspace_id,product_id,asset_kind,sort_order,created_at desc);
create index if not exists ps_product_media_active
  on public.ps_product_media(workspace_id,id) where archived_at is null;

create table if not exists public.ps_customer_media (
  id uuid primary key,
  workspace_id text not null,
  customer_id text not null,
  site_key text,
  asset_kind text not null check (asset_kind in (
    'site_photo','drawing','survey','document','access','warranty','certificate','other'
  )),
  storage_path text not null unique,
  file_name text not null,
  title text,
  notes text,
  mime_type text not null check (mime_type in ('image/jpeg','image/png','image/webp','application/pdf')),
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 26214400),
  uploaded_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists ps_customer_media_customer
  on public.ps_customer_media(workspace_id,customer_id,created_at desc);
create index if not exists ps_customer_media_active
  on public.ps_customer_media(workspace_id,id) where deleted_at is null;

alter table public.ps_product_media enable row level security;
alter table public.ps_customer_media enable row level security;
revoke all on public.ps_product_media, public.ps_customer_media from anon,authenticated;
grant all on public.ps_product_media, public.ps_customer_media to service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values(
  'product-media','product-media',false,26214400,
  array['image/jpeg','image/png','image/webp','application/pdf']
)
on conflict(id) do update set
  public=false,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values(
  'customer-media','customer-media',false,26214400,
  array['image/jpeg','image/png','image/webp','application/pdf']
)
on conflict(id) do update set
  public=false,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

-- No anon/authenticated storage policies are created. The service-role media API owns
-- upload/sign/archive actions, just like Quote Media.
commit;
