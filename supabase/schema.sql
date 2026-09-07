-- =====================================================================
-- StreamVault — Complete Supabase Schema, RLS, and Storage Policies
-- =====================================================================
-- Run this entire file once in the Supabase SQL Editor (Project ->
-- SQL Editor -> New query) on a fresh project. It is idempotent where
-- practical (safe to re-run), but is intended to run top-to-bottom once.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Extensions
-- ---------------------------------------------------------------------
create extension if not exists pgcrypto;   -- gen_random_uuid()
create extension if not exists pg_trgm;    -- fast ILIKE search indexes

-- =====================================================================
-- 1. TABLES
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1.1 profiles — one row per auth.users row, created automatically
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  full_name     text,
  email         text,
  avatar_url    text,
  role          text not null default 'user' check (role in ('user', 'manager', 'admin')),
  is_active     boolean not null default true,
  last_active_at timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.profiles is 'App-level user profile, extends auth.users. role drives RBAC across the app.';

-- ---------------------------------------------------------------------
-- 1.2 categories
-- ---------------------------------------------------------------------
create table if not exists public.categories (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  slug          text not null unique,
  description   text,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 1.3 videos
-- ---------------------------------------------------------------------
create table if not exists public.videos (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  description     text,
  thumbnail_url   text,
  video_path      text not null,
  duration        integer,
  category_id     uuid references public.categories(id) on delete set null,
  uploaded_by     uuid references public.profiles(id) on delete set null,
  status          text not null default 'published'
                  check (status in ('draft', 'published', 'unpublished', 'archived')),
  visibility      text not null default 'public'
                  check (visibility in ('public', 'private', 'preview')),
  tags            text[] not null default '{}',
  is_featured     boolean not null default false,
  views_count     bigint not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 1.4 video_views — one row per counted view, used for de-duplication
-- ---------------------------------------------------------------------
create table if not exists public.video_views (
  id            uuid primary key default gen_random_uuid(),
  video_id      uuid references public.videos(id) on delete cascade,
  user_id       uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now()
);

-- =====================================================================
-- 2. INDEXES
-- =====================================================================
create index if not exists idx_videos_created_at   on public.videos (created_at desc);
create index if not exists idx_videos_category_id   on public.videos (category_id);
create index if not exists idx_videos_status        on public.videos (status);
create index if not exists idx_videos_uploaded_by    on public.videos (uploaded_by);
create index if not exists idx_videos_is_featured    on public.videos (is_featured);
create index if not exists idx_videos_title_trgm     on public.videos using gin (title gin_trgm_ops);
create index if not exists idx_videos_description_trgm on public.videos using gin (description gin_trgm_ops);

create index if not exists idx_video_views_video_id  on public.video_views (video_id);
create index if not exists idx_video_views_user_id   on public.video_views (user_id);
create index if not exists idx_video_views_created_at on public.video_views (created_at desc);

create index if not exists idx_categories_slug       on public.categories (slug);
create index if not exists idx_profiles_role         on public.profiles (role);

-- =====================================================================
-- 3. HELPER FUNCTIONS (SECURITY DEFINER — safe to call from RLS)
-- =====================================================================

-- Returns the role of the currently authenticated user, or null.
create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.is_manager_or_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role in ('manager', 'admin')
  );
$$;

create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select is_active from public.profiles where id = auth.uid()), false);
$$;

grant execute on function public.current_user_role() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_manager_or_admin() to authenticated;
grant execute on function public.is_active_user() to authenticated;

-- =====================================================================
-- 4. TRIGGERS
-- =====================================================================

-- ---------------------------------------------------------------------
-- 4.1 updated_at maintenance
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists set_videos_updated_at on public.videos;
create trigger set_videos_updated_at
  before update on public.videos
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 4.2 Auto-create a profile row whenever a new auth.users row appears
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- 4.3 Prevent privilege escalation: only an admin may change role or
--     is_active on a profile. Any other attempt silently keeps the old
--     value instead of erroring, so a user can still update their own
--     full_name/avatar_url in the same request.
-- ---------------------------------------------------------------------
create or replace function public.protect_profile_privileged_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() then
    return new;
  end if;

  if new.role is distinct from old.role then
    new.role = old.role;
  end if;

  if new.is_active is distinct from old.is_active then
    new.is_active = old.is_active;
  end if;

  return new;
end;
$$;

drop trigger if exists protect_profile_privileged_fields_trigger on public.profiles;
create trigger protect_profile_privileged_fields_trigger
  before update on public.profiles
  for each row execute function public.protect_profile_privileged_fields();

-- =====================================================================
-- 5. ROW LEVEL SECURITY
-- =====================================================================
alter table public.profiles     enable row level security;
alter table public.categories   enable row level security;
alter table public.videos       enable row level security;
alter table public.video_views  enable row level security;

-- ---------------------------------------------------------------------
-- 5.1 profiles policies
-- ---------------------------------------------------------------------
drop policy if exists "profiles_select_authenticated" on public.profiles;
create policy "profiles_select_authenticated"
  on public.profiles for select
  to authenticated
  using (true);

drop policy if exists "profiles_update_own_or_admin" on public.profiles;
create policy "profiles_update_own_or_admin"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id or public.is_admin())
  with check (auth.uid() = id or public.is_admin());

-- No client-side INSERT policy: rows are created exclusively by the
-- handle_new_user trigger (SECURITY DEFINER, bypasses RLS).

drop policy if exists "profiles_delete_admin_only" on public.profiles;
create policy "profiles_delete_admin_only"
  on public.profiles for delete
  to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------
-- 5.2 categories policies
-- ---------------------------------------------------------------------
drop policy if exists "categories_select_authenticated" on public.categories;
create policy "categories_select_authenticated"
  on public.categories for select
  to authenticated
  using (true);

drop policy if exists "categories_insert_admin_only" on public.categories;
create policy "categories_insert_admin_only"
  on public.categories for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "categories_update_admin_only" on public.categories;
create policy "categories_update_admin_only"
  on public.categories for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "categories_delete_admin_only" on public.categories;
create policy "categories_delete_admin_only"
  on public.categories for delete
  to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------
-- 5.3 videos policies
--
-- - Any authenticated user can read published videos.
-- - Admin can read/write every video regardless of status or owner.
-- - Manager can read/write only videos they themselves uploaded.
-- - Normal users can never insert/update/delete.
-- ---------------------------------------------------------------------
-- public  + published -> any signed-in viewer
-- preview + published -> any signed-in viewer (teaser content)
-- private             -> admin or the uploader only, whatever the status
-- draft/unpublished/archived -> admin or uploader only
drop policy if exists "videos_select_published_or_owner_or_admin" on public.videos;
create policy "videos_select_published_or_owner_or_admin"
  on public.videos for select
  to authenticated
  using (
    (status = 'published' and visibility in ('public', 'preview'))
    or public.is_admin()
    or uploaded_by = auth.uid()
  );

drop policy if exists "videos_insert_manager_or_admin" on public.videos;
create policy "videos_insert_manager_or_admin"
  on public.videos for insert
  to authenticated
  with check (
    public.is_manager_or_admin()
    and (uploaded_by = auth.uid() or public.is_admin())
  );

drop policy if exists "videos_update_owner_manager_or_admin" on public.videos;
create policy "videos_update_owner_manager_or_admin"
  on public.videos for update
  to authenticated
  using (
    public.is_admin()
    or (public.is_manager_or_admin() and uploaded_by = auth.uid())
  )
  with check (
    public.is_admin()
    or (public.is_manager_or_admin() and uploaded_by = auth.uid())
  );

drop policy if exists "videos_delete_owner_manager_or_admin" on public.videos;
create policy "videos_delete_owner_manager_or_admin"
  on public.videos for delete
  to authenticated
  using (
    public.is_admin()
    or (public.is_manager_or_admin() and uploaded_by = auth.uid())
  );

-- ---------------------------------------------------------------------
-- 5.4 video_views policies
-- ---------------------------------------------------------------------
drop policy if exists "video_views_insert_own" on public.video_views;
create policy "video_views_insert_own"
  on public.video_views for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "video_views_select_own_or_admin" on public.video_views;
create policy "video_views_select_own_or_admin"
  on public.video_views for select
  to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- No update/delete policies for anyone but admin (defense in depth;
-- admin still goes through the service role for bulk maintenance).
drop policy if exists "video_views_delete_admin_only" on public.video_views;
create policy "video_views_delete_admin_only"
  on public.video_views for delete
  to authenticated
  using (public.is_admin());

-- =====================================================================
-- 6. VIEW-COUNTING RPC
--
-- Called from the client as: supabase.rpc('record_video_view', { p_video_id })
-- Runs as SECURITY DEFINER so it can atomically insert the dedupe row
-- and increment videos.views_count in one transaction, while regular
-- clients still cannot UPDATE videos.views_count directly.
-- De-dupes repeat views from the same signed-in user within 30 minutes.
-- =====================================================================
create or replace function public.record_video_view(p_video_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recent_view_exists boolean;
begin
  if auth.uid() is null then
    raise exception 'Authentication required to record a view';
  end if;

  select exists (
    select 1 from public.video_views
    where video_id = p_video_id
      and user_id = auth.uid()
      and created_at > now() - interval '30 minutes'
  ) into v_recent_view_exists;

  if not v_recent_view_exists then
    insert into public.video_views (video_id, user_id) values (p_video_id, auth.uid());
    update public.videos set views_count = views_count + 1 where id = p_video_id;
  end if;
end;
$$;

grant execute on function public.record_video_view(uuid) to authenticated;

-- =====================================================================
-- 7. STORAGE BUCKETS + POLICIES
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'videos', 'videos', true, 524288000,
  array['video/mp4', 'video/webm', 'video/quicktime']
)
on conflict (id) do update
  set public = true,
      file_size_limit = 524288000,
      allowed_mime_types = array['video/mp4', 'video/webm', 'video/quicktime'];

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'thumbnails', 'thumbnails', true, 5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = true,
      file_size_limit = 5242880,
      allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

-- Public read for both buckets — playback/thumbnails need direct URLs.
drop policy if exists "storage_videos_public_read" on storage.objects;
create policy "storage_videos_public_read"
  on storage.objects for select
  using (bucket_id = 'videos');

drop policy if exists "storage_thumbnails_public_read" on storage.objects;
create policy "storage_thumbnails_public_read"
  on storage.objects for select
  using (bucket_id = 'thumbnails');

-- Only admin/manager may write to either bucket. Normal users get no
-- INSERT/UPDATE/DELETE policy at all, so those operations are denied.
drop policy if exists "storage_videos_insert_manager_or_admin" on storage.objects;
create policy "storage_videos_insert_manager_or_admin"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'videos' and public.is_manager_or_admin());

drop policy if exists "storage_videos_update_manager_or_admin" on storage.objects;
create policy "storage_videos_update_manager_or_admin"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'videos' and public.is_manager_or_admin())
  with check (bucket_id = 'videos' and public.is_manager_or_admin());

drop policy if exists "storage_videos_delete_manager_or_admin" on storage.objects;
create policy "storage_videos_delete_manager_or_admin"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'videos' and public.is_manager_or_admin());

drop policy if exists "storage_thumbnails_insert_manager_or_admin" on storage.objects;
create policy "storage_thumbnails_insert_manager_or_admin"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'thumbnails' and public.is_manager_or_admin());

drop policy if exists "storage_thumbnails_update_manager_or_admin" on storage.objects;
create policy "storage_thumbnails_update_manager_or_admin"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'thumbnails' and public.is_manager_or_admin())
  with check (bucket_id = 'thumbnails' and public.is_manager_or_admin());

drop policy if exists "storage_thumbnails_delete_manager_or_admin" on storage.objects;
create policy "storage_thumbnails_delete_manager_or_admin"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'thumbnails' and public.is_manager_or_admin());

-- =====================================================================
-- 8. SEED DATA (safe to skip/edit)
-- =====================================================================
insert into public.categories (name, slug, description) values
  ('Technology', 'technology', 'Tech reviews, tutorials, and news'),
  ('Music', 'music', 'Music videos and live performances'),
  ('Gaming', 'gaming', 'Gameplay, walkthroughs, and esports'),
  ('Education', 'education', 'Courses, lectures, and how-tos'),
  ('Entertainment', 'entertainment', 'Movies, shows, and comedy')
on conflict (slug) do nothing;


-- =====================================================================
-- 10. ADMIN CONTROL PANEL
-- =====================================================================
-- Settings tables, admin activity log, and supporting functions. These
-- are also shipped as supabase/migrations/001_admin_panel.sql for
-- databases created before the admin panel existed.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 10.1 Settings tables (each holds exactly one row, id = 1)
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
-- 10.2 Admin activity log
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
-- 10.3 Row level security
-- =====================================================================
alter table public.site_settings       enable row level security;
alter table public.analytics_settings  enable row level security;
alter table public.adsense_settings    enable row level security;
alter table public.admin_activity_logs enable row level security;

-- ---------------------------------------------------------------------
-- 10.3.1 Settings: readable by any signed-in visitor (the app needs the site
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
-- 10.3.2 Activity log: admins only, and an admin may only write rows
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
-- 10.3.3 videos: fold visibility into the read policy.
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
-- 10.4 Category video counts (used by the admin Categories page)
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
-- 10.5 Touch last_active_at for the calling user
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
-- 10.6 Guard: never leave the platform without a Super Admin
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

-- =====================================================================
-- 9. PROMOTE THE FIRST SUPER ADMIN
-- =====================================================================
-- Sign up for a normal account through the app first, then run:
--
--   update public.profiles set role = 'admin' where email = 'you@example.com';
--
-- This is the ONLY supported way to create a Super Admin: there is no
-- hardcoded admin password anywhere in this application. Run it from
-- the Supabase SQL Editor (which uses your project's privileged
-- connection, not the anon/publishable key), never from client code.
-- =====================================================================
