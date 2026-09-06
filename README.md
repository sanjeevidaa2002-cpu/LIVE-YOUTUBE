# StreamVault

A production-ready video streaming / playback platform. Users watch, search, and
filter videos; only **Super Admins** and users promoted to **Manager** can
upload or manage video content. There is no social/upload feature for regular
users — this is a curated streaming platform, not a UGC site.

Built with React + TypeScript + Vite + Tailwind CSS + shadcn/ui-style
components, backed entirely by Supabase (Auth, Postgres, Storage).

## Tech Stack

- React 18 + TypeScript + Vite
- Tailwind CSS + shadcn/ui-style component primitives (Radix UI)
- React Router v6
- Supabase (`@supabase/supabase-js`): Auth, Postgres, Storage
- npm

## 1. Prerequisites

- Node.js 18+
- A free [Supabase](https://supabase.com) project

## 2. Set up Supabase

1. Create a new project at [supabase.com](https://supabase.com).
2. Go to **SQL Editor** → **New query**, paste the entire contents of
   [`supabase/schema.sql`](./supabase/schema.sql), and run it. This creates:
   - `profiles`, `categories`, `videos`, `video_views` tables
   - All indexes, triggers, and the `handle_new_user` auto-profile trigger
   - Row Level Security policies for every table
   - The `videos` and `thumbnails` Storage buckets + Storage RLS policies
   - Helper functions (`is_admin()`, `is_manager_or_admin()`, `record_video_view()`)
   - A handful of seed categories
3. Go to **Project Settings → API** and copy:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon / public** key → `VITE_SUPABASE_PUBLISHABLE_KEY`

   Never copy the `service_role` / secret key into this project — it must
   never reach the frontend.

## 3. Configure environment variables

```bash
cp .env.example .env
```

Fill in:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-public-key
```

## 4. Install and run

```bash
npm install
npm run dev
```

Open http://localhost:5173.

Build for production with `npm run build` (runs `tsc -b && vite build`);
preview the production build with `npm run preview`.

## 5. Create your first Super Admin

There is **no hardcoded admin password** anywhere in this app. To create your
first Super Admin:

1. Sign up for a normal account through the app's `/signup` page.
2. In the Supabase SQL Editor, run:

   ```sql
   update public.profiles set role = 'admin' where email = 'you@example.com';
   ```

3. Sign out and back in — you'll be routed to `/admin` automatically.

From the Admin Dashboard's **Managers** page you can then promote/demote any
other user to/from the Manager role.

## 6. Roles & permissions

| Capability                          | User | Manager | Super Admin |
|--------------------------------------|:----:|:-------:|:------------:|
| Browse / search / watch videos       | ✅   | ✅      | ✅           |
| Upload / edit / delete **own** videos| ❌   | ✅      | ✅           |
| Manage **any** video                 | ❌   | ❌      | ✅           |
| Manage categories                    | ❌   | ❌      | ✅           |
| Manage users / activate-deactivate   | ❌   | ❌      | ✅           |
| Assign/remove Manager role           | ❌   | ❌      | ✅           |
| View analytics dashboard             | ❌   | ❌      | ✅           |

**This is enforced in two places, and the database is the source of truth:**

- **Frontend**: `ProtectedRoute` (`src/components/ProtectedRoute.tsx`) redirects
  unauthenticated users to `/login` and blocks users whose role doesn't match
  a route's `allowedRoles`. This is a UX convenience only.
- **Database (authoritative)**: every table has Row Level Security enabled
  (see `supabase/schema.sql`). Even if the frontend check were bypassed
  entirely, Postgres itself rejects any unauthorized `INSERT`/`UPDATE`/`DELETE`,
  and Storage RLS policies mean only `admin`/`manager` accounts can ever write
  to the `videos` or `thumbnails` buckets. A `user`-role account cannot upload
  a file to storage or write a video row no matter what the client sends.

## 7. Project structure

```
src/
  components/       Shared UI (VideoCard, VideoPlayer, VideoForm, ui/ primitives, ...)
  contexts/         AuthContext (session, profile, role)
  hooks/            useDebounce, use-toast
  layouts/          MainLayout, AuthLayout, AdminLayout, ManagerLayout, DashboardLayout
  lib/              supabase client, utils
  pages/
    auth/           Login, Signup, ForgotPassword, ResetPassword
    user/           Home, Videos, VideoDetails, Category, Profile
    admin/          Dashboard, Videos, UploadVideo, EditVideo, Users, Managers,
                     Categories, Analytics, Settings
    manager/        Dashboard, Videos, UploadVideo, EditVideo, Profile
  services/         Typed Supabase query/mutation wrappers (videoService,
                     categoryService, userService, analyticsService, storageService)
  types/            App + database types
supabase/
  schema.sql        Full schema, RLS, storage policies, seed data (run once)
```

## 8. Video upload flow

1. Client validates file type (MP4/WebM/MOV, ≤500MB) and shows name/size.
2. File is uploaded directly to the `videos` Storage bucket via `XMLHttpRequest`
   (so we can show real upload progress), authenticated with the user's
   Supabase session token — Storage RLS still requires `admin`/`manager` role.
3. An optional thumbnail is uploaded to the `thumbnails` bucket the same way.
4. A row is inserted into `videos` pointing at the uploaded file's public URL.
5. **If step 4 fails**, the already-uploaded file(s) from steps 2–3 are deleted
   so no orphaned files are left in Storage.

## 9. View counting

Views are recorded via the `record_video_view(p_video_id)` Postgres function
(`SECURITY DEFINER`), called once when a video starts playing for the first
time in that page load. It de-duplicates: the same signed-in user re-watching
within 30 minutes will not increment the counter again.

## 10. Notes on scope

- Search uses `ilike` over title/description with trigram indexes for
  performance; category filtering is a separate dropdown.
- The video player is a custom-built HTML5 `<video>` player (no third-party
  player dependency) supporting play/pause, seek, volume, fullscreen,
  playback speed, and Picture-in-Picture where supported by the browser.
- Dark theme is the default and only theme, per the design brief.
