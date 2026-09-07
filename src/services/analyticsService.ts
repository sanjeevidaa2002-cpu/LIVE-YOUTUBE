import { supabase } from "@/lib/supabase";
import { getUserCounts } from "./userService";

export interface DashboardStats {
  totalUsers: number;
  totalManagers: number;
  totalVideos: number;
  totalViews: number;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const [{ totalUsers, totalManagers }, { count: totalVideos }, viewsResult] =
    await Promise.all([
      getUserCounts(),
      supabase.from("videos").select("*", { count: "exact", head: true }),
      supabase.from("videos").select("views_count"),
    ]);

  const totalViews = (viewsResult.data ?? []).reduce(
    (sum, row) => sum + (row.views_count ?? 0),
    0,
  );

  return {
    totalUsers,
    totalManagers,
    totalVideos: totalVideos ?? 0,
    totalViews,
  };
}

export async function getTopViewedVideos(limit = 5) {
  const { data, error } = await supabase
    .from("videos")
    .select("id, title, views_count, thumbnail_url")
    .order("views_count", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getRecentVideos(limit = 5) {
  const { data, error } = await supabase
    .from("videos")
    .select("id, title, thumbnail_url, status, visibility, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getRecentUsers(limit = 5) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, created_at, is_active, last_active_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Views recorded since the given ISO timestamp (dashboard "today's views"). */
export async function countViewsSince(sinceIso: string): Promise<number> {
  const { count, error } = await supabase
    .from("video_views")
    .select("*", { count: "exact", head: true })
    .gte("created_at", sinceIso);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

/** The single most-viewed video, or null when there are none. */
export async function getMostViewedVideo() {
  const { data, error } = await supabase
    .from("videos")
    .select("id, title, views_count, thumbnail_url")
    .order("views_count", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

/** The most recently created video, or null when there are none. */
export async function getLatestVideo() {
  const { data, error } = await supabase
    .from("videos")
    .select("id, title, thumbnail_url, created_at, status, visibility")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}
