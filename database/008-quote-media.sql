-- Pool Shed v1.32.1 private Quote Media storage and metadata.
-- Run after 007-quote-studio.sql. All media access is mediated by service-role API functions.
begin;

create table if not exists public.ps_quote_media (
  id uuid primary key,
  workspace_id text not null,
  quote_id text not null,
  storage_path text not null unique,
  file_name text not null,
  mime_type text not null check (mime_type in ('image/jpeg','image/png','image/webp','application/pdf')),
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 12582912),
  uploaded_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists ps_quote_media_workspace_quote on public.ps_quote_media(workspace_id, quote_id, created_at desc);
create index if not exists ps_quote_media_workspace_active on public.ps_quote_media(workspace_id, id) where deleted_at is null;

alter table public.ps_quote_media enable row level security;
revoke all on public.ps_quote_media from anon, authenticated;
grant all on public.ps_quote_media to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'quote-media',
  'quote-media',
  false,
  12582912,
  array['image/jpeg','image/png','image/webp','application/pdf']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- No anon/authenticated object policies are created. The service-role Quote API owns upload/sign operations.
commit;
