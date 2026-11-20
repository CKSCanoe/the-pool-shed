-- Pool Shed 027 - private storage for van photos and documents (damage photos, signatures, V5, insurance, MOT,
-- service records). Managers may upload and open files for any van; an engineer only for the van assigned to them
-- (checked in api/media.js with ps_fleet_media_allowed). Additive.
begin;

create table if not exists public.ps_fleet_media (
  id uuid primary key,
  workspace_id text not null,
  van_id text not null,
  asset_kind text not null check (asset_kind in ('damage_photo','check_photo','signature','v5','insurance','mot','service','other')),
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
create index if not exists ps_fleet_media_van on public.ps_fleet_media(workspace_id, van_id, created_at desc);
alter table public.ps_fleet_media enable row level security;
revoke all on public.ps_fleet_media from anon, authenticated;
insert into storage.buckets(id, name, public) values ('fleet-media', 'fleet-media', false) on conflict (id) do nothing;

-- May this signed-in user upload/open files for this van? (managers: any van; engineers: their own van; documents
-- such as V5 and insurance: managers only). Called by the server with the user's own token.
create or replace function public.ps_fleet_media_allowed(w text, van uuid, kind text)
returns boolean language plpgsql stable security definer set search_path=public as $$
declare me jsonb := ps_fleet_me(w);
begin
  if (me->>'manager')::boolean then return true; end if;
  if kind in ('v5','insurance','mot','service','other') then return false; end if;
  return exists(select 1 from ps_vans v where v.id = van and v.workspace_id = w and v.assigned_user = (me->>'uid')::uuid);
end $$;
revoke all on function public.ps_fleet_media_allowed(text,uuid,text) from public, anon;
grant execute on function public.ps_fleet_media_allowed(text,uuid,text) to authenticated;

commit;
