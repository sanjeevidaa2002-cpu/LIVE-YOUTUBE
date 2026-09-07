-- =====================================================================
-- StreamVault — Admin Control Panel migration
-- =====================================================================
-- ADDITIVE and IDEMPOTENT. Safe to run on an existing database that
-- already contains data: it creates nothing that exists, drops no
-- tables, and deletes no rows.
--
-- Run once in the Supabase SQL Editor (Project -> SQL Editor -> New query).
-- A fresh install can instead run supabase/schema.sql, which already
-- includes everything below.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. videos: visibility + tags
-- ---------------------------------------------------------------------
alter table public.videos
  add column if not exists visibility text not null default 'public';

alter table public.videos
  add column if not exists tags text[] not null default '{}';

-- Replace the status constraint so 'unpublished' is allowed alongside the
-- values the table already used. Existing rows keep their current status.
alter table public.videos drop constraint if exists videos_status_check;
alter table public.videos
  add constraint videos_status_check
  check (status in ('draft', 'published', 'unpublished', 'archived'));

alter table public.videos drop constraint if exists videos_visibility_check;
alter table public.videos
  add constraint videos_visibility_check
  check (visibility in ('public', 'private', 'preview'));

create index if not exists idx_videos_visibility on public.videos (visibility);
create index if not exists idx_videos_tags on public.videos using gin (tags);

comment on column public.videos.visibility is
  'public = any signed-in viewer; preview = any signed-in viewer (teaser); private = admin or uploader only. Enforced by RLS below.';

-- ---------------------------------------------------------------------
-- 2. profiles: last activity
-- ---------------------------------------------------------------------
alter table public.profiles
  add column if not exists last_active_at timestamptz;

-- ---------------------------------------------------------------------
-- 3. Settings tables (each holds exactly one row, id = 1)
-- ---------------------------------------------------------------------
create table if not exists public.site_settings (
  id                        integer primary key default 1 check (id = 1),
  site_name                 text not null default 'StreamVault',
  logo_url                  text,
  favicon_url               text,
  description               text default 'A modern video streaming platform.',
  default_theme             text not null default 'dark' check (default_theme in ('dark', 'light')),
  maintenance_mode          boolean not null default false,
  allow_signup              boolean not null default true,
  default_video_visibility  text not null default 'public'
                            check (default_video_visibility in ('public', 'private', 'preview')),
  enable_analytics          boolean not null default false,
  enable_adsense            boolean not null default false,
  updated_at                timestamptz not null default now()
);

create table if not exists public.analytics_settings (
  id                    integer primary key default 1 check (id = 1),
  ga_measurement_id     text,
  enabled               boolean not null default false,
  updated_at            timestamptz not null default now()
);

create table if not exists public.adsense_settings (
  id                        integer primary key default 1 check (id = 1),
  publisher_id              text,
  ad_slot_video_list        text,
  ad_slot_between_cards     text,
  ad_slot_video_details     text,
  ad_slot_below_player      text,
  enabled                   boolean not null default false,
  show_on_video_list        boolean not null default true,
  show_between_cards        boolean not null default false,
  show_on_video_details     boolean not null default true,
  show_below_player         boolean not null default false,
  updated_at                timestamptz not null default now()
);

-- Seed the singleton rows if absent (no-op when they already exist).
insert into public.site_settings (id) values (1) on conflict (id) do nothing;
insert into public.analytics_settings (id) values (1) on conflict (id) do nothing;
insert into public.adsense_settings (id) values (1) on conflict (id) do nothing;

drop trigger if exists set_site_settings_updated_at on public.site_settings;
create trigger set_site_settings_updated_at
  before update on public.site_settings
  for each row execute function public.set_updated_at();

drop trigger if exists set_analytics_settings_updated_at on public.analytics_settings;
create trigger set_analytics_settings_updated_at
  before update on public.analytics_settings
  for each row execute function public.set_updated_at();

drop trigger if exists set_adsense_settings_updated_at on public.adsense_settings;
create trigger set_adsense_settings_updated_at
  before update on public.adsense_settings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 4. Admin activity log
-- ---------------------------------------------------------------------
create table if not exists public.admin_activity_logs (
  id            uuid primary key default gen_random_uuid(),
  admin_id      uuid references public.profiles(id) on delete set null,
  action        text not null,
  target_type   text,
  target_id     text,
  details       jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

create index if not exists idx_admin_activity_created_at on public.admin_activity_logs (created_at desc);
create index if not exists idx_admin_activity_admin_id   on public.admin_activity_logs (admin_id);
create index if not exists idx_admin_activity_action     on public.admin_activity_logs (action);

-- =====================================================================
-- 5. ROW LEVEL SECURITY
-- =====================================================================
alter table public.site_settings       enable row level security;
alter table public.analytics_settings  enable row level security;
alter table public.adsense_settings    enable row level security;
alter table public.admin_activity_logs enable row level security;

-- ---------------------------------------------------------------------
-- 5.1 Settings: readable by any signed-in visitor (the app needs the site
--     name, GA id and AdSense id to render). Writable by admins only.
--     Nothing secret is stored in these tables — a GA measurement id and
--     an AdSense publisher id are both public identifiers that appear in
--     page source on every site that uses them.
-- ---------------------------------------------------------------------
drop policy if exists "site_settings_select_authenticated" on public.site_settings;
create policy "site_settings_select_authenticated"
  on public.site_settings for select to authenticated using (true);

drop policy if exists "site_settings_write_admin_only" on public.site_settings;
create policy "site_settings_write_admin_only"
  on public.site_settings for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "analytics_settings_select_authenticated" on public.analytics_settings;
create policy "analytics_settings_select_authenticated"
  on public.analytics_settings for select to authenticated using (true);

drop policy if exists "analytics_settings_write_admin_only" on public.analytics_settings;
create policy "analytics_settings_write_admin_only"
  on public.analytics_settings for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "adsense_settings_select_authenticated" on public.adsense_settings;
create policy "adsense_settings_select_authenticated"
  on public.adsense_settings for select to authenticated using (true);

drop policy if exists "adsense_settings_write_admin_only" on public.adsense_settings;
create policy "adsense_settings_write_admin_only"
  on public.adsense_settings for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------
-- 5.2 Activity log: admins only, and an admin may only write rows
--     attributed to themselves. No update/delete policy exists, so the
--     log is append-only from the client.
-- ---------------------------------------------------------------------
drop policy if exists "admin_activity_select_admin_only" on public.admin_activity_logs;
create policy "admin_activity_select_admin_only"
  on public.admin_activity_logs for select to authenticated
  using (public.is_admin());

drop policy if exists "admin_activity_insert_admin_only" on public.admin_activity_logs;
create policy "admin_activity_insert_admin_only"
  on public.admin_activity_logs for insert to authenticated
  with check (public.is_admin() and admin_id = auth.uid());

-- ---------------------------------------------------------------------
-- 5.3 videos: fold visibility into the read policy.
--
--     public  + published -> any signed-in viewer
--     preview + published -> any signed-in viewer (teaser content)
--     private             -> admin or the uploader only, any status
--     draft/unpublished/archived -> admin or uploader only
-- ---------------------------------------------------------------------
drop policy if exists "videos_select_published_or_owner_or_admin" on public.videos;
create policy "videos_select_published_or_owner_or_admin"
  on public.videos for select
  to authenticated
  using (
    (status = 'published' and visibility in ('public', 'preview'))
    or public.is_admin()
    or uploaded_by = auth.uid()
  );

-- Insert/update/delete policies are unchanged: admins may write anything,
-- managers only rows they uploaded, normal users nothing at all.

-- =====================================================================
-- 6. Category video counts (used by the admin Categories page)
-- =====================================================================
create or replace function public.category_video_counts()
returns table (category_id uuid, video_count bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select category_id, count(*)::bigint
  from public.videos
  where category_id is not null
  group by category_id;
$$;

grant execute on function public.category_video_counts() to authenticated;

-- =====================================================================
-- 7. Touch last_active_at for the calling user
-- =====================================================================
create or replace function public.touch_last_active()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null then
    update public.profiles set last_active_at = now() where id = auth.uid();
  end if;
end;
$$;

grant execute on function public.touch_last_active() to authenticated;

-- =====================================================================
-- 8. Guard: never leave the platform without a Super Admin
-- =====================================================================
create or replace function public.prevent_last_admin_removal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  remaining_admins integer;
begin
  -- Only relevant when an account stops being a usable admin.
  if (old.role = 'admin' and new.role <> 'admin')
     or (old.role = 'admin' and old.is_active and not new.is_active) then
    select count(*) into remaining_admins
    from public.profiles
    where role = 'admin' and is_active and id <> old.id;

    if remaining_admins = 0 then
      raise exception
        'Refusing to remove the last active Super Admin. Promote another admin first.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_last_admin_removal_trigger on public.profiles;
create trigger prevent_last_admin_removal_trigger
  before update on public.profiles
  for each row execute function public.prevent_last_admin_removal();

-- =====================================================================
-- Done.
-- =====================================================================
